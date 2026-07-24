'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

function fmt(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Captures microphone audio with MediaRecorder. When the user stops, it hands
 * the recorded Blob (and its length in seconds) back to the parent.
 */
export function Recorder({
  disabled,
  onComplete,
}: {
  disabled?: boolean
  onComplete: (blob: Blob, seconds: number) => void
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAt = useRef(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      recRef.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function start() {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const elapsed = Math.round((Date.now() - startedAt.current) / 1000)
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        onComplete(blob, elapsed)
      }
      rec.start()
      recRef.current = rec
      startedAt.current = Date.now()
      setSeconds(0)
      setRecording(true)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setErr('Could not access the microphone. Please allow microphone access and try again.')
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    recRef.current?.stop()
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        className={
          'flex h-24 w-24 items-center justify-center rounded-full border-4 ' +
          (recording ? 'border-destructive animate-pulse' : 'border-muted')
        }
      >
        <Mic className={'h-10 w-10 ' + (recording ? 'text-destructive' : 'text-muted-foreground')} />
      </div>

      <div className="text-3xl font-mono tabular-nums">{fmt(seconds)}</div>

      {!recording ? (
        <Button onClick={start} disabled={disabled} size="lg">
          <Mic className="mr-2 h-4 w-4" /> Start recording
        </Button>
      ) : (
        <Button onClick={stop} variant="destructive" size="lg">
          <Square className="mr-2 h-4 w-4" /> Stop & transcribe
        </Button>
      )}

      {err && <p className="text-sm text-destructive text-center max-w-sm">{err}</p>}
      <p className="text-xs text-muted-foreground text-center max-w-sm">
        Place the laptop in the middle of the table. Everyone should agree to being recorded — note
        that agreement in the minutes.
      </p>
    </div>
  )
}
