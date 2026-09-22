import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { sendUpdateToRegistrations } from '@/lib/notify'

// POST /api/events/:id/update-email — send a last-minute update/notes email.
// Body: { note: string, includeDocs?: boolean, registrationIds: string[] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const body = await req.json()
  const note = String(body?.note ?? '').trim()
  const includeDocs = body?.includeDocs !== false
  const registrationIds: string[] = Array.isArray(body?.registrationIds) ? body.registrationIds : []

  if (!note) {
    return NextResponse.json({ error: 'Please type an update message first.' }, { status: 400 })
  }
  if (registrationIds.length === 0) {
    return NextResponse.json({ error: 'No recipients for this update.' }, { status: 400 })
  }

  const result = await sendUpdateToRegistrations(params.id, note, includeDocs, registrationIds)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json(result)
}
