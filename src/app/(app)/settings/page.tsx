'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Separator } from '@/components/ui/separator'
import { Trash2, Plus } from 'lucide-react'
import ProductPhotoIdentifier from '@/components/ProductPhotoIdentifier'
import type { SkincareProduct, Medication, Frequency, GeminiProductID } from '@/types'
import { FREQUENCY_LABELS } from '@/types'

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'morning', label: '🌅 Morning' },
  { value: 'evening', label: '🌙 Evening' },
  { value: 'morning_and_evening', label: '🌅🌙 AM & PM' },
  { value: 'once_daily', label: 'Once daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as_needed', label: 'As needed' },
]

function FreqSelect({ value, onChange }: { value: Frequency | null; onChange: (v: Frequency) => void }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value as Frequency)}
      className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 outline-none">
      <option value="">Frequency</option>
      {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
    </select>
  )
}

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [products, setProducts] = useState<SkincareProduct[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // New product form
  const [newProd, setNewProd] = useState({ name: '', category: '', frequency: '' as Frequency | '' })
  const [newProdPhoto, setNewProdPhoto] = useState<string | null>(null)

  // New med form
  const [newMed, setNewMed] = useState({ name: '', type: '', dosage: '', frequency: '' as Frequency | '' })
  const [newMedPhoto, setNewMedPhoto] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      setGeminiKey(user.user_metadata?.gemini_api_key ?? '')
      const [{ data: prods }, { data: meds }] = await Promise.all([
        supabase.from('skincare_products').select('*').eq('user_id', user.id).order('name'),
        supabase.from('medications').select('*').eq('user_id', user.id).order('name'),
      ])
      if (prods) setProducts(prods)
      if (meds) setMedications(meds)
    })
  }, [])

  async function saveGeminiKey() {
    setSavingKey(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ data: { gemini_api_key: geminiKey.trim() } })
    if (error) toast.error(error.message)
    else toast.success('Gemini API key saved!')
    setSavingKey(false)
  }

  function onProductIdentified(result: GeminiProductID, photoUrl: string) {
    setNewProdPhoto(photoUrl)
    if (result.name) setNewProd((p) => ({ ...p, name: result.name!, category: result.category, frequency: result.frequency_suggestion }))
  }

  function onMedIdentified(result: GeminiProductID, photoUrl: string) {
    setNewMedPhoto(photoUrl)
    if (result.name) setNewMed((m) => ({ ...m, name: result.name!, type: result.category, dosage: result.dosage ?? '', frequency: result.frequency_suggestion }))
  }

  async function addProduct() {
    if (!newProd.name.trim() || !userId) return
    const supabase = createClient()
    const { data } = await supabase.from('skincare_products').insert({
      user_id: userId,
      name: newProd.name.trim(),
      category: newProd.category || null,
      frequency: newProd.frequency || null,
      photo_url: newProdPhoto,
    }).select().single()
    if (data) {
      setProducts((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewProd({ name: '', category: '', frequency: '' })
      setNewProdPhoto(null)
    }
  }

  async function updateProductFreq(id: string, frequency: Frequency) {
    const supabase = createClient()
    await supabase.from('skincare_products').update({ frequency }).eq('id', id)
    setProducts((p) => p.map((x) => x.id === id ? { ...x, frequency } : x))
  }

  async function deleteProduct(id: string) {
    const supabase = createClient()
    await supabase.from('skincare_products').delete().eq('id', id)
    setProducts((p) => p.filter((x) => x.id !== id))
  }

  async function addMedication() {
    if (!newMed.name.trim() || !userId) return
    const supabase = createClient()
    const { data } = await supabase.from('medications').insert({
      user_id: userId,
      name: newMed.name.trim(),
      type: newMed.type || null,
      dosage: newMed.dosage || null,
      frequency: newMed.frequency || null,
      photo_url: newMedPhoto,
    }).select().single()
    if (data) {
      setMedications((m) => [...m, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewMed({ name: '', type: '', dosage: '', frequency: '' })
      setNewMedPhoto(null)
    }
  }

  async function updateMedFreq(id: string, frequency: Frequency) {
    const supabase = createClient()
    await supabase.from('medications').update({ frequency }).eq('id', id)
    setMedications((m) => m.map((x) => x.id === id ? { ...x, frequency } : x))
  }

  async function deleteMedication(id: string) {
    const supabase = createClient()
    await supabase.from('medications').delete().eq('id', id)
    setMedications((m) => m.filter((x) => x.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="px-4 space-y-4 pb-6">

        {/* Gemini key */}
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1 mb-1">AI (Gemini)</p>
          <div className="rounded-2xl bg-white overflow-hidden">
            <div className="px-4 py-3.5">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">API Key</p>
              <input type="password" placeholder="AIza…" value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full bg-transparent text-neutral-900 text-[15px] outline-none font-mono placeholder:text-neutral-300" />
            </div>
            <div className="px-4 pb-3.5">
              <button onClick={saveGeminiKey} disabled={savingKey || !geminiKey.trim()}
                className="rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
                {savingKey ? 'Saving…' : 'Save key'}
              </button>
            </div>
          </div>
        </div>

        {/* Skincare library */}
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1 mb-1">Skincare products</p>
          <div className="rounded-2xl bg-white overflow-hidden">
            {products.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i < products.length - 1 ? 'border-b border-neutral-100' : ''}`}>
                {p.photo_url ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-neutral-100 flex-shrink-0">
                    <Image src={p.photo_url} alt={p.name} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{p.name}</p>
                  {p.category && <p className="text-xs text-neutral-400">{p.category}</p>}
                </div>
                <FreqSelect value={p.frequency} onChange={(v) => updateProductFreq(p.id, v)} />
                <button onClick={() => deleteProduct(p.id)} className="text-neutral-300 hover:text-red-400 transition-colors ml-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <Separator />

            {/* Add new product */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-neutral-400">Add product</p>
              <div className="flex gap-3 items-start">
                {userId && (
                  <ProductPhotoIdentifier userId={userId} storageFolder="skincare" onIdentified={onProductIdentified} />
                )}
                <div className="flex-1 space-y-2">
                  <input placeholder="Product name" value={newProd.name}
                    onChange={(e) => setNewProd((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <div className="flex gap-2">
                    <input placeholder="Category" value={newProd.category}
                      onChange={(e) => setNewProd((p) => ({ ...p, category: e.target.value }))}
                      className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                    <select value={newProd.frequency} onChange={(e) => setNewProd((p) => ({ ...p, frequency: e.target.value as Frequency }))}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 text-xs outline-none">
                      <option value="">Freq.</option>
                      {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">📸 Tap the box to photo a product — Gemini will auto-fill the name</p>
              <button onClick={addProduct} disabled={!newProd.name.trim()}
                className="flex items-center gap-2 rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Medications library */}
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1 mb-1">Medications & supplements</p>
          <div className="rounded-2xl bg-white overflow-hidden">
            {medications.map((m, i) => (
              <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i < medications.length - 1 ? 'border-b border-neutral-100' : ''}`}>
                {m.photo_url ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-neutral-100 flex-shrink-0">
                    <Image src={m.photo_url} alt={m.name} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{m.name}</p>
                  {m.dosage && <p className="text-xs text-neutral-400">{m.dosage}</p>}
                </div>
                <FreqSelect value={m.frequency} onChange={(v) => updateMedFreq(m.id, v)} />
                <button onClick={() => deleteMedication(m.id)} className="text-neutral-300 hover:text-red-400 transition-colors ml-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <Separator />

            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-neutral-400">Add medication / supplement</p>
              <div className="flex gap-3 items-start">
                {userId && (
                  <ProductPhotoIdentifier userId={userId} storageFolder="meds" onIdentified={onMedIdentified} />
                )}
                <div className="flex-1 space-y-2">
                  <input placeholder="Name (e.g. Vitamin D3)" value={newMed.name}
                    onChange={(e) => setNewMed((m) => ({ ...m, name: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <div className="flex gap-2">
                    <input placeholder="Dosage (e.g. 1 tablet)" value={newMed.dosage}
                      onChange={(e) => setNewMed((m) => ({ ...m, dosage: e.target.value }))}
                      className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                    <select value={newMed.frequency} onChange={(e) => setNewMed((m) => ({ ...m, frequency: e.target.value as Frequency }))}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 text-xs outline-none">
                      <option value="">Freq.</option>
                      {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">📸 Tap the box to photo a bottle — Gemini will auto-fill the name + dosage</p>
              <button onClick={addMedication} disabled={!newMed.name.trim()}
                className="flex items-center gap-2 rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>

      </div>
      <div className="bottom-nav-spacer" />
    </div>
  )
}
