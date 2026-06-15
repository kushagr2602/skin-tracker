import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { cn, severityColor, severityLabel, formatDate, todayISO } from '@/lib/utils'
import { Plus, Flame, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'
import type { DailyLog } from '@/types'

function computeStreak(logs: DailyLog[]): number {
  if (logs.length === 0) return 0
  const sorted = [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date))
  const today = todayISO()
  let streak = 0
  let expected = today
  for (const log of sorted) {
    if (log.log_date === expected) {
      streak++
      const d = new Date(expected + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      expected = d.toISOString().split('T')[0]
    } else break
  }
  return streak
}

function sevBg(sev: number) {
  if (sev <= 2) return '#dcfce7'
  if (sev <= 4) return '#d9f99d'
  if (sev <= 6) return '#fef9c3'
  if (sev <= 8) return '#ffedd5'
  return '#fee2e2'
}

function sevDot(sev: number) {
  if (sev <= 2) return '#16a34a'
  if (sev <= 4) return '#65a30d'
  if (sev <= 6) return '#ca8a04'
  if (sev <= 8) return '#ea580c'
  return '#dc2626'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: logs } = await supabase
    .from('daily_logs').select('*').eq('user_id', user.id)
    .order('log_date', { ascending: false }).limit(30)

  const allLogs: DailyLog[] = logs ?? []
  const recent7 = allLogs.slice(0, 7)
  const photoStrip = allLogs.filter((l) => l.photo_url).slice(0, 5)
  const streak = computeStreak(allLogs)
  const todayLog = allLogs.find((l) => l.log_date === todayISO())

  const avgSeverity = recent7.length > 0
    ? recent7.reduce((s, l) => s + (l.user_severity ?? l.ai_severity ?? 0), 0) / recent7.length
    : null

  const trend = recent7.length >= 2
    ? (recent7[0].user_severity ?? recent7[0].ai_severity ?? 5) -
      (recent7[recent7.length - 1].user_severity ?? recent7[recent7.length - 1].ai_severity ?? 5)
    : 0

  const { data: dietData } = await supabase
    .from('diet_entries')
    .select('food_item, is_trigger, daily_logs!inner(user_id)')
    .eq('daily_logs.user_id', user.id)
    .eq('is_trigger', true).limit(100)

  const triggerCounts: Record<string, number> = {}
  dietData?.forEach((d) => { triggerCounts[d.food_item] = (triggerCounts[d.food_item] ?? 0) + 1 })
  const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <p className="text-sm text-neutral-500 font-medium">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-3xl font-bold tracking-tight mt-0.5">Dashboard</h1>
      </div>

      {/* Today CTA */}
      {!todayLog && (
        <div className="mx-4 mb-4">
          <Link href="/log/new" className="block">
            <div className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #404040 100%)' }}>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Today</p>
                <p className="text-white font-semibold text-lg mt-0.5">Log your skin</p>
                <p className="text-white/60 text-sm mt-0.5">Upload a photo + track factors</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Plus className="h-6 w-6 text-white" />
              </div>
            </div>
          </Link>
        </div>
      )}
      {todayLog && (
        <div className="mx-4 mb-4">
          <div className="rounded-2xl p-4 bg-white flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-xs font-medium uppercase tracking-wide">Today</p>
              <p className="font-semibold text-neutral-900 mt-0.5">Logged ✓</p>
            </div>
            <Link href={`/log/${todayISO()}`}>
              <ChevronRight className="h-5 w-5 text-neutral-400" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="px-4 mb-4 grid grid-cols-3 gap-3">
        {/* Streak */}
        <div className="rounded-2xl bg-white p-4 flex flex-col gap-1">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Streak</p>
          <p className="text-3xl font-bold text-neutral-900">{streak}</p>
          <p className="text-[11px] text-neutral-400">days</p>
        </div>

        {/* Avg severity */}
        <div className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: avgSeverity ? sevBg(Math.round(avgSeverity)) : '#fff' }}>
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">7d avg</p>
          <p className="text-3xl font-bold" style={{ color: avgSeverity ? sevDot(Math.round(avgSeverity)) : '#a3a3a3' }}>
            {avgSeverity ? avgSeverity.toFixed(1) : '—'}
          </p>
          <p className="text-[11px] text-neutral-500">{avgSeverity ? severityLabel(Math.round(avgSeverity)) : 'No data'}</p>
        </div>

        {/* Trend */}
        <div className="rounded-2xl bg-white p-4 flex flex-col gap-1">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Trend</p>
          <div className="text-2xl font-bold">
            {trend < -0.5 ? <TrendingDown className="h-7 w-7 text-green-500" />
              : trend > 0.5 ? <TrendingUp className="h-7 w-7 text-red-500" />
              : <Minus className="h-7 w-7 text-neutral-300" />}
          </div>
          <p className="text-[11px] text-neutral-400">
            {trend < -0.5 ? 'Improving' : trend > 0.5 ? 'Worsening' : 'Stable'}
          </p>
        </div>
      </div>

      {/* Recent photos */}
      {photoStrip.length > 0 && (
        <div className="mb-4">
          <div className="px-5 mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Recent photos</p>
            <Link href="/timeline" className="text-xs text-neutral-400 font-medium">See all</Link>
          </div>
          <div className="flex gap-3 pl-4 pr-4 overflow-x-auto pb-1 scrollbar-none">
            {photoStrip.map((log) => {
              const sev = log.user_severity ?? log.ai_severity
              return (
                <Link key={log.id} href={`/log/${log.log_date}`} className="shrink-0">
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden"
                    style={{ border: sev ? `2.5px solid ${sevDot(sev)}` : '2.5px solid #e5e7eb' }}>
                    <Image src={log.photo_url!} alt={log.log_date} fill className="object-cover" unoptimized />
                    {sev && (
                      <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ background: sevDot(sev) }}>
                        {sev}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-center text-neutral-400 mt-1">
                    {new Date(log.log_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 7-day history */}
      <div className="px-4 mb-4">
        <p className="text-sm font-semibold text-neutral-900 mb-2 px-1">Last 7 days</p>
        <div className="rounded-2xl bg-white overflow-hidden">
          {allLogs.length === 0 && (
            <div className="px-4 py-8 text-center text-neutral-400 text-sm">
              No logs yet.{' '}
              <Link href="/log/new" className="text-neutral-900 underline font-medium">Start today</Link>
            </div>
          )}
          {recent7.map((log, i) => {
            const sev = log.user_severity ?? log.ai_severity
            return (
              <Link key={log.id} href={`/log/${log.log_date}`}
                className={cn('flex items-center px-4 py-3.5 gap-3 active:bg-neutral-50 transition-colors',
                  i < recent7.length - 1 ? 'border-b border-neutral-100' : '')}
              >
                {sev ? (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: sevDot(sev) }}>
                    {sev}
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-neutral-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{formatDate(log.log_date)}</p>
                  {sev && <p className="text-xs text-neutral-400 mt-0.5">{severityLabel(sev)}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-300 shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Trigger alert */}
      {topTrigger && (
        <div className="mx-4 mb-4">
          <div className="rounded-2xl p-4 flex gap-3 items-start" style={{ background: '#FFF7ED' }}>
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-900">Possible trigger</p>
              <p className="text-sm text-orange-700 mt-0.5">
                <strong>{topTrigger[0]}</strong> flagged {topTrigger[1]}× — check Insights for impact.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}
