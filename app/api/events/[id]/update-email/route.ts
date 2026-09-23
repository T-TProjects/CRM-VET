import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { sendUpdateToRegistrations, sendTestUpdateEmail } from '@/lib/notify'

// POST /api/events/:id/update-email — send a last-minute update/notes email.
// Body: { subject: string, body: string, includeDocs?: boolean,
//         registrationIds: string[], testTo?: string }
// When testTo is set, sends only to that address as a preview (no attendees emailed).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const body = await req.json()
  const subject = String(body?.subject ?? '').trim()
  const bodyTpl = String(body?.body ?? '').trim()
  const includeDocs = body?.includeDocs !== false
  const testTo = String(body?.testTo ?? '').trim()
  const registrationIds: string[] = Array.isArray(body?.registrationIds) ? body.registrationIds : []

  if (!subject || !bodyTpl) {
    return NextResponse.json({ error: 'Please fill in the subject and message first.' }, { status: 400 })
  }

  if (testTo) {
    const result = await sendTestUpdateEmail(params.id, subject, bodyTpl, includeDocs, testTo)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ test: true })
  }

  if (registrationIds.length === 0) {
    return NextResponse.json({ error: 'No recipients for this update.' }, { status: 400 })
  }

  const result = await sendUpdateToRegistrations(params.id, subject, bodyTpl, includeDocs, registrationIds)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json(result)
}
