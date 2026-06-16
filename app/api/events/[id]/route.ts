import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

const EDITABLE = ['name', 'description', 'location', 'starts_at', 'ends_at', 'agenda_url', 'status'] as const

// GET /api/events/:id — event + its registrations (with contacts)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', params.id)
    .single()
  if (eventErr) return NextResponse.json({ error: eventErr.message }, { status: 404 })

  const { data: registrations, error: regErr } = await supabase
    .from('registrations')
    .select('*, contact:contacts(*)')
    .eq('event_id', params.id)
    .order('created_at', { ascending: true })
  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 400 })

  return NextResponse.json({ event, registrations })
}

// PATCH /api/events/:id
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
    .from('events')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ event: data })
}

// DELETE /api/events/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { error } = await supabase.from('events').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
