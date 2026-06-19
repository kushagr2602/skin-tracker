'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  "What's triggering my flares?",
  "Is my skin improving over time?",
  "How does sleep affect my skin?",
  "Which skincare products help most?",
  "Does stress make my skin worse?",
]

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your skin coach. I can look through your logged data and answer questions about your patterns, triggers, and trends.\n\nWhat would you like to know?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg }
    // Snapshot messages at this moment for history calculation
    const prevMessages = messages
    setMessages((m) => [...m, userMsg])
    setLoading(true)

    // Build history: all previous exchanges except the initial AI greeting
    const history = prevMessages
      .filter((m, i) => !(i === 0 && m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      })
      const json = await res.json()
      const reply: Message = {
        role: 'assistant',
        content: res.ok ? json.response : `Sorry, something went wrong: ${json.error}`,
      }
      setMessages((m) => [...m, reply])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Network error — please try again.' }])
    }
    setLoading(false)
  }

  const showSuggestions = messages.length === 1

  return (
    <div className="flex flex-col bg-[#F2F2F7]" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight leading-tight">Skin Coach</h1>
            <p className="text-[11px] text-neutral-400">Analyzes your logged data</p>
          </div>
        </div>
      </div>

      {/* Message list */}
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

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-1.5"
              style={{ borderBottomLeftRadius: 4, border: '0.5px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="w-2 h-2 rounded-full bg-neutral-300 animate-bounce"
                  style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Suggested questions — only shown before first user message */}
        {showSuggestions && (
          <div className="pt-2 space-y-2">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">Try asking</p>
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="w-full text-left bg-white rounded-2xl border border-neutral-200 px-4 py-3 text-[13px] text-neutral-700 active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 pt-2 pb-2 bg-[#F2F2F7] border-t border-neutral-200/80">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              // Auto-grow
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="Ask about your skin…"
            rows={1}
            disabled={loading}
            className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[14px] outline-none resize-none focus:border-neutral-400 transition-colors disabled:opacity-50"
            style={{ minHeight: 44, maxHeight: 120, overflowY: 'hidden' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all flex-shrink-0"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="bottom-nav-spacer flex-shrink-0" />
    </div>
  )
}
