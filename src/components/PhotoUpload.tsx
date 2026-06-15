'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Camera, Loader2, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { GeminiAnalysis } from '@/types'

interface SlotState {
  preview: string
  publicUrl: string
  file: File | null
  uploading: boolean
}

interface Props {
  userId: string
  onAnalysis: (analysis: GeminiAnalysis, leftUrl: string, rightUrl?: string) => void
  existingPhotoUrl?: string | null
  existingPhotoUrlRight?: string | null
}

export default function PhotoUpload({ userId, onAnalysis, existingPhotoUrl, existingPhotoUrlRight }: Props) {
  const [left, setLeft] = useState<SlotState | null>(
    existingPhotoUrl ? { preview: existingPhotoUrl, publicUrl: existingPhotoUrl, file: null, uploading: false } : null
  )
  const [right, setRight] = useState<SlotState | null>(
    existingPhotoUrlRight ? { preview: existingPhotoUrlRight, publicUrl: existingPhotoUrlRight, file: null, uploading: false } : null
  )
  const [analyzing, setAnalyzing] = useState(false)

  async function handleFile(file: File, side: 'left' | 'right') {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image'); return }

    const preview = await readAsDataURL(file)
    const setter = side === 'left' ? setLeft : setRight
    setter({ preview, publicUrl: '', file, uploading: true })

    const supabase = createClient()
    const path = `${userId}/${side}-${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('skin-photos').upload(path, file)
    if (error) {
      toast.error('Upload failed')
      setter(null)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('skin-photos').getPublicUrl(data.path)
    setter({ preview, publicUrl, file, uploading: false })
  }

  async function runAnalysis() {
    const hasNewLeft = !!left?.file
    const hasNewRight = !!right?.file
    if (!hasNewLeft && !hasNewRight) return

    setAnalyzing(true)
    try {
      const body: Record<string, string> = {}
      if (left?.file) {
        body.imageBase64Left = await fileToBase64(left.file)
        body.mimeTypeLeft = left.file.type
      }
      if (right?.file) {
        body.imageBase64Right = await fileToBase64(right.file)
        body.mimeTypeRight = right.file.type
      }

      const res = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Analysis failed')
      } else {
        toast.success(hasNewLeft && hasNewRight ? 'Combined analysis complete!' : 'AI analysis complete!')
        onAnalysis(json.analysis, left?.publicUrl ?? '', right?.publicUrl || undefined)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const isUploading = !!(left?.uploading || right?.uploading)
  const canAnalyze = !!(left?.file || right?.file) && !analyzing && !isUploading
  const hasBoth = !!(left && right)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <PhotoSlot label="Left side" slot={left} onFile={(f) => handleFile(f, 'left')} onClear={() => setLeft(null)} />
        <PhotoSlot label="Right side" slot={right} onFile={(f) => handleFile(f, 'right')} onClear={() => setRight(null)} />
      </div>
      {(left || right) && (
        <button
          onClick={runAnalysis}
          disabled={!canAnalyze}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 text-white py-2.5 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {analyzing || isUploading
            ? <><Loader2 className="h-4 w-4 animate-spin" />{isUploading ? 'Uploading…' : 'Analyzing…'}</>
            : <><Sparkles className="h-4 w-4" />{hasBoth ? 'Analyze both sides' : 'Analyze photo'}</>}
        </button>
      )}
    </div>
  )
}

function PhotoSlot({ label, slot, onFile, onClear }: {
  label: string
  slot: SlotState | null
  onFile: (f: File) => void
  onClear: () => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide text-center">{label}</p>
      {slot ? (
        <div className="relative rounded-xl overflow-hidden aspect-square bg-neutral-100">
          <Image src={slot.preview} alt={label} fill className="object-cover" unoptimized />
          {slot.uploading ? (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          ) : (
            <>
              <button
                onClick={onClear}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
              >
                <X className="h-3 w-3 text-white" />
              </button>
              <label className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center cursor-pointer">
                <Camera className="h-3.5 w-3.5 text-white" />
                <input type="file" accept="image/*" className="sr-only" capture="user"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; onFile(f) } }} />
              </label>
            </>
          )}
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 aspect-square cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-colors">
          <Camera className="h-7 w-7 text-neutral-300" />
          <span className="text-xs text-neutral-400">Tap to add</span>
          <input type="file" accept="image/*" className="sr-only" capture="user"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; onFile(f) } }} />
        </label>
      )}
    </div>
  )
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
