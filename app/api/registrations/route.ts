import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// POST /api/registrations — add a contact to an event.
// Pre-fills accommodation/dietary from the contact's standing defaults.
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const body = await req.json()
  if (!body?.event_id || !body?.contact_id) {
    return NextResponse.json({ error: 'event_id and contact_id are required' }, { status: 400 })
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('dietary_needs, accommodation_notes')
    .eq('id', body.contact_id)
    .single()

  const { data, error } = await supabase
    .from('registrations')
    .insert({
      event_id: body.event_id,
      contact_id: body.contact_id,
      status: body.status || 'invited',
      dietary_needs: body.dietary_needs ?? contact?.dietary_needs ?? null,
      accommodation_notes: body.accommodation_notes ?? contact?.accommodation_notes ?? null,
      accommodation_needed: body.accommodation_needed ?? false,
    })
    .select('*, contact:contacts(*)')
    .single()

  if (error) {
    // Unique violation = already registered for this event.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This contact is already on the event.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ registration: data }, { status: 201 })
}
