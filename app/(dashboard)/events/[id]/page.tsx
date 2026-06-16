import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EventDetailClient } from '@/components/events/event-detail-client'
import type { Event, Registration, Contact } from '@/types'

export const dynamic = 'force-dynamic'

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: event } = await supabase.from('events').select('*').eq('id', params.id).single()
  if (!event) notFound()

  const [{ data: registrations }, { data: contacts }] = await Promise.all([
    supabase
      .from('registrations')
      .select('*, contact:contacts(*)')
      .eq('event_id', params.id)
      .order('created_at', { ascending: true }),
    supabase.from('contacts').select('*').order('name', { ascending: true }),
  ])

  return (
    <EventDetailClient
      event={event as Event}
      initialRegistrations={(registrations ?? []) as Registration[]}
      allContacts={(contacts ?? []) as Contact[]}
    />
  )
}
