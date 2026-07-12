import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

const EDITABLE = ['day', 'start_time', 'title', 'presenter', 'location', 'notes', 'sort_order'] as const

// PATCH /api/agenda-items/:id — update a run-sheet item.
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
    .from('event_agenda_items')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

// DELETE /api/agenda-items/:id — remove a run-sheet item.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { error } = await supabase.from('event_agenda_items').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
