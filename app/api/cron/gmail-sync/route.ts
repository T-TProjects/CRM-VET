import { NextRequest, NextResponse } from 'next/server'
import { syncInbox } from '@/lib/sync'

// GET /api/cron/gmail-sync — hourly Gmail sync (Vercel cron).
// Authenticated by the CRON_SECRET header or Vercel's cron Authorization bearer.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await syncInbox(7)
  return NextResponse.json(result)
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  return header === secret || bearer === `Bearer ${secret}`
}
