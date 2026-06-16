import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

interface Draft {
  name?: string
  email?: string
  organization?: string
  phone?: string
  status?: string
  dietary_needs?: string
  accommodation_notes?: string
  notes?: string
}

const STATUSES = new Set(['prospect', 'active', 'inactive'])
const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// POST /api/contacts/bulk — insert many contacts at once.
// Body: { contacts: Draft[] }. Rows without a name are skipped.
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase, user } = auth

  const body = await req.json()
  const drafts: Draft[] = Array.isArray(body?.contacts) ? body.contacts : []

  const rows = drafts
    .filter((d) => clean(d?.name))
    .map((d) => ({
      name: clean(d.name)!,
      email: clean(d.email),
      organization: clean(d.organization),
      phone: clean(d.phone),
      status: STATUSES.has(String(d.status)) ? d.status : 'prospect',
      dietary_needs: clean(d.dietary_needs),
      accommodation_notes: clean(d.accommodation_notes),
      notes: clean(d.notes),
      created_by: user.id,
    }))

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid rows. Each contact needs at least a name.' }, { status: 400 })
  }

  const { data, error } = await supabase.from('contacts').insert(rows).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ contacts: data, inserted: data?.length ?? 0 }, { status: 201 })
}
