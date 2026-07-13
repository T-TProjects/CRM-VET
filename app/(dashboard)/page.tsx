import Link from 'next/link'
import { Users, CalendarDays, MailQuestion, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { QuickTasks } from '@/components/quick-tasks'
import { formatDate } from '@/lib/utils'
import type { Interaction } from '@/types'

export const dynamic = 'force-dynamic'

async function getStats() {
  const supabase = createClient()

  const [contactsTotal, contactsActive, eventsUpcoming, pendingReplies, interactions] =
    await Promise.all([
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('events').select('*', { count: 'exact', head: true }).in('status', ['upcoming', 'active']),
      // Notified attendees who have not replied yet.
      supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .not('notified_at', 'is', null)
        .is('replied_at', null),
      supabase
        .from('interactions')
        .select('*, contact:contacts(*), event:events(*)')
        .order('date', { ascending: false })
        .limit(8),
    ])

  return {
    totalContacts: contactsTotal.count ?? 0,
    activeContacts: contactsActive.count ?? 0,
    upcomingEvents: eventsUpcoming.count ?? 0,
    pendingReplies: pendingReplies.count ?? 0,
    recentInteractions: (interactions.data ?? []) as Interaction[],
  }
}

const cards = [
  { key: 'totalContacts', label: 'Total contacts', icon: Users, href: '/contacts' },
  { key: 'activeContacts', label: 'Active contacts', icon: UserCheck, href: '/contacts' },
  { key: 'upcomingEvents', label: 'Upcoming conferences', icon: CalendarDays, href: '/events' },
  { key: 'pendingReplies', label: 'Awaiting reply', icon: MailQuestion, href: '/events' },
] as const

export default async function DashboardPage() {
  const stats = await getStats()

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Relationships, conferences, and follow-ups at a glance.</p>
      </div>

      <QuickTasks />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, label, icon: Icon, href }) => (
          <Link key={key} href={href}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats[key]}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentInteractions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
          ) : (
            <ul className="divide-y">
              {stats.recentInteractions.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.contact?.name ?? 'Unknown'}
                      {i.event?.name ? ` · ${i.event.name}` : ''}
                      {` · ${i.type}`}
                    </p>
                  </div>
                  <span className="shrink-0 pl-3 text-xs text-muted-foreground">{formatDate(i.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
