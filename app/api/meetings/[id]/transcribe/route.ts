import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'
import { submitTranscription } from '@/lib/assemblyai'

export const maxDuration = 60

// POST /api/meetings/:id/transcribe
// Body: { audio_path: string, duration_seconds?: number }
// The browser has already uploaded the recording to the meeting-audio bucket;
// we create a short-lived signed URL and hand it to AssemblyAI.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('response' in auth) return auth.response
  const { supabase } = auth

  const body = await req.json()
  const audioPath = body?.audio_path as string | undefined
  if (!audioPath) {
    return NextResponse.json({ error: 'audio_path is required' }, { status: 400 })
  }

  // Signed URL valid for 3 hours — long enough for AssemblyAI to fetch it.
  const { data: signed, error: signErr } = await supabase.storage
    .from('meeting-audio')
    .createSignedUrl(audioPath, 60 * 60 * 3)
  if (signErr || !signed) {
    return NextResponse.json({ error: signErr?.message || 'Could not sign audio URL' }, { status: 400 })
  }

  let assemblyId: string
  try {
    assemblyId = await submitTranscription(signed.signedUrl)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Transcription failed to start'
    await supabase.from('meetings').update({ status: 'failed', error: msg }).eq('id', params.id)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const { data, error } = await supabase
    .from('meetings')
    .update({
      audio_path: audioPath,
      assembly_id: assemblyId,
      status: 'transcribing',
      error: null,
      duration_seconds: body?.duration_seconds ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ meeting: data })
}
