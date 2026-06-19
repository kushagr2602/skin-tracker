'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus, X, ThumbsUp, ThumbsDown, Lightbulb, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type Sentiment = 'helpful' | 'not_helpful' | 'idea'

const OPTIONS: { value: Sentiment; label: string; icon: typeof ThumbsUp }[] = [
  { value: 'idea', label: 'Idea', icon: Lightbulb },
  { value: 'helpful', label: 'Love it', icon: ThumbsUp },
  { value: 'not_helpful', label: 'Issue', icon: ThumbsDown },
]

export default function FeedbackButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [sentiment, setSentiment] = useState<Sentiment>('idea')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!message.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Please sign in'); setSaving(false); return }

    const { error } = await supabase.from('app_feedback').insert({
      user_id: user.id,
      sentiment,
      message: message.trim(),
      page: pathname,
    })
    setSaving(false)
    if (error) { toast.error('Could not send feedback'); return }
    toast.success('Thanks — the improvement agent will see this')
    setMessage('')
    setOpen(false)
  }

  return (
    <>
      {/* Floating trigger — sits above the mobile bottom nav */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed right-4 z-30 w-11 h-11 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative w-full md:max-w-sm bg-white rounded-t-3xl md:rounded-3xl p-5 pb-7 md:pb-5"
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-semibold">Send feedback</h2>
              <button onClick={() => setOpen(false)} className="text-neutral-400"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex gap-2 mb-3">
              {OPTIONS.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => setSentiment(value)}
                  className="flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-medium transition-all"
                  style={{
                    background: sentiment === value ? '#1a1a1a' : '#F3F4F6',
                    color: sentiment === value ? '#fff' : '#374151',
                  }}>
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={sentiment === 'idea' ? 'What would make this better?' : sentiment === 'not_helpful' ? "What's frustrating?" : 'What do you like?'}
              rows={3}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400 resize-none"
            />

            <button onClick={submit} disabled={!message.trim() || saving}
              className="w-full mt-3 py-3 rounded-xl bg-neutral-900 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
