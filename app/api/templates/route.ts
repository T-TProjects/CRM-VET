import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

// GET /api/templates — list email templates
export async function GET() {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { data, error } = await supabase.from('email_templates').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ templates: data })
}
