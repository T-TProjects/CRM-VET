import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// POST /api/events/:id/agenda — add a run-sheet item to an event.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const body = await req.json()
  const { data, error } = await supabase
    .from('event_agenda_items')
    .insert({
      event_id: params.id,
      day: body.day ?? null,
      start_time: body.start_time ?? null,
      title: body.title ?? null,
      presenter: body.presenter ?? null,
      location: body.location ?? null,
      notes: body.notes ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data }, { status: 201 })
}
