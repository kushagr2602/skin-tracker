'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { Upload, Camera, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { GeminiAnalysis } from '@/types'

interface Props {
  userId: string
  onAnalysis: (analysis: GeminiAnalysis, photoUrl: string) => void
  existingPhotoUrl?: string | null
}

export default function PhotoUpload({ userId, onAnalysis, existingPhotoUrl }: Props) {
  const [preview, setPreview] = useState<string | null>(existingPhotoUrl ?? null)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    setUploading(true)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    const supabase = createClient()
    const path = `${userId}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('skin-photos').upload(path, file)

    if (error) {
      toast.error('Upload failed: ' + error.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('skin-photos').getPublicUrl(data.path)
    setUploading(false)

    // Send to Gemini for analysis
    setAnalyzing(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Analysis failed')
      } else {
        toast.success('AI analysis complete!')
        onAnalysis(json.analysis, publicUrl)
      }
    } finally {
      setAnalyzing(false)
    }
  }, [userId, onAnalysis])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  if (preview) {
    return (
      <div className="relative">
        <div className="relative rounded-xl overflow-hidden border aspect-[4/3] bg-neutral-100">
          <Image src={preview} alt="Skin photo" fill className="object-cover" unoptimized />
          {(uploading || analyzing) && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-medium">
                {uploading ? 'Uploading…' : 'Analyzing with Gemini…'}
              </span>
            </div>
          )}
        </div>
        <label className="mt-2 block">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <span>
              <Camera className="h-4 w-4 mr-2" />
              Change photo
              <input type="file" accept="image/*" className="sr-only" onChange={handleChange} capture="user" />
            </span>
          </Button>
        </label>
      </div>
    )
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 aspect-[4/3] cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-colors"
    >
      <Upload className="h-8 w-8 text-neutral-400" />
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-700">Drop a photo or tap to upload</p>
        <p className="text-xs text-neutral-400 mt-1">Selfie works best</p>
      </div>
      <input type="file" accept="image/*" className="sr-only" onChange={handleChange} capture="user" />
    </label>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
