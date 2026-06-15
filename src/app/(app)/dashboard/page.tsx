import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, severityBg, severityColor, severityLabel, formatDate, todayISO } from '@/lib/utils'
import { Plus, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
    } else {
      break
    }
  }
  return streak
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .limit(30)

  const allLogs: DailyLog[] = logs ?? []
  const recent = allLogs.slice(0, 7)
  const photoStrip = allLogs.filter((l) => l.photo_url).slice(0, 5)
  const streak = computeStreak(allLogs)
  const todayLog = allLogs.find((l) => l.log_date === todayISO())

  const avgSeverity =
    recent.length > 0
      ? (recent.reduce((s, l) => s + (l.user_severity ?? l.ai_severity ?? 0), 0) / recent.length).toFixed(1)
      : null

  const trend = recent.length >= 2
    ? (recent[0].user_severity ?? recent[0].ai_severity ?? 5) -
      (recent[recent.length - 1].user_severity ?? recent[recent.length - 1].ai_severity ?? 5)
    : 0

  // Top trigger food
  const { data: dietData } = await supabase
    .from('diet_entries')
    .select('food_item, is_trigger, daily_logs!inner(user_id, user_severity, ai_severity)')
    .eq('daily_logs.user_id', user.id)
    .eq('is_trigger', true)
    .limit(100)

  const triggerCounts: Record<string, number> = {}
  dietData?.forEach((d) => {
    triggerCounts[d.food_item] = (triggerCounts[d.food_item] ?? 0) + 1
  })
  const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {!todayLog ? (
          <Button asChild>
            <Link href="/log/new">
              <Plus className="h-4 w-4 mr-2" />
              Log today
            </Link>
          </Button>
        ) : (
          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
            ✓ Today logged
          </Badge>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-neutral-500 uppercase tracking-wide">Streak</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold">{streak}d</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-neutral-500 uppercase tracking-wide">7-day avg</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={cn('text-3xl font-bold', avgSeverity ? severityColor(parseFloat(avgSeverity)) : '')}>
              {avgSeverity ?? '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-neutral-500 uppercase tracking-wide">Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex items-center gap-2">
            <div className="text-3xl font-bold">
              {trend < -0.5 ? (
                <TrendingDown className="h-7 w-7 text-green-600" />
              ) : trend > 0.5 ? (
                <TrendingUp className="h-7 w-7 text-red-500" />
              ) : (
                <Minus className="h-7 w-7 text-neutral-400" />
              )}
            </div>
            <span className="text-sm text-neutral-500">
              {trend < -0.5 ? 'Improving' : trend > 0.5 ? 'Worsening' : 'Stable'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Recent Photo Strip */}
      {photoStrip.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent photos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {photoStrip.map((log) => (
                <Link key={log.id} href={`/log/${log.log_date}`} className="shrink-0 group">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <Image src={log.photo_url!} alt={log.log_date} fill className="object-cover group-hover:scale-105 transition-transform" unoptimized />
                  </div>
                  <p className="text-xs text-center text-neutral-500 mt-1">
                    {formatDate(log.log_date).split(',')[0]}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 7-day log list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Last 7 days</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-4">
              No logs yet.{' '}
              <Link href="/log/new" className="underline">Start today!</Link>
            </p>
          )}
          {recent.map((log) => {
            const sev = log.user_severity ?? log.ai_severity
            return (
              <Link key={log.id} href={`/log/${log.log_date}`} className="block">
                <div className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2 hover:opacity-80 transition-opacity',
                  sev ? severityBg(sev) : 'bg-neutral-50 border-neutral-200'
                )}>
                  <span className="text-sm font-medium">{formatDate(log.log_date)}</span>
                  {sev ? (
                    <Badge variant="outline" className={cn('font-semibold', severityColor(sev))}>
                      {sev}/10 · {severityLabel(sev)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-neutral-400">No rating</Badge>
                  )}
                </div>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      {/* Top Trigger */}
      {topTrigger && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4 flex items-center gap-3">
            <Flame className="h-5 w-5 text-orange-500 shrink-0" />
            <p className="text-sm text-orange-800">
              <strong>{topTrigger[0]}</strong> has been flagged as a trigger{' '}
              <strong>{topTrigger[1]}×</strong> — consider tracking its impact in Insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
