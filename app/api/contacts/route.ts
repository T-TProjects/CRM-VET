import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// GET /api/contacts?q=&status=  — list contacts
export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const q = req.nextUrl.searchParams.get('q')?.trim()
  const status = req.nextUrl.searchParams.get('status')?.trim()

  let query = supabase.from('contacts').select('*').order('name', { ascending: true })
  if (status) query = query.eq('status', status)
  if (q) query = query.or(`name.ilike.%${q}%,organization.ilike.%${q}%,email.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ contacts: data })
}

// POST /api/contacts — create a contact
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase, user } = auth

  const body = await req.json()
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      name: body.name.trim(),
      organization: body.organization || null,
      email: body.email || null,
      phone: body.phone || null,
      status: body.status || 'prospect',
      dietary_needs: body.dietary_needs || null,
      accommodation_notes: body.accommodation_notes || null,
      groups: Array.isArray(body.groups) ? body.groups : [],
      notes: body.notes || null,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ contact: data }, { status: 201 })
}
