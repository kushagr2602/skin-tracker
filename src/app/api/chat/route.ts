import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { FunctionDeclaration } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

// ─── Tool definitions ────────────────────────────────────────────────────────
// These are what the LLM sees — it reads the descriptions and decides which
// tool to call and with what args. Good descriptions = better decisions.

const COACH_TOOLS: FunctionDeclaration[] = [
  {
    name: 'get_recent_logs',
    description:
      "Fetch the user's daily skin severity logs for the last N days. Returns dates, severity scores, and AI summaries. Use this to understand recent trends or answer 'how has my skin been'.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: {
          type: SchemaType.INTEGER,
          description: 'Number of days to look back. Common values: 7, 14, 30.',
        },
      },
      required: ['days'],
    },
  },
  {
    name: 'get_food_correlations',
    description:
      "Calculate average skin severity on days each food was consumed vs the baseline. Positive impact means food correlates with WORSE skin. Use this to identify dietary triggers.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'get_sleep_patterns',
    description:
      'Show average skin severity grouped by hours of sleep (under 6h, 6–7h, 7–8h, 8h+). Use this to check if sleep duration affects skin.',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'get_severity_trend',
    description:
      "Get whether skin is improving, worsening, or stable over the last N weeks by comparing older vs recent averages.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        weeks: {
          type: SchemaType.INTEGER,
          description: 'How many weeks to analyze. Default 4.',
        },
      },
    },
  },
  {
    name: 'get_product_effectiveness',
    description:
      "Analyze which skincare products the user logged and whether skin was better or worse on days they were used.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'get_stress_correlation',
    description:
      'Compare average skin severity across low (1–3), medium (4–6), and high (7–10) stress days. Use to check if stress affects skin.',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'get_lifestyle_profile',
    description:
      "Read the lifestyle profile the user described during intake — their stated habits and likely acne triggers. Use this to personalize answers to who they actually are.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
]

// Intake mode gets a different toolset: it can SAVE a profile (a write tool,
// not just a read tool). This is the agent taking an action, not just answering.
const INTAKE_TOOLS: FunctionDeclaration[] = [
  {
    name: 'save_lifestyle_profile',
    description:
      "Save the user's lifestyle profile once you've gathered enough acne-relevant detail. Call this near the end of the interview.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        summary: {
          type: SchemaType.STRING,
          description: "A concise 2–4 sentence summary of the user's acne-relevant lifestyle.",
        },
        triggers: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "The user's most likely acne triggers or risk factors, e.g. ['high dairy intake', 'irregular sleep', 'doesn't cleanse after gym'].",
        },
      },
      required: ['summary', 'triggers'],
    },
  },
]

// ─── Tool implementations ────────────────────────────────────────────────────
// Each tool is a plain Supabase query. The LLM calls the tool with args,
// we run the query, return the data, the LLM uses it to form its answer.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, args: Record<string, unknown>, supabase: any, userId: string) {
  switch (name) {
    case 'get_recent_logs': {
      const days = Math.min((args.days as number) ?? 7, 90)
      const since = new Date()
      since.setDate(since.getDate() - days)
      const { data } = await supabase
        .from('daily_logs')
        .select('log_date, user_severity, ai_severity, ai_summary, notes')
        .eq('user_id', userId)
        .gte('log_date', since.toISOString().split('T')[0])
        .order('log_date', { ascending: false })
      return data?.length ? data : 'No logs found for that period.'
    }

    case 'get_food_correlations': {
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('id, user_severity, ai_severity')
        .eq('user_id', userId)
      if (!logs?.length) return 'No logs yet — start logging daily to get food correlations.'

      const { data: diet } = await supabase
        .from('diet_entries')
        .select('log_id, food_item')
        .in('log_id', logs.map((l: { id: string }) => l.id))
      if (!diet?.length) return 'No food entries logged yet.'

      const sevMap = new Map<string, number>()
      for (const l of logs) {
        const sev = l.user_severity ?? l.ai_severity
        if (sev != null) sevMap.set(l.id, sev)
      }
      const allSevs = [...sevMap.values()]
      const overallAvg = allSevs.reduce((a, b) => a + b, 0) / allSevs.length

      const byFood: Record<string, number[]> = {}
      for (const d of diet) {
        const sev = sevMap.get(d.log_id)
        if (sev == null) continue
        const key = d.food_item.toLowerCase()
        ;(byFood[key] ??= []).push(sev)
      }

      return Object.entries(byFood)
        .filter(([, sevs]) => sevs.length >= 2)
        .map(([food, sevs]) => {
          const avg = sevs.reduce((a, b) => a + b, 0) / sevs.length
          return {
            food,
            avgSeverityOnDays: +avg.toFixed(1),
            overallAvg: +overallAvg.toFixed(1),
            impact: +(avg - overallAvg).toFixed(1),
            occurrences: sevs.length,
          }
        })
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 10)
    }

    case 'get_sleep_patterns': {
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('id, user_severity, ai_severity')
        .eq('user_id', userId)
      if (!logs?.length) return 'No logs yet.'

      const { data: lifestyle } = await supabase
        .from('lifestyle_factors')
        .select('log_id, sleep_hours')
        .in('log_id', logs.map((l: { id: string }) => l.id))
        .not('sleep_hours', 'is', null)
      if (!lifestyle?.length) return 'No sleep data logged yet — start filling in the Sleep section.'

      const sevMap = new Map<string, number>()
      for (const l of logs) {
        const sev = l.user_severity ?? l.ai_severity
        if (sev != null) sevMap.set(l.id, sev)
      }

      const buckets: Record<string, number[]> = {}
      for (const row of lifestyle) {
        const sev = sevMap.get(row.log_id)
        if (sev == null) continue
        const h = row.sleep_hours
        const key = h < 6 ? 'under 6h' : h < 7 ? '6–7h' : h < 8 ? '7–8h' : '8h+'
        ;(buckets[key] ??= []).push(sev)
      }

      return Object.entries(buckets).map(([range, sevs]) => ({
        sleepRange: range,
        avgSeverity: +(sevs.reduce((a, b) => a + b, 0) / sevs.length).toFixed(1),
        nights: sevs.length,
      }))
    }

    case 'get_severity_trend': {
      const weeks = Math.min((args.weeks as number) ?? 4, 12)
      const since = new Date()
      since.setDate(since.getDate() - weeks * 7)
      const { data } = await supabase
        .from('daily_logs')
        .select('log_date, user_severity, ai_severity')
        .eq('user_id', userId)
        .gte('log_date', since.toISOString().split('T')[0])
        .order('log_date', { ascending: true })

      const sevs = (data ?? [])
        .map((l: { user_severity: number | null; ai_severity: number | null }) => l.user_severity ?? l.ai_severity)
        .filter((s: unknown): s is number => typeof s === 'number')

      if (sevs.length < 4) return { trend: 'need more logs to detect a trend', logsFound: sevs.length }

      const half = Math.floor(sevs.length / 2)
      const earlierAvg = sevs.slice(0, half).reduce((a: number, b: number) => a + b, 0) / half
      const recentAvg = sevs.slice(half).reduce((a: number, b: number) => a + b, 0) / (sevs.length - half)
      const delta = recentAvg - earlierAvg

      return {
        overallAvg: +(sevs.reduce((a: number, b: number) => a + b, 0) / sevs.length).toFixed(1),
        earlierAvg: +earlierAvg.toFixed(1),
        recentAvg: +recentAvg.toFixed(1),
        trend: delta > 0.5 ? 'worsening' : delta < -0.5 ? 'improving' : 'stable',
        changeAmount: +delta.toFixed(1),
        logsAnalyzed: sevs.length,
      }
    }

    case 'get_product_effectiveness': {
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('id, user_severity, ai_severity')
        .eq('user_id', userId)
      if (!logs?.length) return 'No logs yet.'

      const { data: usage } = await supabase
        .from('log_skincare')
        .select('log_id, skincare_products(name)')
        .in('log_id', logs.map((l: { id: string }) => l.id))
      if (!usage?.length) return 'No skincare usage logged yet.'

      const sevMap = new Map<string, number>()
      for (const l of logs) {
        const sev = l.user_severity ?? l.ai_severity
        if (sev != null) sevMap.set(l.id, sev)
      }
      const allSevs = [...sevMap.values()]
      const overallAvg = allSevs.reduce((a, b) => a + b, 0) / allSevs.length

      const byProduct: Record<string, number[]> = {}
      for (const row of usage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = (row as any).skincare_products?.name as string | undefined
        if (!name) continue
        const sev = sevMap.get(row.log_id)
        if (sev == null) continue
        ;(byProduct[name] ??= []).push(sev)
      }

      return Object.entries(byProduct)
        .filter(([, sevs]) => sevs.length >= 2)
        .map(([product, sevs]) => {
          const avg = sevs.reduce((a, b) => a + b, 0) / sevs.length
          return {
            product,
            avgSeverityWhenUsed: +avg.toFixed(1),
            overallAvg: +overallAvg.toFixed(1),
            impact: +(avg - overallAvg).toFixed(1),
            daysUsed: sevs.length,
          }
        })
    }

    case 'get_stress_correlation': {
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('id, user_severity, ai_severity')
        .eq('user_id', userId)
      if (!logs?.length) return 'No logs yet.'

      const { data: lifestyle } = await supabase
        .from('lifestyle_factors')
        .select('log_id, stress_level')
        .in('log_id', logs.map((l: { id: string }) => l.id))
        .not('stress_level', 'is', null)
      if (!lifestyle?.length) return 'No stress data logged yet.'

      const sevMap = new Map<string, number>()
      for (const l of logs) {
        const sev = l.user_severity ?? l.ai_severity
        if (sev != null) sevMap.set(l.id, sev)
      }

      const buckets: Record<string, number[]> = { 'low (1–3)': [], 'medium (4–6)': [], 'high (7–10)': [] }
      for (const row of lifestyle) {
        const sev = sevMap.get(row.log_id)
        if (sev == null) continue
        const key = row.stress_level <= 3 ? 'low (1–3)' : row.stress_level <= 6 ? 'medium (4–6)' : 'high (7–10)'
        buckets[key].push(sev)
      }

      return Object.entries(buckets)
        .filter(([, sevs]) => sevs.length > 0)
        .map(([level, sevs]) => ({
          stressLevel: level,
          avgSeverity: +(sevs.reduce((a, b) => a + b, 0) / sevs.length).toFixed(1),
          days: sevs.length,
        }))
    }

    case 'get_lifestyle_profile': {
      const { data: { user: u } } = await supabase.auth.getUser()
      const profile = u?.user_metadata?.lifestyle_profile
      return profile ?? 'No lifestyle profile saved yet. Suggest the user set one up on the Coach setup page.'
    }

    case 'save_lifestyle_profile': {
      const summary = (args.summary as string) ?? ''
      const triggers = (args.triggers as string[]) ?? []
      const { error } = await supabase.auth.updateUser({
        data: { lifestyle_profile: { summary, triggers, updated_at: new Date().toISOString() } },
      })
      if (error) return { saved: false, error: error.message }
      return { saved: true, summary, triggers }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ─── Agent route ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = user.user_metadata?.gemini_api_key as string | undefined
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key set. Add it in Settings.' }, { status: 400 })

  // history: previous text exchanges from the client [{role, content}, ...]
  // message: the current user message
  // mode: 'coach' (answer questions from data) or 'intake' (interview the user)
  const { message, history = [], mode = 'coach' } = await req.json()
  const isIntake = mode === 'intake'

  // The system instruction is where the agent's STRATEGY lives. Same loop,
  // same model — swapping this prompt + toolset turns a Q&A bot into an
  // interviewer that drives the conversation itself.
  const COACH_PROMPT = `You are a personal skin health coach. You have access to the user's acne tracking data via tools.

When asked a question:
1. Call the relevant tools to get their actual data — never answer from generic knowledge alone
2. If the question needs multiple data points (e.g. "what's causing my flares?" needs both food and stress data), call multiple tools
3. Call get_lifestyle_profile to read what the user told you about their habits and known triggers — use it to personalize answers
4. Ground every answer in specific numbers from their data
5. Be concise: 2–3 sentences unless the user asks for more detail
6. End with one concrete, actionable suggestion when relevant

If there's not enough data yet, say what they should start logging to get better insights.`

  const INTAKE_PROMPT = `You are conducting a friendly intake interview to understand someone's lifestyle as it relates to ACNE.

The user's FIRST message is a free-form description of their daily schedule and lifestyle. Your job:
1. Read what they wrote and figure out which acne-relevant factors are still unclear or missing.
2. Ask exactly ONE short follow-up question at a time (max ~15 words). Wait for their answer before asking the next.
3. Only ask about things that plausibly affect acne: dairy intake, sugar / high-glycemic foods, water, sleep amount & consistency, stress, exercise and whether they cleanse after sweating, current skincare routine (cleanser / actives / moisturizer / SPF), frequently touching face or phone, hormonal or menstrual patterns, recent new products, medications & supplements, alcohol, smoking.
4. Never re-ask something they already told you. Never ask multiple questions in one message.
5. After about 4–6 useful answers (or sooner if you clearly have enough), call save_lifestyle_profile with a concise summary and their most likely triggers. Then confirm it's saved and tell them the 2–3 things most worth logging daily.

Be warm and concise. One question per message.`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: isIntake ? INTAKE_PROMPT : COACH_PROMPT,
    tools: [{ functionDeclarations: isIntake ? INTAKE_TOOLS : COACH_TOOLS }],
  })

  // Convert client history (simple {role, content}) to Gemini format
  const geminiHistory = history.map((m: { role: string; content: string }) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))

  const chat = model.startChat({ history: geminiHistory })

  // ─── The agent loop ───────────────────────────────────────────────────────
  // The LLM runs, decides if it needs to call tools, we execute them,
  // feed results back, repeat until it produces a final text answer.

  let result = await chat.sendMessage(message)
  const MAX_TOOL_ROUNDS = 5  // safety limit

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const functionCalls = result.response.functionCalls()

    // No tool calls → the LLM has a final answer, we're done
    if (!functionCalls || functionCalls.length === 0) break

    // Execute every tool the LLM requested (it can request multiple at once)
    const toolResults = await Promise.all(
      functionCalls.map(async (fc) => ({
        functionResponse: {
          name: fc.name,
          response: {
            result: await executeTool(fc.name, fc.args as Record<string, unknown>, supabase, user.id),
          },
        },
      }))
    )

    // Send tool results back — the LLM will now decide to call more tools or answer
    result = await chat.sendMessage(toolResults)
  }

  return NextResponse.json({ response: result.response.text() })
}
