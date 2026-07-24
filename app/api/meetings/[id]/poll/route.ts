import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { getTranscription, utterancesToText } from '@/lib/assemblyai'

export const maxDuration = 60

// GET /api/meetings/:id/poll
// Checks the AssemblyAI job. When it finishes, saves the transcript + speaker
// segments to the meeting and flips status to 'transcribed'. The browser polls
// this so no long-running server request is needed.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const { data: meeting, error: mErr } = await supabase
    .from('meetings')
    .select('id, status, assembly_id, duration_seconds')
    .eq('id', params.id)
    .single()
  if (mErr || !meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  if (!meeting.assembly_id) {
    return NextResponse.json({ status: meeting.status })
  }

  let job
  try {
    job = await getTranscription(meeting.assembly_id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not check transcription'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  if (job.status === 'error') {
    await supabase
      .from('meetings')
      .update({ status: 'failed', error: job.error || 'Transcription failed' })
      .eq('id', params.id)
    return NextResponse.json({ status: 'failed', error: job.error })
  }

  if (job.status !== 'completed') {
    // still queued / processing
    return NextResponse.json({ status: 'transcribing' })
  }

  const transcript = utterancesToText(job.utterances, job.text)
  const { data, error } = await supabase
    .from('meetings')
    .update({
      status: 'transcribed',
      transcript,
      utterances: job.utterances ?? null,
      duration_seconds: meeting.duration_seconds ?? (job.audio_duration ?? null),
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ status: 'transcribed', meeting: data })
}
