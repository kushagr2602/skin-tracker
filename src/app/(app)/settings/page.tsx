'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus } from 'lucide-react'
import type { SkincareProduct, Medication } from '@/types'

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  const [products, setProducts] = useState<SkincareProduct[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', category: '' })
  const [newMed, setNewMed] = useState({ name: '', type: '' })
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const existingKey = user.user_metadata?.gemini_api_key ?? ''
      if (existingKey) setGeminiKey(existingKey)

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
    const { error } = await supabase.auth.updateUser({
      data: { gemini_api_key: geminiKey.trim() },
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Gemini API key saved!')
    }
    setSavingKey(false)
  }

  async function addProduct() {
    if (!newProduct.name.trim() || !userId) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('skincare_products')
      .insert({ user_id: userId, name: newProduct.name.trim(), category: newProduct.category.trim() || null })
      .select()
      .single()
    if (!error && data) {
      setProducts((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewProduct({ name: '', category: '' })
    }
  }

  async function deleteProduct(id: string) {
    const supabase = createClient()
    await supabase.from('skincare_products').delete().eq('id', id)
    setProducts((p) => p.filter((x) => x.id !== id))
  }

  async function addMedication() {
    if (!newMed.name.trim() || !userId) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('medications')
      .insert({ user_id: userId, name: newMed.name.trim(), type: newMed.type.trim() || null })
      .select()
      .single()
    if (!error && data) {
      setMedications((m) => [...m, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewMed({ name: '', type: '' })
    }
  }

  async function deleteMedication(id: string) {
    const supabase = createClient()
    await supabase.from('medications').delete().eq('id', id)
    setMedications((m) => m.filter((x) => x.id !== id))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Gemini API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gemini API Key</CardTitle>
          <CardDescription>
            Used to analyze your skin photos. Get yours at{' '}
            <span className="font-medium">aistudio.google.com/apikey</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="AIza…"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="font-mono text-sm"
            />
            <Button onClick={saveGeminiKey} disabled={savingKey || !geminiKey.trim()}>
              {savingKey ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {geminiKey && (
            <p className="text-xs text-green-600">
              ✓ Key set — photos will be analyzed automatically on upload.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Skincare Library */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skincare Products</CardTitle>
          <CardDescription>Your product library. Select these when logging.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <Badge key={p.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                {p.name}
                {p.category && <span className="opacity-60">· {p.category}</span>}
                <button onClick={() => deleteProduct(p.id)} className="ml-1 hover:text-red-500 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {products.length === 0 && <p className="text-sm text-neutral-400">No products yet.</p>}
          </div>
          <Separator />
          <div className="flex gap-2">
            <Input placeholder="Product name" value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Category" value={newProduct.category} onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))} className="w-36" />
            <Button variant="outline" size="icon" onClick={addProduct}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Medications Library */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medications & Supplements</CardTitle>
          <CardDescription>Your medication library. Select these when logging.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {medications.map((m) => (
              <Badge key={m.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                {m.name}
                {m.type && <span className="opacity-60">· {m.type}</span>}
                <button onClick={() => deleteMedication(m.id)} className="ml-1 hover:text-red-500 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {medications.length === 0 && <p className="text-sm text-neutral-400">No medications yet.</p>}
          </div>
          <Separator />
          <div className="flex gap-2">
            <Input placeholder="Medication name" value={newMed.name} onChange={(e) => setNewMed((m) => ({ ...m, name: e.target.value }))} />
            <Input placeholder="Type (e.g. topical)" value={newMed.type} onChange={(e) => setNewMed((m) => ({ ...m, type: e.target.value }))} className="w-36" />
            <Button variant="outline" size="icon" onClick={addMedication}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
