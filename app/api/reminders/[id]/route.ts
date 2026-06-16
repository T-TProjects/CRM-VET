import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// PATCH /api/reminders/:id — toggle complete or edit
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const body = await req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['title', 'notes', 'due_date'] as const) {
    if (key in body) updates[key] = body[key]
  }
  if ('completed' in body) {
    updates.completed = body.completed
    updates.completed_at = body.completed ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', params.id)
    .select('*, contact:contacts(*), event:events(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ reminder: data })
}

// DELETE /api/reminders/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { error } = await supabase.from('reminders').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
