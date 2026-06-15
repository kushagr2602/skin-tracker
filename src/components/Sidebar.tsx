'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Camera, Images, BarChart2, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/log/new', label: 'Log Today', icon: Camera },
  { href: '/timeline', label: 'Timeline', icon: Images },
  { href: '/insights', label: 'Insights', icon: BarChart2 },
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r min-h-screen px-3 py-6">
        <div className="flex items-center gap-2 px-3 mb-8">
          <span className="text-2xl">🌿</span>
          <span className="font-semibold text-lg tracking-tight">Skin Tracker</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-white border-b">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-semibold tracking-tight">Skin Tracker</span>
        </div>
        <button onClick={handleLogout} className="text-neutral-400 hover:text-neutral-700 p-1">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t flex items-center justify-around px-2 h-16 safe-area-pb">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
              isActive(href) ? 'text-neutral-900' : 'text-neutral-400'
            )}
          >
            <Icon className={cn('h-5 w-5', isActive(href) ? 'stroke-[2.5px]' : '')} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
