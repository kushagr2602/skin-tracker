'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Send, Loader2, Sparkles, ArrowLeft, Upload } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const PLACEHOLDER = `e.g. I wake around 7am, skip breakfast, big coffee. Desk job, pretty stressful deadlines. I work out 3x a week at the gym in the evening and usually shower after. I eat a lot of cheese and have ice cream most nights. Sleep is irregular — some nights 5h, weekends 9h. I use a CeraVe cleanser and a random moisturizer, no sunscreen. I touch my face a lot when stressed…`

export default function CoachSetupPage() {
  const [phase, setPhase] = useState<'describe' | 'chat'>('describe')
  const [description, setDescription] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function callAgent(userMessage: string, priorMessages: Message[]) {
    setLoading(true)
    const history = priorMessages.map((m) => ({ role: m.role, content: m.content }))
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history, mode: 'intake' }),
      })
      const json = await res.json()
      setMessages((m) => [...m, {
        role: 'assistant',
        content: res.ok ? json.response : `Something went wrong: ${json.error}`,
      }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Network error — please try again.' }])
    }
    setLoading(false)
  }

  function startInterview() {
    const text = description.trim()
    if (!text || loading) return
    const first: Message = { role: 'user', content: text }
    setMessages([first])
    setPhase('chat')
    callAgent(text, [])
  }

  function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: text }
    const prior = messages
    setMessages((m) => [...m, userMsg])
    callAgent(text, prior)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDescription((reader.result as string).slice(0, 5000))
    reader.readAsText(file)
  }

  // ─── Describe phase ───────────────────────────────────────────────────────
  if (phase === 'describe') {
    return (
      <div className="min-h-screen bg-[#F2F2F7]">
        <div className="px-4 pt-5 pb-3">
          <Link href="/coach" className="inline-flex items-center gap-1 text-sm text-neutral-500 mb-3">
            <ArrowLeft className="h-4 w-4" /> Coach
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold tracking-tight leading-tight">Set up your profile</h1>
              <p className="text-[11px] text-neutral-400">Describe your lifestyle — the coach will interview you</p>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-3 pb-6">
          <div className="rounded-2xl bg-white p-4">
            <p className="text-[13px] text-neutral-500 leading-relaxed mb-3">
              Write a few sentences about your typical day — food, sleep, stress, workouts, skincare, anything.
              The coach will read it and ask focused follow-up questions about what might be triggering your acne.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={9}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-400 resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                Upload .txt
                <input type="file" accept=".txt,text/plain" className="sr-only" onChange={handleFile} />
              </label>
              <span className="text-[11px] text-neutral-300">{description.length} chars</span>
            </div>
          </div>

          <button
            onClick={startInterview}
            disabled={!description.trim() || loading}
            className="w-full py-4 rounded-2xl bg-neutral-900 text-white font-semibold text-base disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            Start interview
          </button>
        </div>
        <div className="bottom-nav-spacer" />
      </div>
    )
  }

  // ─── Chat / interview phase ───────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-[#F2F2F7]" style={{ height: '100dvh' }}>
      <div className="px-4 pt-5 pb-3 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight leading-tight">Intake interview</h1>
            <p className="text-[11px] text-neutral-400">Answer in your own words</p>
          </div>
        </div>
        <Link href="/coach" className="text-[13px] font-medium text-neutral-500 bg-white rounded-full px-3 py-1.5 border border-neutral-200">
          Done →
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[82%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap"
              style={
                m.role === 'user'
                  ? { background: '#1a1a1a', color: '#fff', borderBottomRightRadius: 4 }
                  : { background: '#fff', color: '#1a1a1a', borderBottomLeftRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', border: '0.5px solid rgba(0,0,0,0.06)' }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-1.5"
              style={{ borderBottomLeftRadius: 4, border: '0.5px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
              {[0, 150, 300].map((delay) => (
                <div key={delay} className="w-2 h-2 rounded-full bg-neutral-300 animate-bounce"
                  style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-4 pt-2 pb-2 bg-[#F2F2F7] border-t border-neutral-200/80">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Your answer…"
            rows={1}
            disabled={loading}
            className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none resize-none focus:border-neutral-400 disabled:opacity-50"
            style={{ minHeight: 44, maxHeight: 120, overflowY: 'hidden' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all flex-shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="bottom-nav-spacer flex-shrink-0" />
    </div>
  )
}
