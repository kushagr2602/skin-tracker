import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import FeedbackButton from '@/components/FeedbackButton'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[#F2F2F7]">
      <Sidebar />
      {/* Mobile: top bar (56px) + bottom nav (56px + safe area) */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
      <FeedbackButton />
    </div>
  )
}
