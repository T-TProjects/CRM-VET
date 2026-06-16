import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// GET /api/reminders — list (optionally only open ones with ?open=1)
export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  let query = supabase
    .from('reminders')
    .select('*, contact:contacts(*), event:events(*)')
    .order('due_date', { ascending: true })
  if (req.nextUrl.searchParams.get('open')) query = query.eq('completed', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ reminders: data })
}

// POST /api/reminders — create
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase, user } = auth

  const body = await req.json()
  if (!body?.title?.trim() || !body?.due_date) {
    return NextResponse.json({ error: 'Title and due date are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert({
      title: body.title.trim(),
      notes: body.notes || null,
      due_date: body.due_date,
      contact_id: body.contact_id || null,
      event_id: body.event_id || null,
      created_by: user.id,
    })
    .select('*, contact:contacts(*), event:events(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ reminder: data }, { status: 201 })
}
