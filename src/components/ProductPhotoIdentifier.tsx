'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { Loader2, Camera, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { GeminiProductID } from '@/types'

interface Props {
  userId: string
  storageFolder: 'skincare' | 'meds'
  onIdentified: (result: GeminiProductID, photoUrl: string) => void
}

export default function ProductPhotoIdentifier({ userId, storageFolder, onIdentified }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image'); return }
    setLoading(true)

    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    // Upload to storage
    const supabase = createClient()
    const path = `${userId}/${storageFolder}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('skin-photos').upload(path, file)

    if (error) { toast.error('Upload failed'); setLoading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('skin-photos').getPublicUrl(data.path)

    // Identify with Gemini
    const base64 = await fileToBase64(file)
    const res = await fetch('/api/identify-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(json.error ?? 'Could not identify product')
      return
    }

    if (!json.product.name) {
      toast.warning('Could not read the label clearly — please fill in manually')
    } else {
      toast.success(`Identified: ${json.product.name}`)
    }
    onIdentified(json.product, publicUrl)
  }, [userId, storageFolder, onIdentified])

  return (
    <label className="cursor-pointer block">
      <input type="file" accept="image/*" className="sr-only" capture="environment"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }} />

      {preview ? (
        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 flex-shrink-0">
          <Image src={preview} alt="Product" fill className="object-cover" unoptimized />
          {loading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div className="w-16 h-16 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 flex flex-col items-center justify-center gap-1 flex-shrink-0 hover:bg-neutral-100 transition-colors">
          {loading ? (
            <Loader2 className="h-5 w-5 text-neutral-400 animate-spin" />
          ) : (
            <>
              <Camera className="h-5 w-5 text-neutral-400" />
              <Sparkles className="h-3 w-3 text-neutral-300" />
            </>
          )}
        </div>
      )}
    </label>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
