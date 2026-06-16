import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import type { User } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  // Fall back to a minimal profile if the users row hasn't been created yet,
  // so a freshly invited auth user isn't locked out of the shell.
  const user: User =
    (profile as User) ?? {
      id: authUser.id,
      email: authUser.email ?? '',
      name: authUser.email?.split('@')[0] ?? 'User',
      role: 'owner',
      created_at: new Date().toISOString(),
    }

  // Overdue / due-today reminders drive the sidebar badge.
  const { count: pendingCount } = await supabase
    .from('reminders')
    .select('*', { count: 'exact', head: true })
    .eq('completed', false)
    .lte('due_date', new Date().toISOString())

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} pendingCount={pendingCount ?? 0} />
      <main className="md:pl-72">
        <div className="pt-14 md:pt-0">{children}</div>
      </main>
    </div>
  )
}
