import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Guard for API routes. Returns the Supabase client + auth user, or a 401
 * response to return early. Usage:
 *
 *   const auth = await requireUser()
 *   if ('response' in auth) return auth.response
 *   const { supabase, user } = auth
 */
export async function requireUser() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { supabase, user }
}
