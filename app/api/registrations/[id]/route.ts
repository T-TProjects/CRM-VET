import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

const EDITABLE = [
  'status', 'accommodation_needed', 'accommodation_notes',
  'dietary_needs', 'arrival_date', 'departure_date', 'response_notes', 'replied_at',
] as const

// PATCH /api/registrations/:id — update status / needs / response
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const body = await req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('registrations')
    .update(updates)
    .eq('id', params.id)
    .select('*, contact:contacts(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ registration: data })
}

// DELETE /api/registrations/:id — remove a contact from an event
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { error } = await supabase.from('registrations').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
