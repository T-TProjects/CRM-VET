'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Mic, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/utils'
import type { Meeting } from '@/types'

const empty = { title: '', meeting_date: '', location: '', attendees: '' }

const STATUS_LABEL: Record<Meeting['status'], string> = {
  draft: 'Not recorded',
  transcribing: 'Transcribing…',
  transcribed: 'Ready to draft',
  drafting: 'Drafting…',
  ready: 'Minutes ready',
  failed: 'Needs attention',
}

export function MeetingsClient({ initialMeetings }: { initialMeetings: Meeting[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!form.title.trim()) {
      toast({ title: 'A meeting title is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        meeting_date: form.meeting_date || null,
        location: form.location || null,
        attendees: form.attendees.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast({ title: 'Could not create meeting', description: json.error, variant: 'destructive' })
      return
    }
    router.push(`/meetings/${json.meeting.id}`)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Board meetings</h1>
          <p className="text-sm text-muted-foreground">Record a meeting and get drafted minutes.</p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" /> New recording
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {initialMeetings.length === 0 ? (
            <div className="text-center py-12">
              <Mic className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No meetings yet. Start your first recording.</p>
            </div>
          ) : (
            initialMeetings.map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.meeting_date ? formatDate(m.meeting_date) : 'No date'}
                    {m.location ? ` · ${m.location}` : ''}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New board recording</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Meeting title</Label>
              <Input placeholder="e.g. Board meeting — July 2026" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="Boardroom" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Attendees (comma separated)</Label>
              <Input placeholder="Jane Smith, John Doe" value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create & record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const ready = status === 'ready'
  const busy = status === 'transcribing' || status === 'drafting'
  const failed = status === 'failed'
  return (
    <span
      className={
        'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
        (ready
          ? 'bg-primary/10 text-primary'
          : failed
          ? 'bg-destructive/10 text-destructive'
          : busy
          ? 'bg-amber-500/10 text-amber-600'
          : 'bg-muted text-muted-foreground')
      }
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : ready ? <FileText className="h-3 w-3" /> : null}
      {STATUS_LABEL[status]}
    </span>
  )
}
