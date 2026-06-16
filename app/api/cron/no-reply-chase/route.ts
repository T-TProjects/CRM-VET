import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/gmail'
import { sendTemplateToRegistrations } from '@/lib/notify'

// GET /api/cron/no-reply-chase — daily job that emails the chase template to
// attendees who were notified more than CHASE_DAYS ago and still haven't
// replied or responded. Sending re-stamps notified_at, which throttles repeat
// chases to roughly once per CHASE_DAYS window.
const CHASE_DAYS = 3

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const cutoff = new Date(Date.now() - CHASE_DAYS * 86400_000).toISOString()

  const { data: due } = await admin
    .from('registrations')
    .select('id, event_id')
    .eq('status', 'invited')
    .not('notified_at', 'is', null)
    .is('replied_at', null)
    .lte('notified_at', cutoff)

  // Group registration ids by event so each event's contacts get one batch.
  const byEvent = new Map<string, string[]>()
  for (const r of (due ?? []) as { id: string; event_id: string }[]) {
    const list = byEvent.get(r.event_id) ?? []
    list.push(r.id)
    byEvent.set(r.event_id, list)
  }

  let totalSent = 0
  const results: { event_id: string; sent: number; error?: string }[] = []
  for (const [eventId, ids] of Array.from(byEvent.entries())) {
    const res = await sendTemplateToRegistrations(eventId, 'no_reply_chase', ids)
    totalSent += res.sent
    results.push({ event_id: eventId, sent: res.sent, error: res.error })
  }

  return NextResponse.json({ chased: totalSent, events: results.length, results })
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  return header === secret || bearer === `Bearer ${secret}`
}
