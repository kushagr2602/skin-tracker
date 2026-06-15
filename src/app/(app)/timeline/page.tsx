import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { cn, severityBg, severityColor, severityLabel, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Camera } from 'lucide-react'
import type { DailyLog } from '@/types'

export default async function TimelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .limit(90)

  const allLogs: DailyLog[] = logs ?? []

  // Group by month
  const grouped: Record<string, DailyLog[]> = {}
  for (const log of allLogs) {
    const month = log.log_date.slice(0, 7)
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(log)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Timeline</h1>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-20 text-neutral-400">
          <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No logs yet. Start by logging today!</p>
        </div>
      )}

      {Object.entries(grouped).map(([month, monthLogs]) => {
        const [year, mo] = month.split('-')
        const label = new Date(parseInt(year), parseInt(mo) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

        return (
          <section key={month}>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">{label}</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {monthLogs.map((log) => {
                const sev = log.user_severity ?? log.ai_severity

                return (
                  <Link key={log.id} href={`/log/${log.log_date}`} className="group space-y-1">
                    <div className={cn(
                      'relative aspect-square rounded-xl overflow-hidden border-2',
                      sev ? severityBg(sev).replace('bg-', 'border-').split(' ')[1] : 'border-neutral-200'
                    )}>
                      {log.photo_url ? (
                        <Image
                          src={log.photo_url}
                          alt={log.log_date}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                          unoptimized
                        />
                      ) : (
                        <div className={cn('w-full h-full flex items-center justify-center', sev ? severityBg(sev) : 'bg-neutral-50')}>
                          <Camera className="h-6 w-6 text-neutral-300" />
                        </div>
                      )}
                      {sev && (
                        <div className="absolute bottom-1 right-1">
                          <Badge className={cn('text-xs px-1 py-0 font-bold', severityColor(sev))} variant="outline">
                            {sev}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 text-center">
                      {new Date(log.log_date + 'T00:00:00').getDate()}
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
