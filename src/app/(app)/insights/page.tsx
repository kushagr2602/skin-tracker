import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, severityColor } from '@/lib/utils'
import SeverityChart from '@/components/SeverityChart'
import type { DailyLog } from '@/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function InsightsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('*, diet_entries(*), lifestyle_factors(*)')
    .eq('user_id', user.id)
    .order('log_date', { ascending: true })
    .limit(90)

  const allLogs: DailyLog[] = logs ?? []

  const chartData = allLogs.map((l) => ({
    date: l.log_date.slice(5),
    severity: l.user_severity ?? l.ai_severity ?? null,
  })).filter((d) => d.severity !== null)

  // Day-of-week averages
  const byDay: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const log of allLogs) {
    const sev = log.user_severity ?? log.ai_severity
    if (sev) {
      const dow = new Date(log.log_date + 'T00:00:00').getDay()
      byDay[dow].push(sev)
    }
  }
  const dayAvgs = DAYS.map((d, i) => ({
    day: d,
    avg: byDay[i].length > 0 ? byDay[i].reduce((a, b) => a + b, 0) / byDay[i].length : null,
  }))

  // Food correlations (from diet_entries joined)
  const foodSeverityMap: Record<string, { withSevs: number[]; withoutSevs: number[] }> = {}
  const allFoods = new Set<string>()

  for (const log of logs ?? []) {
    const sev = log.user_severity ?? log.ai_severity
    if (!sev) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: Array<{ food_item: string }> = (log as any).diet_entries ?? []
    const foodsToday = new Set(entries.map((e) => e.food_item.toLowerCase()))
    allFoods.forEach((f) => {
      if (!foodSeverityMap[f]) foodSeverityMap[f] = { withSevs: [], withoutSevs: [] }
    })
    entries.forEach((e) => allFoods.add(e.food_item.toLowerCase()))
    allFoods.forEach((f) => {
      if (!foodSeverityMap[f]) foodSeverityMap[f] = { withSevs: [], withoutSevs: [] }
      if (foodsToday.has(f)) {
        foodSeverityMap[f].withSevs.push(sev)
      } else {
        foodSeverityMap[f].withoutSevs.push(sev)
      }
    })
  }

  const correlations = Object.entries(foodSeverityMap)
    .filter(([, v]) => v.withSevs.length >= 2)
    .map(([food, v]) => {
      const withAvg = v.withSevs.reduce((a, b) => a + b, 0) / v.withSevs.length
      const withoutAvg = v.withoutSevs.length > 0 ? v.withoutSevs.reduce((a, b) => a + b, 0) / v.withoutSevs.length : null
      return { food, withAvg, withoutAvg, count: v.withSevs.length, diff: withoutAvg !== null ? withAvg - withoutAvg : null }
    })
    .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0))
    .slice(0, 10)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Insights</h1>

      {allLogs.length < 3 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          Log at least 3 days to see patterns. You have {allLogs.length} so far.
        </div>
      )}

      {/* Severity Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Severity over time</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <SeverityChart data={chartData as Array<{ date: string; severity: number }>} />
          ) : (
            <p className="text-sm text-neutral-400 text-center py-8">No data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Day of Week */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Average severity by day of week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-24">
            {dayAvgs.map(({ day, avg }) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn('w-full rounded-t-sm', avg ? `bg-current ${severityColor(avg)}` : 'bg-neutral-100')}
                  style={{ height: avg ? `${(avg / 10) * 80}px` : '4px' }}
                />
                <span className="text-xs text-neutral-500">{day}</span>
                {avg && <span className={cn('text-xs font-medium', severityColor(avg))}>{avg.toFixed(1)}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Food Correlations */}
      {correlations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Food & severity correlations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {correlations.map(({ food, withAvg, withoutAvg, count, diff }) => (
                <div key={food} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium capitalize">{food}</span>
                    <span className="text-neutral-400 ml-2">({count} days)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(severityColor(Math.round(withAvg)))}>
                      With: {withAvg.toFixed(1)}
                    </Badge>
                    {withoutAvg !== null && (
                      <Badge variant="outline" className={cn(severityColor(Math.round(withoutAvg)))}>
                        Without: {withoutAvg.toFixed(1)}
                      </Badge>
                    )}
                    {diff !== null && (
                      <Badge variant={diff > 0.5 ? 'destructive' : diff < -0.5 ? 'default' : 'secondary'}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-400 mt-3">Positive diff = higher severity when you eat this food.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
