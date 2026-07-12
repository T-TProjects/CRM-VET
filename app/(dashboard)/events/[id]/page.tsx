import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EventDetailClient } from '@/components/events/event-detail-client'
import type { Event, Registration, Contact, RunSheetItem, BudgetItem } from '@/types'

export const dynamic = 'force-dynamic'

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: event } = await supabase.from('events').select('*').eq('id', params.id).single()
  if (!event) notFound()

  const [{ data: registrations }, { data: contacts }, { data: runSheet }, { data: budget }] = await Promise.all([
    supabase
      .from('registrations')
      .select('*, contact:contacts(*)')
      .eq('event_id', params.id)
      .order('created_at', { ascending: true }),
    supabase.from('contacts').select('*').order('name', { ascending: true }),
    supabase
      .from('event_agenda_items')
      .select('*')
      .eq('event_id', params.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('event_budget_items')
      .select('*')
      .eq('event_id', params.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  return (
    <EventDetailClient
      event={event as Event}
      initialRegistrations={(registrations ?? []) as Registration[]}
      allContacts={(contacts ?? []) as Contact[]}
      initialRunSheet={(runSheet ?? []) as RunSheetItem[]}
      initialBudget={(budget ?? []) as BudgetItem[]}
    />
  )
}
