import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingDetailClient } from '@/components/meetings/meeting-detail-client'
import type { Meeting } from '@/types'

export const dynamic = 'force-dynamic'

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data } = await supabase
    .from('meetings')
    .select('*, event:events(*)')
    .eq('id', params.id)
    .single()

  if (!data) notFound()
  return <MeetingDetailClient initialMeeting={data as Meeting} />
}
