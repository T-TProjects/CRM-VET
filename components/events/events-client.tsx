'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, CalendarDays, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/utils'
import type { Event, EventStatus } from '@/types'

type EventWithCount = Event & { registrationCount: number }

const STATUS_VARIANT: Record<EventStatus, 'success' | 'secondary' | 'outline' | 'warning' | 'destructive'> = {
  active: 'success', upcoming: 'warning', draft: 'secondary', completed: 'outline', cancelled: 'destructive',
}

const empty = {
  name: '', description: '', location: '', starts_at: '', ends_at: '',
  agenda_url: '', status: 'draft' as EventStatus,
}

export function EventsClient({ initialEvents }: { initialEvents: EventWithCount[] }) {
  const router = useRouter()
  const [events, setEvents] = useState(initialEvents)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function create() {
    if (!form.name.trim()) {
      toast({ title: 'Event name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast({ title: 'Could not create', description: json.error, variant: 'destructive' })
      return
    }
    setEvents(prev => [...prev, { ...(json.event as Event), registrationCount: 0 }])
    setOpen(false)
    setForm(empty)
    toast({ title: 'Conference created' })
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Conferences</h1>
          <p className="text-sm text-muted-foreground">{events.length} events</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New conference</Button>
      </div>

      {events.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No conferences yet. Create your first one.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(e => (
            <Card key={e.id} className="cursor-pointer transition-colors hover:bg-accent/40" onClick={() => router.push(`/events/${e.id}`)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{e.name}</CardTitle>
                  <Badge variant={STATUS_VARIANT[e.status]} className="capitalize shrink-0">{e.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                {e.starts_at && <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(e.starts_at)}</p>}
                {e.location && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {e.location}</p>}
                <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {e.registrationCount} registered</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New conference</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Location"><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts"><Input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></Field>
              <Field label="Ends"><Input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></Field>
            </div>
            <Field label="Agenda link"><Input value={form.agenda_url} onChange={e => setForm({ ...form, agenda_url: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v: EventStatus) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px]" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
}
