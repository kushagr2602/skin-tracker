'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Loader2, Check, X, Circle } from 'lucide-react'

interface Suggestion {
  id: string
  title: string
  rationale: string | null
  category: string | null
  impact: string | null
  effort: string | null
  status: string
  source: string | null
  created_at: string
}

const IMPACT_COLOR: Record<string, string> = {
  high: '#DC2626', medium: '#CA8A04', low: '#6B7280',
}

export default function ImprovePage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [running, setRunning] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('suggestions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setSuggestions(data ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => { load() }, [load])

  async function runAgents() {
    setRunning(true)
    try {
      const res = await fetch('/api/improve', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Agent run failed'); return }
      toast.success('Agents finished — backlog updated')
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setRunning(false)
    }
  }

  async function setStatus(id: string, status: string) {
    const supabase = createClient()
    await supabase.from('suggestions').update({ status }).eq('id', id)
    setSuggestions((s) => s.map((x) => x.id === id ? { ...x, status } : x))
  }

  const open = suggestions.filter((s) => s.status === 'new')
  const closed = suggestions.filter((s) => s.status !== 'new')

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">Improve</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Two agents read your feedback &amp; usage, then propose what to build next.</p>
      </div>

      <div className="px-4 space-y-3 pb-6">
        {/* Run button */}
        <button onClick={runAgents} disabled={running}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-white py-4 font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform">
          {running
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyst → PM running…</>
            : <><Sparkles className="h-4 w-4" /> Run improvement agents</>}
        </button>

        {running && (
          <p className="text-center text-xs text-neutral-400">
            Agent 1 reads signals → Agent 2 writes proposals. Takes ~10–20s.
          </p>
        )}

        {/* Open suggestions */}
        {open.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide px-1">Backlog · {open.length}</p>
            {open.map((s) => (
              <SuggestionCard key={s.id} s={s}
                onDone={() => setStatus(s.id, 'done')}
                onDismiss={() => setStatus(s.id, 'dismissed')} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {loaded && suggestions.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center">
            <p className="text-sm text-neutral-500">No suggestions yet.</p>
            <p className="text-xs text-neutral-400 mt-1">Send some feedback (the 💬 button), log a few days, then run the agents.</p>
          </div>
        )}

        {/* Closed */}
        {closed.length > 0 && (
          <div className="space-y-2 pt-3">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide px-1">Done &amp; dismissed</p>
            {closed.map((s) => (
              <div key={s.id} className="rounded-xl bg-white/60 px-4 py-2.5 flex items-center gap-2">
                {s.status === 'done'
                  ? <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                  : <X className="h-3.5 w-3.5 text-neutral-300 flex-shrink-0" />}
                <span className={`text-sm ${s.status === 'done' ? 'text-neutral-500 line-through' : 'text-neutral-400 line-through'}`}>{s.title}</span>
                <button onClick={() => setStatus(s.id, 'new')} className="ml-auto text-[11px] text-neutral-400">restore</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bottom-nav-spacer" />
    </div>
  )
}

function SuggestionCard({ s, onDone, onDismiss }: { s: Suggestion; onDone: () => void; onDismiss: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="flex items-start gap-2">
        <Circle className="h-2 w-2 mt-1.5 flex-shrink-0" fill={IMPACT_COLOR[s.impact ?? 'low'] ?? '#6B7280'} stroke="none" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-neutral-900 leading-snug">{s.title}</p>
          {s.rationale && <p className="text-[13px] text-neutral-500 mt-1 leading-relaxed">{s.rationale}</p>}

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {s.category && <Badge>{s.category}</Badge>}
            {s.impact && <Badge>impact: {s.impact}</Badge>}
            {s.effort && <Badge>effort: {s.effort}</Badge>}
          </div>
          {s.source && <p className="text-[11px] text-neutral-400 mt-2 italic">📊 {s.source}</p>}

          <div className="flex gap-2 mt-3">
            <button onClick={onDone}
              className="flex items-center gap-1 rounded-lg bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium active:scale-95 transition-transform">
              <Check className="h-3 w-3" /> Mark done
            </button>
            <button onClick={onDismiss}
              className="flex items-center gap-1 rounded-lg bg-neutral-100 text-neutral-600 px-3 py-1.5 text-xs font-medium active:scale-95 transition-transform">
              <X className="h-3 w-3" /> Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-neutral-100 text-neutral-500 px-2 py-0.5 text-[11px] font-medium">{children}</span>
}
