// Thin wrapper around the AssemblyAI transcription API.
// We hand AssemblyAI a signed URL to the audio in Supabase Storage and let it
// fetch + transcribe with speaker labels, then poll for the result.

const BASE = 'https://api.assemblyai.com/v2'

function apiKey() {
  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) throw new Error('ASSEMBLYAI_API_KEY is not set')
  return key
}

export interface AssemblyUtterance {
  speaker: string
  text: string
  start: number
  end: number
}

export interface AssemblyTranscript {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text: string | null
  utterances: AssemblyUtterance[] | null
  audio_duration: number | null
  error: string | null
}

/** Kick off a transcription job. Returns the AssemblyAI transcript id. */
export async function submitTranscription(audioUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/transcript`, {
    method: 'POST',
    headers: { authorization: apiKey(), 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl, speaker_labels: true }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'Failed to start transcription')
  return json.id as string
}

/** Check the status of a transcription job. */
export async function getTranscription(id: string): Promise<AssemblyTranscript> {
  const res = await fetch(`${BASE}/transcript/${id}`, {
    headers: { authorization: apiKey() },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'Failed to fetch transcription')
  return json as AssemblyTranscript
}

/** Build a single readable transcript string from speaker-labelled utterances. */
export function utterancesToText(utterances: AssemblyUtterance[] | null, fallback: string | null): string {
  if (!utterances || utterances.length === 0) return fallback ?? ''
  return utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join('\n\n')
}
