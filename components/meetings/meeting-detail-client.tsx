'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Copy, Trash2, Loader2, RefreshCw, FileText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Recorder } from '@/components/meetings/recorder'
import { downloadMinutesDocx } from '@/components/meetings/minutes-docx'
import type { Meeting, MeetingMinutes } from '@/types'

type Flow = 'idle' | 'uploading' | 'transcribing' | 'drafting'

function extFromType(type: string) {
  if (type.includes('mp4')) return 'mp4'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('wav')) return 'wav'
  return 'webm'
}

function minutesToText(m: MeetingMinutes): string {
  const lines: string[] = []
  lines.push(m.title)
  if (m.date) lines.push(m.date)
  lines.push('')
  if (m.attendees.length) lines.push(`Present: ${m.attendees.join(', ')}`)
  if (m.apologies.length) lines.push(`Apologies: ${m.apologies.join(', ')}`)
  lines.push('', 'Summary', m.summary, '')
  if (m.agenda_items.length) {
    lines.push('Agenda')
    m.agenda_items.forEach((a, i) => lines.push(`${i + 1}. ${a.topic}`, `   ${a.discussion}`))
    lines.push('')
  }
  if (m.decisions.length) {
    lines.push('Decisions')
    m.decisions.forEach((d) => lines.push(`- ${d.topic}: ${d.decision}${d.outcome ? ` (${d.outcome})` : ''}`))
    lines.push('')
  }
  if (m.action_items.length) {
    lines.push('Action items')
    m.action_items.forEach((a) =>
      lines.push(`- ${a.action}${a.owner ? ` — ${a.owner}` : ''}${a.due ? ` (by ${a.due})` : ''}`)
    )
    lines.push('')
  }
  if (m.next_meeting) lines.push(`Next meeting: ${m.next_meeting}`)
  return lines.join('\n')
}

export function MeetingDetailClient({ initialMeeting }: { initialMeeting: Meeting }) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [meeting, setMeeting] = useState<Meeting>(initialMeeting)
  const [flow, setFlow] = useState<Flow>('idle')
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(initialMeeting.minutes)
  const [savingMinutes, setSavingMinutes] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }

  const draft = useCallback(async () => {
    setFlow('drafting')
    const res = await fetch(`/api/meetings/${meeting.id}/draft`, { method: 'POST' })
    const json = await res.json()
    setFlow('idle')
    if (!res.ok) {
      toast({ title: 'Could not draft minutes', description: json.error, variant: 'destructive' })
      setMeeting((m) => ({ ...m, status: 'failed', error: json.error }))
      return
    }
    setMeeting(json.meeting as Meeting)
    setMinutes((json.meeting as Meeting).minutes)
    toast({ title: 'Minutes drafted' })
  }, [meeting.id, toast])

  const startPolling = useCallback(() => {
    stopPolling()
    setFlow('transcribing')
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/meetings/${meeting.id}/poll`)
      const json = await res.json()
      if (!res.ok) return
      if (json.status === 'transcribed') {
        stopPolling()
        setMeeting(json.meeting as Meeting)
        draft()
      } else if (json.status === 'failed') {
        stopPolling()
        setFlow('idle')
        setMeeting((m) => ({ ...m, status: 'failed', error: json.error }))
        toast({ title: 'Transcription failed', description: json.error, variant: 'destructive' })
      }
    }, 4000)
  }, [meeting.id, draft, toast])

  // Resume polling if we land on the page mid-transcription.
  useEffect(() => {
    if (meeting.status === 'transcribing') startPolling()
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onRecordingComplete(blob: Blob, seconds: number) {
    setFlow('uploading')
    const ext = extFromType(blob.type)
    const path = `${meeting.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('meeting-audio')
      .upload(path, blob, { contentType: blob.type })
    if (upErr) {
      setFlow('idle')
      toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' })
      return
    }
    const res = await fetch(`/api/meetings/${meeting.id}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_path: path, duration_seconds: seconds }),
    })
    const json = await res.json()
    if (!res.ok) {
      setFlow('idle')
      toast({ title: 'Could not start transcription', description: json.error, variant: 'destructive' })
      return
    }
    setMeeting(json.meeting as Meeting)
    startPolling()
  }

  async function saveMinutes() {
    if (!minutes) return
    setSavingMinutes(true)
    const res = await fetch(`/api/meetings/${meeting.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    })
    setSavingMinutes(false)
    if (!res.ok) {
      toast({ title: 'Could not save', variant: 'destructive' })
      return
    }
    toast({ title: 'Minutes saved' })
  }

  async function remove() {
    if (!confirm('Delete this meeting and its recording? This cannot be undone.')) return
    const res = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast({ title: 'Could not delete', variant: 'destructive' })
      return
    }
    router.push('/meetings')
    router.refresh()
  }

  function downloadMinutes() {
    if (!minutes) return
    const blob = new Blob([minutesToText(minutes)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${meeting.title.replace(/[^\w]+/g, '-')}-minutes.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const [makingDoc, setMakingDoc] = useState(false)
  async function downloadDocx() {
    if (!minutes) return
    setMakingDoc(true)
    try {
      await downloadMinutesDocx(meeting.title.replace(/[^\w]+/g, '-'), minutes)
    } catch {
      toast({ title: 'Could not create the Word file', variant: 'destructive' })
    } finally {
      setMakingDoc(false)
    }
  }

  const busy = flow !== 'idle'
  const statusLabel =
    flow === 'uploading'
      ? 'Uploading recording…'
      : flow === 'transcribing'
      ? 'Transcribing — this can take a few minutes for a long meeting…'
      : flow === 'drafting'
      ? 'Drafting minutes…'
      : null

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link href="/meetings" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> All meetings
          </Link>
          <h1 className="text-2xl font-semibold truncate">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            {meeting.meeting_date ? formatDate(meeting.meeting_date) : 'No date set'}
            {meeting.location ? ` · ${meeting.location}` : ''}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress banner */}
      {statusLabel && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {statusLabel}
          </CardContent>
        </Card>
      )}

      {/* Recorder — shown until we have a transcript */}
      {!meeting.transcript && !busy && meeting.status !== 'failed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record the meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <Recorder onComplete={onRecordingComplete} disabled={busy} />
          </CardContent>
        </Card>
      )}

      {/* Failed state */}
      {meeting.status === 'failed' && !busy && (
        <Card>
          <CardContent className="py-5 space-y-3">
            <p className="text-sm text-destructive">{meeting.error || 'Something went wrong.'}</p>
            {meeting.transcript ? (
              <Button onClick={draft}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try drafting again
              </Button>
            ) : (
              <Recorder onComplete={onRecordingComplete} disabled={busy} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcribed but not yet drafted */}
      {meeting.status === 'transcribed' && !busy && (
        <Card>
          <CardContent className="py-5">
            <Button onClick={draft}>
              <Sparkles className="mr-2 h-4 w-4" /> Draft minutes from transcript
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Minutes editor */}
      {minutes && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Minutes (draft — please review)</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(minutesToText(minutes)); toast({ title: 'Copied' }) }}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
              <Button size="sm" onClick={downloadDocx} disabled={makingDoc}>
                {makingDoc ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                Word
              </Button>
              <Button variant="outline" size="sm" onClick={downloadMinutes}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> .txt
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <MinutesEditor value={minutes} onChange={setMinutes} onSave={saveMinutes} saving={savingMinutes} />
          </CardContent>
        </Card>
      )}

      {/* Transcript (collapsible) */}
      {meeting.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Full transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">Show transcript</summary>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{meeting.transcript}</pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---- Minutes editor ---------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function MinutesEditor({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: MeetingMinutes
  onChange: (m: MeetingMinutes) => void
  onSave: () => void
  saving: boolean
}) {
  const set = (patch: Partial<MeetingMinutes>) => onChange({ ...value, ...patch })
  const textarea =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[64px] focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Present (comma separated)">
          <Input
            value={value.attendees.join(', ')}
            onChange={(e) => set({ attendees: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          />
        </Field>
        <Field label="Apologies (comma separated)">
          <Input
            value={value.apologies.join(', ')}
            onChange={(e) => set({ apologies: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          />
        </Field>
      </div>

      <Field label="Summary">
        <textarea className={textarea} value={value.summary} onChange={(e) => set({ summary: e.target.value })} />
      </Field>

      <Field label="Agenda items">
        <div className="space-y-2">
          {value.agenda_items.map((a, i) => (
            <div key={i} className="rounded-md border p-2 space-y-2">
              <Input
                placeholder="Topic"
                value={a.topic}
                onChange={(e) => {
                  const next = [...value.agenda_items]
                  next[i] = { ...a, topic: e.target.value }
                  set({ agenda_items: next })
                }}
              />
              <textarea
                className={textarea}
                placeholder="Discussion"
                value={a.discussion}
                onChange={(e) => {
                  const next = [...value.agenda_items]
                  next[i] = { ...a, discussion: e.target.value }
                  set({ agenda_items: next })
                }}
              />
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => set({ agenda_items: value.agenda_items.filter((_, x) => x !== i) })}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set({ agenda_items: [...value.agenda_items, { topic: '', discussion: '' }] })}>
            + Add agenda item
          </Button>
        </div>
      </Field>

      <Field label="Decisions">
        <div className="space-y-2">
          {value.decisions.map((d, i) => (
            <div key={i} className="rounded-md border p-2 space-y-2">
              <Input placeholder="Topic" value={d.topic} onChange={(e) => { const n = [...value.decisions]; n[i] = { ...d, topic: e.target.value }; set({ decisions: n }) }} />
              <Input placeholder="Decision" value={d.decision} onChange={(e) => { const n = [...value.decisions]; n[i] = { ...d, decision: e.target.value }; set({ decisions: n }) }} />
              <Input placeholder="Outcome (e.g. carried unanimously)" value={d.outcome ?? ''} onChange={(e) => { const n = [...value.decisions]; n[i] = { ...d, outcome: e.target.value || null }; set({ decisions: n }) }} />
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => set({ decisions: value.decisions.filter((_, x) => x !== i) })}>Remove</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set({ decisions: [...value.decisions, { topic: '', decision: '', outcome: null }] })}>+ Add decision</Button>
        </div>
      </Field>

      <Field label="Action items">
        <div className="space-y-2">
          {value.action_items.map((a, i) => (
            <div key={i} className="rounded-md border p-2 grid gap-2 sm:grid-cols-[1fr,140px,140px] sm:items-start">
              <Input placeholder="Action" value={a.action} onChange={(e) => { const n = [...value.action_items]; n[i] = { ...a, action: e.target.value }; set({ action_items: n }) }} />
              <Input placeholder="Owner" value={a.owner ?? ''} onChange={(e) => { const n = [...value.action_items]; n[i] = { ...a, owner: e.target.value || null }; set({ action_items: n }) }} />
              <Input placeholder="Due" value={a.due ?? ''} onChange={(e) => { const n = [...value.action_items]; n[i] = { ...a, due: e.target.value || null }; set({ action_items: n }) }} />
              <Button variant="ghost" size="sm" className="text-destructive sm:col-span-3 justify-self-start" onClick={() => set({ action_items: value.action_items.filter((_, x) => x !== i) })}>Remove</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set({ action_items: [...value.action_items, { action: '', owner: null, due: null }] })}>+ Add action</Button>
        </div>
      </Field>

      <Field label="Next meeting">
        <Input value={value.next_meeting ?? ''} onChange={(e) => set({ next_meeting: e.target.value || null })} />
      </Field>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save minutes
        </Button>
      </div>
    </div>
  )
}
