import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

const EDITABLE = ['title', 'meeting_date', 'location', 'event_id', 'attendees', 'minutes'] as const

// GET /api/meetings/:id — fetch one meeting (with transcript + minutes)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { data, error } = await supabase
    .from('meetings')
    .select('*, event:events(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ meeting: data })
}

// PATCH /api/meetings/:id — edit details or the drafted minutes
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
    .from('meetings')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ meeting: data })
}

// DELETE /api/meetings/:id — remove a meeting (and its audio file)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  // Best-effort: remove the audio file from storage first.
  const { data: meeting } = await supabase
    .from('meetings')
    .select('audio_path')
    .eq('id', params.id)
    .single()
  if (meeting?.audio_path) {
    await supabase.storage.from('meeting-audio').remove([meeting.audio_path])
  }

  const { error } = await supabase.from('meetings').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
