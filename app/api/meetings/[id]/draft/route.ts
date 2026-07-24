import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { draftMinutes } from '@/lib/minutes'

export const maxDuration = 60

// POST /api/meetings/:id/draft
// Sends the stored transcript to Claude and saves the structured minutes.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { data: meeting, error: mErr } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, location, attendees, transcript')
    .eq('id', params.id)
    .single()
  if (mErr || !meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  if (!meeting.transcript) {
    return NextResponse.json({ error: 'No transcript to draft from yet' }, { status: 400 })
  }

  await supabase.from('meetings').update({ status: 'drafting', error: null }).eq('id', params.id)

  let minutes
  try {
    minutes = await draftMinutes(meeting.transcript, {
      title: meeting.title,
      date: meeting.meeting_date,
      location: meeting.location,
      attendees: meeting.attendees ?? [],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not draft minutes'
    await supabase.from('meetings').update({ status: 'failed', error: msg }).eq('id', params.id)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const { data, error } = await supabase
    .from('meetings')
    .update({ status: 'ready', minutes, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ meeting: data })
}
