'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center px-6 pt-safe">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="mb-4 flex justify-center"><Logo size={64} /></div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Skin Tracker</h1>
          <p className="text-neutral-400 mt-2">Track your skin journey</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3">
          <div className="rounded-2xl bg-white overflow-hidden">
            <div className="px-4 py-3.5 border-b border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Email</p>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                className="w-full bg-transparent text-neutral-900 text-[16px] outline-none placeholder:text-neutral-300" />
            </div>
            <div className="px-4 py-3.5">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Password</p>
              <input type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
                className="w-full bg-transparent text-neutral-900 text-[16px] outline-none placeholder:text-neutral-300" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl bg-neutral-900 text-white font-semibold text-base disabled:opacity-50 active:scale-[0.98] transition-transform mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-400 mt-6">
          No account?{' '}
          <Link href="/signup" className="text-neutral-900 font-semibold">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
