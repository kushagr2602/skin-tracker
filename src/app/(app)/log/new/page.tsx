'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/utils'
import PhotoUpload from '@/components/PhotoUpload'
import SeverityMeter from '@/components/SeverityMeter'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { X, Plus, Flame } from 'lucide-react'
import type { GeminiAnalysis, SkincareProduct, Medication } from '@/types'

interface DietItem { food: string; isTrigger: boolean }

export default function NewLogPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [logDate] = useState(todayISO())

  // Photo + AI
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [aiSeverity, setAiSeverity] = useState<number | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [userSeverity, setUserSeverity] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  // Diet
  const [dietItems, setDietItems] = useState<DietItem[]>([])
  const [dietInput, setDietInput] = useState('')

  // Skincare
  const [products, setProducts] = useState<SkincareProduct[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategory, setNewProductCategory] = useState('')

  // Medications
  const [medications, setMedications] = useState<Medication[]>([])
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set())
  const [newMedName, setNewMedName] = useState('')
  const [newMedType, setNewMedType] = useState('')

  // Lifestyle
  const [sleep, setSleep] = useState<string>('')
  const [stress, setStress] = useState<number>(5)
  const [exercise, setExercise] = useState<string>('')
  const [water, setWater] = useState<string>('')
  const [cycleDay, setCycleDay] = useState<string>('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        loadLibraries(supabase, user.id)
      }
    })
  }, [])

  async function loadLibraries(supabase: ReturnType<typeof createClient>, uid: string) {
    const [{ data: prods }, { data: meds }] = await Promise.all([
      supabase.from('skincare_products').select('*').eq('user_id', uid).order('name'),
      supabase.from('medications').select('*').eq('user_id', uid).order('name'),
    ])
    if (prods) setProducts(prods)
    if (meds) setMedications(meds)
  }

  function handleAnalysis(analysis: GeminiAnalysis, url: string) {
    setPhotoUrl(url)
    setAiSeverity(analysis.severity)
    setAiSummary(analysis.summary)
    setUserSeverity(analysis.severity)
  }

  function addDietItem() {
    if (!dietInput.trim()) return
    setDietItems((prev) => [...prev, { food: dietInput.trim(), isTrigger: false }])
    setDietInput('')
  }

  function toggleTrigger(i: number) {
    setDietItems((prev) => prev.map((d, idx) => idx === i ? { ...d, isTrigger: !d.isTrigger } : d))
  }

  function removeDietItem(i: number) {
    setDietItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function addProduct() {
    if (!newProductName.trim() || !userId) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('skincare_products')
      .insert({ user_id: userId, name: newProductName.trim(), category: newProductCategory.trim() || null })
      .select()
      .single()

    if (!error && data) {
      setProducts((prev) => [...prev, data])
      setSelectedProducts((prev) => new Set([...prev, data.id]))
      setNewProductName('')
      setNewProductCategory('')
    }
  }

  async function addMedication() {
    if (!newMedName.trim() || !userId) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('medications')
      .insert({ user_id: userId, name: newMedName.trim(), type: newMedType.trim() || null })
      .select()
      .single()

    if (!error && data) {
      setMedications((prev) => [...prev, data])
      setSelectedMeds((prev) => new Set([...prev, data.id]))
      setNewMedName('')
      setNewMedType('')
    }
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)

    const supabase = createClient()

    // Upsert daily log
    const { data: log, error: logError } = await supabase
      .from('daily_logs')
      .upsert({
        user_id: userId,
        log_date: logDate,
        photo_url: photoUrl,
        ai_severity: aiSeverity,
        user_severity: userSeverity,
        ai_summary: aiSummary,
        notes: notes.trim() || null,
      }, { onConflict: 'user_id,log_date' })
      .select()
      .single()

    if (logError || !log) {
      toast.error('Failed to save log: ' + logError?.message)
      setSaving(false)
      return
    }

    const logId = log.id

    // Save diet entries
    if (dietItems.length > 0) {
      await supabase.from('diet_entries').delete().eq('log_id', logId)
      await supabase.from('diet_entries').insert(
        dietItems.map((d) => ({ log_id: logId, food_item: d.food, is_trigger: d.isTrigger }))
      )
    }

    // Save skincare
    await supabase.from('log_skincare').delete().eq('log_id', logId)
    if (selectedProducts.size > 0) {
      await supabase.from('log_skincare').insert(
        [...selectedProducts].map((pid) => ({ log_id: logId, product_id: pid }))
      )
    }

    // Save medications
    await supabase.from('log_medications').delete().eq('log_id', logId)
    if (selectedMeds.size > 0) {
      await supabase.from('log_medications').insert(
        [...selectedMeds].map((mid) => ({ log_id: logId, medication_id: mid, taken: true }))
      )
    }

    // Save lifestyle
    await supabase.from('lifestyle_factors').upsert({
      log_id: logId,
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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Today's Log</h1>
        <p className="text-sm text-neutral-500 mt-1">{new Date(logDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Photo Section */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {userId && (
            <PhotoUpload userId={userId} onAnalysis={handleAnalysis} existingPhotoUrl={photoUrl} />
          )}
          {(aiSeverity !== null || userSeverity !== null) && (
            <>
              {aiSummary && (
                <p className="text-sm text-neutral-600 bg-neutral-50 rounded-lg p-3 italic">
                  "{aiSummary}"
                </p>
              )}
              <SeverityMeter
                aiSeverity={aiSeverity}
                userSeverity={userSeverity}
                onChange={setUserSeverity}
              />
            </>
          )}
          {photoUrl && aiSeverity === null && (
            <SeverityMeter aiSeverity={null} userSeverity={userSeverity ?? 5} onChange={setUserSeverity} />
          )}
        </CardContent>
      </Card>

      {/* Factor Tabs */}
      <Tabs defaultValue="diet">
        <TabsList className="w-full">
          <TabsTrigger value="diet" className="flex-1">Diet</TabsTrigger>
          <TabsTrigger value="skincare" className="flex-1">Skincare</TabsTrigger>
          <TabsTrigger value="meds" className="flex-1">Meds</TabsTrigger>
          <TabsTrigger value="lifestyle" className="flex-1">Lifestyle</TabsTrigger>
        </TabsList>

        {/* Diet Tab */}
        <TabsContent value="diet" className="space-y-3 pt-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add food item…"
              value={dietInput}
              onChange={(e) => setDietInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDietItem())}
            />
            <Button variant="outline" size="icon" onClick={addDietItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {dietItems.map((item, i) => (
              <Badge
                key={i}
                variant={item.isTrigger ? 'destructive' : 'secondary'}
                className="flex items-center gap-1 px-2 py-1 cursor-pointer select-none"
              >
                <button onClick={() => toggleTrigger(i)} title="Mark as trigger" className="hover:opacity-70">
                  <Flame className={`h-3 w-3 ${item.isTrigger ? 'text-white' : 'text-neutral-400'}`} />
                </button>
                {item.food}
                <button onClick={() => removeDietItem(i)} className="ml-1 hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {dietItems.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-4">No food items yet. Tap flame icon to mark triggers.</p>
          )}
        </TabsContent>

        {/* Skincare Tab */}
        <TabsContent value="skincare" className="space-y-3 pt-3">
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <Badge
                key={p.id}
                variant={selectedProducts.has(p.id) ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSelectedProducts((prev) => {
                  const next = new Set(prev)
                  next.has(p.id) ? next.delete(p.id) : next.add(p.id)
                  return next
                })}
              >
                {p.name}
                {p.category && <span className="ml-1 opacity-60 text-xs">· {p.category}</span>}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Input placeholder="Product name" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
            <Input placeholder="Category (optional)" value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)} className="w-36" />
            <Button variant="outline" size="icon" onClick={addProduct}><Plus className="h-4 w-4" /></Button>
          </div>
        </TabsContent>

        {/* Meds Tab */}
        <TabsContent value="meds" className="space-y-3 pt-3">
          <div className="flex flex-wrap gap-2">
            {medications.map((m) => (
              <Badge
                key={m.id}
                variant={selectedMeds.has(m.id) ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSelectedMeds((prev) => {
                  const next = new Set(prev)
                  next.has(m.id) ? next.delete(m.id) : next.add(m.id)
                  return next
                })}
              >
                {m.name}
                {m.type && <span className="ml-1 opacity-60 text-xs">· {m.type}</span>}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Input placeholder="Medication name" value={newMedName} onChange={(e) => setNewMedName(e.target.value)} />
            <Input placeholder="Type (e.g. topical)" value={newMedType} onChange={(e) => setNewMedType(e.target.value)} className="w-36" />
            <Button variant="outline" size="icon" onClick={addMedication}><Plus className="h-4 w-4" /></Button>
          </div>
        </TabsContent>

        {/* Lifestyle Tab */}
        <TabsContent value="lifestyle" className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Sleep (hours)</Label>
              <Input type="number" min="0" max="24" step="0.5" placeholder="7.5" value={sleep} onChange={(e) => setSleep(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Water (glasses)</Label>
              <Input type="number" min="0" max="30" placeholder="8" value={water} onChange={(e) => setWater(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Exercise (minutes)</Label>
              <Input type="number" min="0" placeholder="30" value={exercise} onChange={(e) => setExercise(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cycle day (optional)</Label>
              <Input type="number" min="1" max="40" placeholder="Day 1–28" value={cycleDay} onChange={(e) => setCycleDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Stress level: {stress}/10</Label>
            <input
              type="range" min="1" max="10" value={stress}
              onChange={(e) => setStress(Number(e.target.value))}
              className="w-full accent-neutral-800"
            />
            <div className="flex justify-between text-xs text-neutral-400">
              <span>Calm (1)</span><span>Moderate (5)</span><span>Very stressed (10)</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea
          placeholder="Anything else worth noting today?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <Button className="w-full" size="lg" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Log'}
      </Button>
    </div>
  )
}
