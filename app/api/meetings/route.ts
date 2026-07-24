import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// GET /api/meetings — list recorded meetings (newest first)
export async function GET() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { data, error } = await supabase
    .from('meetings')
    .select('*, event:events(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ meetings: data })
}

// POST /api/meetings — create a meeting shell (before/around recording)
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase, user } = auth

  const body = await req.json()
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: 'Meeting title is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      title: body.title.trim(),
      meeting_date: body.meeting_date || null,
      location: body.location || null,
      event_id: body.event_id || null,
      attendees: Array.isArray(body.attendees) ? body.attendees : [],
      status: 'draft',
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ meeting: data }, { status: 201 })
}
