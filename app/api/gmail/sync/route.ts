import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { syncInbox } from '@/lib/sync'

// POST /api/gmail/sync — manual sync triggered from the UI (signed-in user).
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  let lookbackDays = 30
  try {
    const body = await req.json()
    if (body?.lookback_days) lookbackDays = Number(body.lookback_days)
  } catch { /* no body */ }

  const result = await syncInbox(lookbackDays)
  return NextResponse.json(result)
}
