'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/utils'
import PhotoUpload from '@/components/PhotoUpload'
import SeverityMeter from '@/components/SeverityMeter'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X, Plus, Flame, ChevronDown, ChevronUp } from 'lucide-react'
import type { GeminiAnalysis, SkincareProduct, Medication } from '@/types'

interface DietItem { food: string; isTrigger: boolean }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-2xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-4 text-left"
      >
        <span className="font-semibold text-neutral-900">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-neutral-400" /> : <ChevronDown className="h-4 w-4 text-neutral-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function NewLogPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [logDate] = useState(todayISO())

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [aiSeverity, setAiSeverity] = useState<number | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [userSeverity, setUserSeverity] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const [dietItems, setDietItems] = useState<DietItem[]>([])
  const [dietInput, setDietInput] = useState('')

  const [products, setProducts] = useState<SkincareProduct[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [newProductName, setNewProductName] = useState('')

  const [medications, setMedications] = useState<Medication[]>([])
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set())
  const [newMedName, setNewMedName] = useState('')

  const [sleep, setSleep] = useState('')
  const [stress, setStress] = useState(5)
  const [exercise, setExercise] = useState('')
  const [water, setWater] = useState('')
  const [cycleDay, setCycleDay] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        supabase.from('skincare_products').select('*').eq('user_id', user.id).order('name')
          .then(({ data }) => { if (data) setProducts(data) })
        supabase.from('medications').select('*').eq('user_id', user.id).order('name')
          .then(({ data }) => { if (data) setMedications(data) })
      }
    })
  }, [])

  function handleAnalysis(analysis: GeminiAnalysis, url: string) {
    setPhotoUrl(url)
    setAiSeverity(analysis.severity)
    setAiSummary(analysis.summary)
    setUserSeverity(analysis.severity)
  }

  function addDiet() {
    if (!dietInput.trim()) return
    setDietItems((p) => [...p, { food: dietInput.trim(), isTrigger: false }])
    setDietInput('')
  }

  async function addProduct() {
    if (!newProductName.trim() || !userId) return
    const supabase = createClient()
    const { data } = await supabase.from('skincare_products')
      .insert({ user_id: userId, name: newProductName.trim() }).select().single()
    if (data) { setProducts((p) => [...p, data]); setSelectedProducts((s) => new Set([...s, data.id])) }
    setNewProductName('')
  }

  async function addMed() {
    if (!newMedName.trim() || !userId) return
    const supabase = createClient()
    const { data } = await supabase.from('medications')
      .insert({ user_id: userId, name: newMedName.trim() }).select().single()
    if (data) { setMedications((m) => [...m, data]); setSelectedMeds((s) => new Set([...s, data.id])) }
    setNewMedName('')
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
    if (dietItems.length > 0) {
      await supabase.from('diet_entries').delete().eq('log_id', id)
      await supabase.from('diet_entries').insert(dietItems.map((d) => ({ log_id: id, food_item: d.food, is_trigger: d.isTrigger })))
    }
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
      exercise_minutes: exercise ? parseInt(exercise) : null,
      water_glasses: water ? parseInt(water) : null,
      menstrual_cycle_day: cycleDay ? parseInt(cycleDay) : null,
    })

    toast.success('Log saved!')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">Today's Log</h1>
        <p className="text-sm text-neutral-400 mt-0.5">
          {new Date(logDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="px-4 space-y-3 pb-6">

        {/* Photo + AI */}
        <div className="rounded-2xl bg-white overflow-hidden p-4 space-y-4">
          {userId && <PhotoUpload userId={userId} onAnalysis={handleAnalysis} existingPhotoUrl={photoUrl} />}
          {aiSummary && (
            <p className="text-sm text-neutral-500 italic bg-neutral-50 rounded-xl px-3 py-2.5">"{aiSummary}"</p>
          )}
          {(aiSeverity !== null || userSeverity !== null || photoUrl) && (
            <SeverityMeter aiSeverity={aiSeverity} userSeverity={userSeverity ?? 5} onChange={setUserSeverity} />
          )}
        </div>

        {/* Diet */}
        <Section title="🥗 Diet">
          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400 transition-colors"
              placeholder="Add food item…"
              value={dietInput}
              onChange={(e) => setDietInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDiet())}
            />
            <button onClick={addDiet} className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {dietItems.map((item, i) => (
              <span key={i}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
                style={{ background: item.isTrigger ? '#FEE2E2' : '#F3F4F6', color: item.isTrigger ? '#991B1B' : '#374151' }}
              >
                <button onClick={() => setDietItems((p) => p.map((d, idx) => idx === i ? { ...d, isTrigger: !d.isTrigger } : d))}>
                  <Flame className="h-3.5 w-3.5" style={{ color: item.isTrigger ? '#EF4444' : '#9CA3AF' }} />
                </button>
                {item.food}
                <button onClick={() => setDietItems((p) => p.filter((_, idx) => idx !== i))}>
                  <X className="h-3.5 w-3.5 opacity-50" />
                </button>
              </span>
            ))}
            {dietItems.length === 0 && <p className="text-sm text-neutral-400">Tap flame 🔥 to mark triggers</p>}
          </div>
        </Section>

        {/* Skincare */}
        <Section title="✨ Skincare">
          <div className="flex flex-wrap gap-2 mb-3">
            {products.map((p) => (
              <button key={p.id} onClick={() => setSelectedProducts((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ background: selectedProducts.has(p.id) ? '#1a1a1a' : '#F3F4F6', color: selectedProducts.has(p.id) ? '#fff' : '#374151' }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
              placeholder="Add product…" value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProduct())} />
            <button onClick={addProduct} className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Section>

        {/* Medications */}
        <Section title="💊 Medications">
          <div className="flex flex-wrap gap-2 mb-3">
            {medications.map((m) => (
              <button key={m.id} onClick={() => setSelectedMeds((s) => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })}
                className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ background: selectedMeds.has(m.id) ? '#1a1a1a' : '#F3F4F6', color: selectedMeds.has(m.id) ? '#fff' : '#374151' }}
              >
                {m.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
              placeholder="Add medication…" value={newMedName} onChange={(e) => setNewMedName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMed())} />
            <button onClick={addMed} className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Section>

        {/* Lifestyle */}
        <Section title="🌙 Lifestyle">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Sleep (hrs)', val: sleep, set: setSleep, placeholder: '7.5', type: 'number', step: '0.5' },
              { label: 'Water (glasses)', val: water, set: setWater, placeholder: '8', type: 'number', step: '1' },
              { label: 'Exercise (min)', val: exercise, set: setExercise, placeholder: '30', type: 'number', step: '5' },
              { label: 'Cycle day', val: cycleDay, set: setCycleDay, placeholder: '1–28', type: 'number', step: '1' },
            ].map(({ label, val, set, placeholder, type, step }) => (
              <div key={label}>
                <p className="text-xs text-neutral-400 font-medium mb-1">{label}</p>
                <input type={type} step={step} placeholder={placeholder} value={val}
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

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-4 rounded-2xl bg-neutral-900 text-white font-semibold text-base disabled:opacity-50 active:scale-[0.98] transition-transform">
          {saving ? 'Saving…' : 'Save Log'}
        </button>
      </div>

      <div className="bottom-nav-spacer" />
    </div>
  )
}
