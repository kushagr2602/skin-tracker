'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Camera, Images, BarChart2, Settings, LogOut, MessageCircle, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// Log is at index 2 (center of 5) so it renders as the raised center button
const nav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/coach', label: 'Coach', icon: MessageCircle },
  { href: '/log/new', label: 'Log', icon: Camera },
  { href: '/insights', label: 'Insights', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

// Timeline is still accessible at /timeline (linked from Insights / Dashboard)
const desktopNav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/coach', label: 'Coach', icon: MessageCircle },
  { href: '/log/new', label: 'Log', icon: Camera },
  { href: '/timeline', label: 'Timeline', icon: Images },
  { href: '/insights', label: 'Insights', icon: BarChart2 },
  { href: '/improve', label: 'Improve', icon: Wand2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  const isActive = (href: string) =>
    pathname === href || (href === '/log/new' && pathname.startsWith('/log'))

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r min-h-screen px-3 py-6">
        <div className="flex items-center gap-2 px-3 mb-8">
          <span className="text-2xl">🌿</span>
          <span className="font-semibold text-lg tracking-tight">Skin Tracker</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {desktopNav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(href) ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </nav>
        <button onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />Sign out
        </button>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-5 pt-safe"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '0.5px solid rgba(60,60,67,0.12)' }}
      >
        <span className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <span>🌿</span> Skin Tracker
        </span>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-1"
        style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '0.5px solid rgba(60,60,67,0.12)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          const isLog = href === '/log/new'
          return (
            <Link key={href} href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all',
                isLog ? 'relative -mt-3' : ''
              )}
            >
              {isLog ? (
                /* Big center Log button */
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center shadow-lg">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[10px] font-medium text-neutral-500">Log</span>
                </div>
              ) : (
                <>
                  <Icon className={cn('h-6 w-6 transition-colors', active ? 'text-neutral-900' : 'text-neutral-400')}
                    style={active ? { strokeWidth: 2.5 } : {}}
                  />
                  <span className={cn('text-[10px] font-medium transition-colors', active ? 'text-neutral-900' : 'text-neutral-400')}>
                    {label}
                  </span>
                </>
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
