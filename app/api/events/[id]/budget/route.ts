import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// POST /api/events/:id/budget — add a budget line item to an event.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const body = await req.json()
  const { data, error } = await supabase
    .from('event_budget_items')
    .insert({
      event_id: params.id,
      category: body.category ?? null,
      estimated: body.estimated ?? null,
      actual: body.actual ?? null,
      notes: body.notes ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data }, { status: 201 })
}
