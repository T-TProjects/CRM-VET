import { createClient } from '@/lib/supabase/server'
import { EventsClient } from '@/components/events/events-client'
import type { Event } from '@/types'

export const dynamic = 'force-dynamic'

type EventRow = Event & { registrations: { count: number }[] }

export default async function EventsPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('events')
    .select('*, registrations(count)')
    .order('starts_at', { ascending: true, nullsFirst: false })

  const events = ((data ?? []) as EventRow[]).map(e => ({
    ...e,
    registrationCount: e.registrations?.[0]?.count ?? 0,
  }))

  return <EventsClient initialEvents={events} />
}
