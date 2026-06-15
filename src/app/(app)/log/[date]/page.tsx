import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, severityBg, severityColor, severityLabel, formatDate } from '@/lib/utils'
import { Edit, Flame, Droplets, Moon, Zap, Activity } from 'lucide-react'

export default async function LogViewPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: log } = await supabase
    .from('daily_logs')
    .select(`
      *,
      diet_entries(*),
      lifestyle_factors(*),
      log_skincare(product_id, skincare_products(id, name, category)),
      log_medications(medication_id, taken, medications(id, name, type))
    `)
    .eq('user_id', user.id)
    .eq('log_date', date)
    .single()

  if (!log) notFound()

  const sev = log.user_severity ?? log.ai_severity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logAny = log as any
  const dietEntries: Array<{ id: string; food_item: string; is_trigger: boolean }> = logAny.diet_entries ?? []
  const skincareItems: Array<{ skincare_products: { name: string; category: string | null } }> = logAny.log_skincare ?? []
  const medItems: Array<{ taken: boolean; medications: { name: string; type: string | null } }> = logAny.log_medications ?? []
  const lifestyle = logAny.lifestyle_factors

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{formatDate(date)}</h1>
          {sev && (
            <Badge variant="outline" className={cn('mt-1 font-semibold text-sm', severityColor(sev))}>
              {sev}/10 · {severityLabel(sev)}
            </Badge>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/log/new?date=${date}`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Photos */}
      {(log.photo_url || log.photo_url_right) && (
        log.photo_url && log.photo_url_right ? (
          <div className="grid grid-cols-2 gap-2">
            {[{ url: log.photo_url, label: 'Left' }, { url: log.photo_url_right, label: 'Right' }].map(({ url, label }) => (
              <div key={label} className="space-y-1">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide text-center">{label} side</p>
                <div className={cn('rounded-xl overflow-hidden border-2', sev ? severityBg(sev).split(' ')[1] : 'border-neutral-200')}>
                  <div className="relative aspect-square">
                    <Image src={url} alt={`${label} side`} fill className="object-cover" unoptimized />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn('rounded-xl overflow-hidden border-2', sev ? severityBg(sev).split(' ')[1] : 'border-neutral-200')}>
            <div className="relative aspect-[4/3]">
              <Image src={(log.photo_url || log.photo_url_right)!} alt="Skin photo" fill className="object-cover" unoptimized />
            </div>
          </div>
        )
      )}

      {/* AI Summary */}
      {log.ai_summary && (
        <Card className={cn('border', sev ? severityBg(sev) : '')}>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-neutral-600 mb-1">AI Assessment</p>
            <p className="text-sm italic text-neutral-700">"{log.ai_summary}"</p>
            {log.ai_severity && log.user_severity && log.ai_severity !== log.user_severity && (
              <p className="text-xs text-neutral-400 mt-2">
                AI score: {log.ai_severity}/10 · You overrode to {log.user_severity}/10
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {log.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-neutral-600 mb-1">Notes</p>
            <p className="text-sm text-neutral-700">{log.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Diet */}
      {dietEntries.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-neutral-600 mb-2">Diet</p>
            <div className="flex flex-wrap gap-2">
              {dietEntries.map((d) => (
                <Badge key={d.id} variant={d.is_trigger ? 'destructive' : 'secondary'} className="flex items-center gap-1">
                  {d.is_trigger && <Flame className="h-3 w-3" />}
                  {d.food_item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skincare */}
      {skincareItems.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-neutral-600 mb-2">Skincare used</p>
            <div className="flex flex-wrap gap-2">
              {skincareItems.map((s, i) => (
                <Badge key={i} variant="outline">
                  {s.skincare_products.name}
                  {s.skincare_products.category && <span className="ml-1 opacity-60">· {s.skincare_products.category}</span>}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meds */}
      {medItems.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-neutral-600 mb-2">Medications</p>
            <div className="flex flex-wrap gap-2">
              {medItems.map((m, i) => (
                <Badge key={i} variant={m.taken ? 'default' : 'secondary'}>
                  {m.medications.name}
                  {!m.taken && <span className="ml-1 opacity-60">(skipped)</span>}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lifestyle */}
      {lifestyle && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-neutral-600 mb-3">Lifestyle</p>
            <div className="grid grid-cols-2 gap-3">
              {lifestyle.sleep_hours != null && (
                <div className="flex items-center gap-2 text-sm">
                  <Moon className="h-4 w-4 text-indigo-400" />
                  <span className="text-neutral-500">Sleep</span>
                  <span className="font-medium">{lifestyle.sleep_hours}h</span>
                </div>
              )}
              {lifestyle.stress_level != null && (
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-neutral-500">Stress</span>
                  <span className="font-medium">{lifestyle.stress_level}/10</span>
                </div>
              )}
              {lifestyle.exercise_minutes != null && (
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-green-400" />
                  <span className="text-neutral-500">Exercise</span>
                  <span className="font-medium">{lifestyle.exercise_minutes}min</span>
                </div>
              )}
              {lifestyle.water_glasses != null && (
                <div className="flex items-center gap-2 text-sm">
                  <Droplets className="h-4 w-4 text-blue-400" />
                  <span className="text-neutral-500">Water</span>
                  <span className="font-medium">{lifestyle.water_glasses} glasses</span>
                </div>
              )}
              {lifestyle.menstrual_cycle_day != null && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-pink-400">⊙</span>
                  <span className="text-neutral-500">Cycle day</span>
                  <span className="font-medium">{lifestyle.menstrual_cycle_day}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
