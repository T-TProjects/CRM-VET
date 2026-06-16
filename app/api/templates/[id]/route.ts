import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// PATCH /api/templates/:id — edit a template's subject/body/name
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const body = await req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['name', 'subject', 'body'] as const) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}
