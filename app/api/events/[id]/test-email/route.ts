import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { sendTestEmail } from '@/lib/notify'

// POST /api/events/:id/test-email — send a single preview email of a
// template to one address. Body: { templateKey: string, to: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const body = await req.json()
  const templateKey = String(body?.templateKey ?? '')
  const to = String(body?.to ?? '').trim()

  if (!templateKey) return NextResponse.json({ error: 'templateKey is required' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const result = await sendTestEmail(params.id, templateKey, to)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
