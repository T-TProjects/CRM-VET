import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

const EDITABLE = ['category', 'estimated', 'actual', 'notes', 'sort_order'] as const

// PATCH /api/budget-items/:id — update a budget line item.
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
    .from('event_budget_items')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

// DELETE /api/budget-items/:id — remove a budget line item.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { error } = await supabase.from('event_budget_items').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
