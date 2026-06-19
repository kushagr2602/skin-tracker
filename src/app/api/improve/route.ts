import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { FunctionDeclaration, GenerativeModel } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// A two-agent pipeline ("agent to agent"):
//
//   ANALYST  → reads real signals (feedback + usage), writes findings
//                       │  findings text handed off as input ↓
//   PRODUCT MANAGER → turns findings into prioritized suggestions it SAVES
//
// Both agents run the exact same loop (runAgentLoop). The only differences are
// their system prompt and which tools they're allowed to touch. That's the
// whole multi-agent idea: specialized agents, output of one = input of next.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tools the ANALYST can read ──────────────────────────────────────────────
const ANALYST_TOOLS: FunctionDeclaration[] = [
  {
    name: 'get_feedback',
    description: "Read the user's recent in-app feedback (helpful / not helpful / feature ideas). Use this to hear what they actually want.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'get_usage_stats',
    description: "Get derived usage statistics: how many logs exist and what fraction include a photo, diet, workout, sleep, water, etc. Low fractions = a feature being skipped or too hard to use.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
]

// ── Tool the PRODUCT MANAGER can write ──────────────────────────────────────
const PM_TOOLS: FunctionDeclaration[] = [
  {
    name: 'save_suggestion',
    description: 'Save one concrete, actionable improvement proposal to the backlog. Call once per distinct idea.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Short imperative title, e.g. "Make the workout section one tap".' },
        rationale: { type: SchemaType.STRING, description: 'Why this matters, referencing the signal that drove it.' },
        category: { type: SchemaType.STRING, description: 'One of: logging, insights, onboarding, coach, performance, other.' },
        impact: { type: SchemaType.STRING, description: 'low | medium | high — how much it helps the user.' },
        effort: { type: SchemaType.STRING, description: 'low | medium | high — rough build cost.' },
        source: { type: SchemaType.STRING, description: 'Short note on which signal drove this, e.g. "workout filled in 11% of logs".' },
      },
      required: ['title', 'rationale', 'category', 'impact', 'effort'],
    },
  },
]

// ── Tool implementations ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, args: Record<string, unknown>, supabase: any, userId: string) {
  switch (name) {
    case 'get_feedback': {
      const { data } = await supabase
        .from('app_feedback')
        .select('sentiment, message, page, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      return data?.length ? data : 'No feedback submitted yet.'
    }

    case 'get_usage_stats': {
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('id, photo_url, photo_url_right, user_severity, ai_severity, notes')
        .eq('user_id', userId)
      const total = logs?.length ?? 0
      if (total === 0) return 'No logs yet — not enough usage data to analyze. The biggest opportunity is getting the user to log at all.'

      const ids = logs.map((l: { id: string }) => l.id)
      const [{ data: diet }, { data: life }, { data: skin }, { data: meds }, { data: { user: u } }] = await Promise.all([
        supabase.from('diet_entries').select('log_id').in('log_id', ids),
        supabase.from('lifestyle_factors').select('log_id, sleep_hours, water_glasses, stress_level, workout_type, exercise_minutes').in('log_id', ids),
        supabase.from('skincare_products').select('id').eq('user_id', userId),
        supabase.from('medications').select('id').eq('user_id', userId),
        supabase.auth.getUser(),
      ])

      const logsWithDiet = new Set((diet ?? []).map((d: { log_id: string }) => d.log_id)).size
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lifeRows: any[] = life ?? []
      const pct = (n: number) => `${Math.round((n / total) * 100)}%`
      const countWhere = (fn: (r: Record<string, unknown>) => boolean) => lifeRows.filter(fn).length

      return {
        totalLogs: total,
        photoAttached: pct(logs.filter((l: { photo_url: string | null; photo_url_right: string | null }) => l.photo_url || l.photo_url_right).length),
        dietLogged: pct(logsWithDiet),
        sleepLogged: pct(countWhere((r) => r.sleep_hours != null)),
        waterLogged: pct(countWhere((r) => r.water_glasses != null)),
        stressLogged: pct(countWhere((r) => r.stress_level != null)),
        workoutLogged: pct(countWhere((r) => r.workout_type != null || r.exercise_minutes != null)),
        notesLogged: pct(logs.filter((l: { notes: string | null }) => l.notes).length),
        skincareProductsInLibrary: skin?.length ?? 0,
        medicationsInLibrary: meds?.length ?? 0,
        lifestyleProfileSet: !!u?.user_metadata?.lifestyle_profile,
      }
    }

    case 'save_suggestion': {
      const title = (args.title as string)?.trim()
      if (!title) return { saved: false, error: 'missing title' }
      // Dedupe: skip if an open suggestion with the same title already exists
      const { data: existing } = await supabase
        .from('suggestions')
        .select('id')
        .eq('user_id', userId)
        .eq('title', title)
        .neq('status', 'dismissed')
        .limit(1)
      if (existing?.length) return { saved: false, reason: 'already in backlog' }

      const { error } = await supabase.from('suggestions').insert({
        user_id: userId,
        title,
        rationale: (args.rationale as string) ?? null,
        category: (args.category as string) ?? 'other',
        impact: (args.impact as string) ?? 'medium',
        effort: (args.effort as string) ?? 'medium',
        source: (args.source as string) ?? null,
      })
      if (error) return { saved: false, error: error.message }
      return { saved: true, title }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ── The shared agent loop (identical for both agents) ───────────────────────
async function runAgentLoop(
  model: GenerativeModel,
  initialMessage: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const chat = model.startChat()
  let result = await chat.sendMessage(initialMessage)

  for (let round = 0; round < 6; round++) {
    const calls = result.response.functionCalls()
    if (!calls || calls.length === 0) break

    const toolResults = await Promise.all(
      calls.map(async (fc) => ({
        functionResponse: {
          name: fc.name,
          response: { result: await executeTool(fc.name, fc.args as Record<string, unknown>, supabase, userId) },
        },
      })),
    )
    result = await chat.sendMessage(toolResults)
  }
  return result.response.text()
}

// ── The pipeline ────────────────────────────────────────────────────────────
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = user.user_metadata?.gemini_api_key as string | undefined
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key set. Add it in Settings.' }, { status: 400 })

  const genAI = new GoogleGenerativeAI(apiKey)

  // ── AGENT 1: Analyst ──
  const analyst = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: `You are a product analyst for a skin/acne tracking app. Your job is to find what's working and what isn't, using ONLY real evidence.

1. Call get_usage_stats and get_feedback to gather evidence.
2. Identify the 3–6 most important problems or opportunities. A feature logged in a low % of entries is likely too buried, too tedious, or not valued.
3. Output a concise findings list. For each: the observation, the evidence (specific number or quote), and what it implies.

Do not propose solutions yet — just diagnose. Be specific and cite the numbers.`,
    tools: [{ functionDeclarations: ANALYST_TOOLS }],
  })

  const findings = await runAgentLoop(analyst, 'Analyze this app and report your findings.', supabase, user.id)

  // ── AGENT 2: Product Manager (input = agent 1's output) ──
  const pm = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: `You are a product manager for a skin/acne tracking app. You receive an analyst's findings and turn them into concrete, prioritized improvements.

For each meaningful finding, call save_suggestion exactly once with:
- a short imperative title
- a rationale that references the analyst's evidence
- category, impact (low/medium/high), effort (low/medium/high), and a one-line source note

Save 3–6 suggestions total — the highest-leverage ones only. Prefer high-impact / low-effort. After saving, briefly summarize what you added to the backlog.`,
    tools: [{ functionDeclarations: PM_TOOLS }],
  })

  const summary = await runAgentLoop(
    pm,
    `Here are the analyst's findings. Turn the most important ones into saved suggestions:\n\n${findings}`,
    supabase,
    user.id,
  )

  return NextResponse.json({ findings, summary })
}
