import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

interface ImportPerson {
  name?: string
  email?: string | null
  clinic?: string | null
  dietary?: string | null
  day1?: boolean
  day2?: boolean
  dinner1?: boolean
  dinner2?: boolean
  accommodation_needed?: boolean
  arrival_date?: string | null
  departure_date?: string | null
  travel?: string | null
  notes?: string | null
}

// POST /api/events/:id/import — import attendees parsed from the signup
// form spreadsheet. For each person: reuse a contact matched by email (or
// name), filling in any blank contact details; otherwise create a new
// contact. Then create/update their registration with day & dinner
// attendance, dietary, accommodation dates, travel and notes.
// Re-importing the same list updates rather than duplicates.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase, user } = auth

  const body = await req.json()
  const people: ImportPerson[] = Array.isArray(body?.people) ? body.people : []
  if (people.length === 0) {
    return NextResponse.json({ error: 'No attendees to import.' }, { status: 400 })
  }

  const registrations: unknown[] = []
  let failed = 0

  for (const p of people) {
    const name = (p.name ?? '').trim()
    if (!name) continue
    const email = (p.email ?? '')?.trim() || null

    // Find an existing contact: by email first, then by name.
    let existing: { id: string; organization: string | null; dietary_needs: string | null; email: string | null } | null = null
    if (email) {
      const { data } = await supabase
        .from('contacts')
        .select('id, organization, dietary_needs, email')
        .ilike('email', email)
        .limit(1)
        .maybeSingle()
      existing = data ?? null
    }
    if (!existing) {
      const { data } = await supabase
        .from('contacts')
        .select('id, organization, dietary_needs, email')
        .ilike('name', name)
        .limit(1)
        .maybeSingle()
      existing = data ?? null
    }

    let contactId: string | null = null
    if (existing) {
      contactId = existing.id
      // Fill in blanks on the contact — never overwrite what's already there.
      const patch: Record<string, unknown> = {}
      if (p.clinic && !existing.organization) patch.organization = p.clinic
      if (p.dietary && !existing.dietary_needs) patch.dietary_needs = p.dietary
      if (email && !existing.email) patch.email = email
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString()
        await supabase.from('contacts').update(patch).eq('id', contactId)
      }
    } else {
      const { data: created, error: createErr } = await supabase
        .from('contacts')
        .insert({
          name,
          email,
          organization: p.clinic ?? null,
          dietary_needs: p.dietary ?? null,
          status: 'prospect',
          created_by: user.id,
        })
        .select('id')
        .single()
      if (createErr || !created) { failed++; continue }
      contactId = created.id
    }

    // Create or update the registration with everything from the form.
    const { data: reg, error: regErr } = await supabase
      .from('registrations')
      .upsert({
        event_id: params.id,
        contact_id: contactId,
        status: 'signed_up',
        day1_attending: !!p.day1,
        day2_attending: !!p.day2,
        dinner1_attending: !!p.dinner1,
        dinner2_attending: !!p.dinner2,
        dietary_needs: p.dietary ?? null,
        accommodation_needed: !!p.accommodation_needed,
        arrival_date: p.arrival_date ?? null,
        departure_date: p.departure_date ?? null,
        travel_notes: p.travel ?? null,
        response_notes: p.notes ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'event_id,contact_id' })
      .select('*, contact:contacts(*)')
      .single()

    if (regErr || !reg) { failed++; continue }
    registrations.push(reg)
  }

  return NextResponse.json({ registrations, imported: registrations.length, failed }, { status: 201 })
}
