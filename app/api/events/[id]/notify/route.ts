import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { sendTemplateToRegistrations } from '@/lib/notify'

// POST /api/events/:id/notify — send a template to registrations.
// Body: { templateKey: string, registrationIds: string[] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response

  const body = await req.json()
  const templateKey = String(body?.templateKey ?? '')
  const registrationIds: string[] = Array.isArray(body?.registrationIds) ? body.registrationIds : []

  if (!templateKey || registrationIds.length === 0) {
    return NextResponse.json({ error: 'templateKey and registrationIds are required' }, { status: 400 })
  }

  const result = await sendTemplateToRegistrations(params.id, templateKey, registrationIds)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json(result)
}
