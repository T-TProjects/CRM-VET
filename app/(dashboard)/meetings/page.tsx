import { createClient } from '@/lib/supabase/server'
import { MeetingsClient } from '@/components/meetings/meetings-client'
import type { Meeting } from '@/types'

export const dynamic = 'force-dynamic'

export default async function MeetingsPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('meetings')
    .select('*, event:events(*)')
    .order('created_at', { ascending: false })

  return <MeetingsClient initialMeetings={(data ?? []) as Meeting[]} />
}
