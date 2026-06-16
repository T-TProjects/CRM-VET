import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

interface Person { name?: string; email?: string }

// POST /api/events/:id/attendees — bulk-add attendees to an event.
// Body: { people?: {name,email}[], contactIds?: string[] }
// For each person: reuse an existing contact matched by email, else create one.
// Then register all resolved contacts to the event (duplicates ignored).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase, user } = auth

  const body = await req.json()
  const people: Person[] = Array.isArray(body?.people) ? body.people : []
  const passedIds: string[] = Array.isArray(body?.contactIds) ? body.contactIds : []

  const contactIds = new Set<string>(passedIds)

  for (const p of people) {
    const name = (p?.name ?? '').trim()
    const email = (p?.email ?? '').trim()
    if (!name && !email) continue

    let contactId: string | null = null
    if (email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .ilike('email', email)
        .limit(1)
        .maybeSingle()
      contactId = existing?.id ?? null
    }
    if (!contactId) {
      const { data: created } = await supabase
        .from('contacts')
        .insert({ name: name || email, email: email || null, status: 'prospect', created_by: user.id })
        .select('id')
        .single()
      contactId = created?.id ?? null
    }
    if (contactId) contactIds.add(contactId)
  }

  if (contactIds.size === 0) {
    return NextResponse.json({ error: 'No attendees to add. Provide names/emails or selected contacts.' }, { status: 400 })
  }

  const rows = Array.from(contactIds).map((contact_id) => ({
    event_id: params.id,
    contact_id,
    status: 'invited',
  }))

  // ignoreDuplicates so already-registered contacts are skipped (returns only new rows).
  const { data, error } = await supabase
    .from('registrations')
    .upsert(rows, { onConflict: 'event_id,contact_id', ignoreDuplicates: true })
    .select('*, contact:contacts(*)')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ registrations: data ?? [], added: data?.length ?? 0 }, { status: 201 })
}
