'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/utils'
import PhotoUpload from '@/components/PhotoUpload'
import SeverityMeter from '@/components/SeverityMeter'
import { Textarea } from '@/components/ui/textarea'
import { X, Plus, Flame, ChevronDown, ChevronUp, Copy, Loader2 } from 'lucide-react'
import type { GeminiAnalysis, SkincareProduct, Medication, MealType } from '@/types'
import { WORKOUT_TYPES, WORKOUT_INTENSITIES } from '@/types'

interface DietItem { food: string; isTrigger: boolean; meal: MealType }

const MEALS: { key: MealType; emoji: string; label: string }[] = [
  { key: 'breakfast', emoji: '🌅', label: 'Breakfast' },
  { key: 'lunch',     emoji: '☀️', label: 'Lunch' },
  { key: 'dinner',    emoji: '🌙', label: 'Dinner' },
  { key: 'snack',     emoji: '🍎', label: 'Snack' },
]

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl bg-white overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-4 text-left">
        <span className="font-semibold text-neutral-900 text-[15px]">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-neutral-400" /> : <ChevronDown className="h-4 w-4 text-neutral-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function FoodAddRow({ placeholder, foodHistory, onAdd }: {
  placeholder: string
  foodHistory: string[]
  onAdd: (val: string) => void
}) {
  const [val, setVal] = useState('')
  const [open, setOpen] = useState(false)

  const suggestions = val.trim().length > 0
    ? foodHistory.filter((f) => f.toLowerCase().includes(val.toLowerCase())).slice(0, 5)
    : []

  function commit(text: string) {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setVal('')
    setOpen(false)
  }

  return (
    <div className="relative mt-2">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400 transition-colors"
          placeholder={placeholder}
          value={val}
          onChange={(e) => { setVal(e.target.value); setOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(val) } }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <button
          onClick={() => commit(val)}
          className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-12 top-full mt-1 bg-white rounded-xl border border-neutral-100 shadow-lg overflow-hidden z-10">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => commit(s)}
              className="w-full text-left px-3 py-2.5 text-sm text-neutral-700 flex items-center gap-2 border-b border-neutral-50 last:border-0 hover:bg-neutral-50"
            >
              <span className="text-[10px] text-neutral-300">↩</span>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewLogPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copyingYesterday, setCopyingYesterday] = useState(false)
  const [logDate] = useState(todayISO())

  // Photo + AI
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [aiSeverity, setAiSeverity] = useState<number | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [userSeverity, setUserSeverity] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  // Diet — per meal + history for autocomplete
  const [dietItems, setDietItems] = useState<DietItem[]>([])
  const [foodHistory, setFoodHistory] = useState<string[]>([])

  // Skincare + meds
  const [products, setProducts] = useState<SkincareProduct[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [medications, setMedications] = useState<Medication[]>([])
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set())

  // Lifestyle
  const [sleep, setSleep] = useState('')
  const [stress, setStress] = useState(5)
  const [water, setWater] = useState('')
  const [cycleDay, setCycleDay] = useState('')
  const [workoutType, setWorkoutType] = useState('')
  const [workoutMins, setWorkoutMins] = useState('')
  const [workoutIntensity, setWorkoutIntensity] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const [{ data: prods }, { data: meds }, { data: recentLogs }] = await Promise.all([
        supabase.from('skincare_products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('medications').select('*').eq('user_id', user.id).order('name'),
        supabase.from('daily_logs').select('id').eq('user_id', user.id)
          .order('log_date', { ascending: false }).limit(90),
      ])

      if (prods) setProducts(prods)
      if (meds) setMedications(meds)

      if (recentLogs && recentLogs.length > 0) {
        const { data: foodData } = await supabase
          .from('diet_entries')
          .select('food_item')
          .in('log_id', recentLogs.map((l) => l.id))

        if (foodData) {
          const seen = new Set<string>()
          const unique: string[] = []
          for (const row of foodData) {
            const key = row.food_item.toLowerCase()
            if (!seen.has(key)) { seen.add(key); unique.push(row.food_item) }
          }
          setFoodHistory(unique)
        }
      }
    })
  }, [])

  function handleAnalysis(analysis: GeminiAnalysis, url: string) {
    setPhotoUrl(url)
    setAiSeverity(analysis.severity)
    setAiSummary(analysis.summary)
    setUserSeverity(analysis.severity)
  }

  async function copyYesterdayRoutine() {
    if (!userId) return
    setCopyingYesterday(true)
    const supabase = createClient()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yDate = yesterday.toISOString().split('T')[0]

    const { data: yLog } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('log_date', yDate)
      .single()

    if (!yLog) {
      toast.info('No log found for yesterday')
      setCopyingYesterday(false)
      return
    }

    const [{ data: skincare }, { data: meds }, { data: diet }] = await Promise.all([
      supabase.from('log_skincare').select('product_id').eq('log_id', yLog.id),
      supabase.from('log_medications').select('medication_id').eq('log_id', yLog.id),
      supabase.from('diet_entries').select('food_item, is_trigger, meal_type').eq('log_id', yLog.id),
    ])

    let count = 0
    if (skincare && skincare.length > 0) {
      setSelectedProducts(new Set(skincare.map((s) => s.product_id)))
      count += skincare.length
    }
    if (meds && meds.length > 0) {
      setSelectedMeds(new Set(meds.map((m) => m.medication_id)))
      count += meds.length
    }
    if (diet && diet.length > 0) {
      setDietItems(diet.map((d) => ({
        food: d.food_item,
        meal: (d.meal_type ?? 'meal') as MealType,
        isTrigger: d.is_trigger,
      })))
      count += diet.length
    }

    setCopyingYesterday(false)
    if (count === 0) toast.info("Yesterday's log was empty")
    else toast.success(`Copied ${count} item${count !== 1 ? 's' : ''} from yesterday`)
  }

  function addFood(meal: MealType, food: string) {
    setDietItems((p) => [...p, { food, meal, isTrigger: false }])
  }

  function toggleTrigger(i: number) {
    setDietItems((p) => p.map((d, idx) => idx === i ? { ...d, isTrigger: !d.isTrigger } : d))
  }

  function toggleProduct(id: string) {
    setSelectedProducts((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleMed(id: string) {
    setSelectedMeds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()

    const { data: log, error } = await supabase.from('daily_logs').upsert({
      user_id: userId, log_date: logDate, photo_url: photoUrl,
      ai_severity: aiSeverity, user_severity: userSeverity,
      ai_summary: aiSummary, notes: notes.trim() || null,
    }, { onConflict: 'user_id,log_date' }).select().single()

    if (error || !log) { toast.error('Failed to save'); setSaving(false); return }

    const id = log.id
    await supabase.from('diet_entries').delete().eq('log_id', id)
    if (dietItems.length > 0)
      await supabase.from('diet_entries').insert(
        dietItems.map((d) => ({ log_id: id, food_item: d.food, is_trigger: d.isTrigger, meal_type: d.meal }))
      )

    await supabase.from('log_skincare').delete().eq('log_id', id)
    if (selectedProducts.size > 0)
      await supabase.from('log_skincare').insert([...selectedProducts].map((pid) => ({ log_id: id, product_id: pid })))

    await supabase.from('log_medications').delete().eq('log_id', id)
    if (selectedMeds.size > 0)
      await supabase.from('log_medications').insert([...selectedMeds].map((mid) => ({ log_id: id, medication_id: mid, taken: true })))

    await supabase.from('lifestyle_factors').upsert({
      log_id: id,
      sleep_hours: sleep ? parseFloat(sleep) : null,
      stress_level: stress,
      exercise_minutes: workoutMins ? parseInt(workoutMins) : null,
      water_glasses: water ? parseInt(water) : null,
      menstrual_cycle_day: cycleDay ? parseInt(cycleDay) : null,
      workout_type: workoutType || null,
      workout_intensity: workoutIntensity || null,
    })

    toast.success('Log saved!')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="px-4 pt-5 pb-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today's Log</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {new Date(logDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={copyYesterdayRoutine}
          disabled={copyingYesterday || !userId}
          className="flex items-center gap-1.5 rounded-xl bg-white border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 active:scale-95 transition-all disabled:opacity-40 mt-1 flex-shrink-0"
        >
          {copyingYesterday
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Copy className="h-3.5 w-3.5" />}
          Copy yesterday
        </button>
      </div>

      <div className="px-4 space-y-3 pb-6">

        {/* Photo + AI */}
        <div className="rounded-2xl bg-white overflow-hidden p-4 space-y-4">
          {userId && <PhotoUpload userId={userId} onAnalysis={handleAnalysis} existingPhotoUrl={photoUrl} />}
          {aiSummary && (
            <p className="text-sm text-neutral-500 italic bg-neutral-50 rounded-xl px-3 py-2.5">"{aiSummary}"</p>
          )}
          <SeverityMeter aiSeverity={aiSeverity} userSeverity={userSeverity} onChange={setUserSeverity} />
        </div>

        {/* Meals */}
        <Section title="🍽️ Meals">
          <p className="text-xs text-neutral-400 mb-3">Add what you ate — tap 🔥 to mark suspected triggers</p>
          {MEALS.map(({ key, emoji, label }) => {
            const items = dietItems.filter((d) => d.meal === key)
            return (
              <div key={key} className="mb-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">{emoji} {label}</p>
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {items.map((item, gi) => {
                    const i = dietItems.indexOf(item)
                    return (
                      <span key={gi}
                        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ background: item.isTrigger ? '#FEE2E2' : '#F3F4F6', color: item.isTrigger ? '#991B1B' : '#374151' }}
                      >
                        <button onClick={() => toggleTrigger(i)} title="Mark as trigger">
                          <Flame className="h-3 w-3" style={{ color: item.isTrigger ? '#EF4444' : '#D1D5DB' }} />
                        </button>
                        {item.food}
                        <button onClick={() => setDietItems((p) => p.filter((_, idx) => idx !== i))}>
                          <X className="h-3 w-3 opacity-40" />
                        </button>
                      </span>
                    )
                  })}
                  {items.length === 0 && <span className="text-xs text-neutral-300">Nothing added yet</span>}
                </div>
                <FoodAddRow
                  placeholder={`Add ${label.toLowerCase()} item…`}
                  foodHistory={foodHistory}
                  onAdd={(v) => addFood(key, v)}
                />
              </div>
            )
          })}
        </Section>

        {/* Skincare */}
        <Section title="✨ Skincare used today">
          {products.length === 0 ? (
            <p className="text-sm text-neutral-400">Add products in Settings first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {products.map((p) => (
                <button key={p.id} onClick={() => toggleProduct(p.id)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-all active:scale-95"
                  style={{ background: selectedProducts.has(p.id) ? '#1a1a1a' : '#F3F4F6', color: selectedProducts.has(p.id) ? '#fff' : '#374151' }}
                >
                  {p.name}
                  {p.frequency && (
                    <span className="ml-1 text-[10px] opacity-60">
                      {p.frequency === 'morning' ? '🌅' : p.frequency === 'evening' ? '🌙' : p.frequency === 'morning_and_evening' ? '🌅🌙' : ''}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Medications */}
        <Section title="💊 Medications & supplements">
          {medications.length === 0 ? (
            <p className="text-sm text-neutral-400">Add medications in Settings first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {medications.map((m) => (
                <button key={m.id} onClick={() => toggleMed(m.id)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-all active:scale-95"
                  style={{ background: selectedMeds.has(m.id) ? '#1a1a1a' : '#F3F4F6', color: selectedMeds.has(m.id) ? '#fff' : '#374151' }}
                >
                  {m.name}
                  {m.dosage && <span className="ml-1 text-[10px] opacity-60">{m.dosage}</span>}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Workout */}
        <Section title="🏃 Workout" defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-neutral-400 font-medium mb-2">Type</p>
              <div className="flex flex-wrap gap-2">
                {WORKOUT_TYPES.map(({ value, label }) => (
                  <button key={value} onClick={() => setWorkoutType(workoutType === value ? '' : value)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-all active:scale-95"
                    style={{ background: workoutType === value ? '#1a1a1a' : '#F3F4F6', color: workoutType === value ? '#fff' : '#374151' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {workoutType && (
              <>
                <div>
                  <p className="text-xs text-neutral-400 font-medium mb-2">Intensity</p>
                  <div className="flex gap-2">
                    {WORKOUT_INTENSITIES.map(({ value, label }) => (
                      <button key={value} onClick={() => setWorkoutIntensity(workoutIntensity === value ? '' : value)}
                        className="flex-1 rounded-xl py-2 text-sm font-medium transition-all active:scale-95"
                        style={{ background: workoutIntensity === value ? '#1a1a1a' : '#F3F4F6', color: workoutIntensity === value ? '#fff' : '#374151' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium mb-1">Duration (minutes)</p>
                  <input type="number" min="0" step="5" placeholder="45" value={workoutMins}
                    onChange={(e) => setWorkoutMins(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400" />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Lifestyle */}
        <Section title="🌙 Sleep & wellness" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Sleep (hrs)', val: sleep, set: setSleep, placeholder: '7.5', step: '0.5' },
              { label: 'Water (glasses)', val: water, set: setWater, placeholder: '8', step: '1' },
              { label: 'Cycle day (opt.)', val: cycleDay, set: setCycleDay, placeholder: '1–28', step: '1' },
            ].map(({ label, val, set, placeholder, step }) => (
              <div key={label}>
                <p className="text-xs text-neutral-400 font-medium mb-1">{label}</p>
                <input type="number" step={step} placeholder={placeholder} value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400" />
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <p className="text-xs text-neutral-400 font-medium">Stress level</p>
              <p className="text-xs font-semibold text-neutral-700">{stress}/10</p>
            </div>
            <input type="range" min="1" max="10" value={stress} onChange={(e) => setStress(Number(e.target.value))}
              className="w-full accent-neutral-800 h-1" />
            <div className="flex justify-between text-[10px] text-neutral-300 mt-1">
              <span>Calm</span><span>Stressed</span>
            </div>
          </div>
        </Section>

        {/* Notes */}
        <div className="rounded-2xl bg-white overflow-hidden p-4">
          <p className="text-sm font-medium text-neutral-400 mb-2">Notes</p>
          <Textarea placeholder="Anything else worth noting?" value={notes}
            onChange={(e) => setNotes(e.target.value)} rows={3}
            className="border-0 bg-neutral-50 rounded-xl resize-none focus-visible:ring-0 text-sm" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-4 rounded-2xl bg-neutral-900 text-white font-semibold text-base disabled:opacity-50 active:scale-[0.98] transition-transform">
          {saving ? 'Saving…' : 'Save Log'}
        </button>
      </div>

      <div className="bottom-nav-spacer" />
    </div>
  )
}
