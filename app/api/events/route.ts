import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// GET /api/events — list events (with registration counts)
export async function GET() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { data, error } = await supabase
    .from('events')
    .select('*, registrations(count)')
    .order('starts_at', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ events: data })
}

// POST /api/events — create an event
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase, user } = auth

  const body = await req.json()
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'Event name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      name: body.name.trim(),
      description: body.description || null,
      location: body.location || null,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      agenda_url: body.agenda_url || null,
      status: body.status || 'draft',
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ event: data }, { status: 201 })
}
