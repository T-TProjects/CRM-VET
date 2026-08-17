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
  // When false (the default), people already on the event are left exactly
  // as they are — so manual edits are never overwritten.
  const updateExisting: boolean = body?.updateExisting === true
  if (people.length === 0) {
    return NextResponse.json({ error: 'No attendees to import.' }, { status: 400 })
  }

  const registrations: unknown[] = []
  let failed = 0
  let added = 0
  let updated = 0
  let skippedExisting = 0

  for (const p of people) {
    const name = (p.name ?? '').trim()
    if (!name) continue
    const email = (p.email ?? '')?.trim() || null

    // Find an existing contact by NAME. Email alone is deliberately not a
    // match: clinics often share one address (e.g. reception@...), so two
    // people can legitimately have the same email. And if the same name
    // exists at a different clinic, treat them as different people.
    let existing: { id: string; organization: string | null; dietary_needs: string | null; email: string | null } | null = null
    const { data: candidates } = await supabase
      .from('contacts')
      .select('id, organization, dietary_needs, email')
      .ilike('name', name)
      .limit(5)
    const clinic = (p.clinic ?? '').trim().toLowerCase()
    for (const c of candidates ?? []) {
      if (!clinic || !c.organization || c.organization.trim().toLowerCase() === clinic) {
        existing = c
        break
      }
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

    // Is this person already on the event? If so, and we're not updating,
    // leave their (possibly hand-edited) registration exactly as it is.
    const { data: existingReg } = await supabase
      .from('registrations')
      .select('id')
      .eq('event_id', params.id)
      .eq('contact_id', contactId)
      .maybeSingle()
    if (existingReg && !updateExisting) { skippedExisting++; continue }

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
    if (existingReg) updated++; else added++
    registrations.push(reg)
  }

  return NextResponse.json(
    { registrations, imported: registrations.length, added, updated, skippedExisting, failed },
    { status: 201 },
  )
}
