'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CalendarDays, MapPin, FileText, Plus, Send, Trash2,
  CheckCircle2, Clock, XCircle, Bed, Utensils,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Event, Registration, Contact, RegistrationStatus } from '@/types'

const STATUS_VARIANT: Record<RegistrationStatus, 'success' | 'secondary' | 'outline' | 'warning' | 'destructive'> = {
  signed_up: 'success', invited: 'warning', declined: 'destructive', attended: 'success', no_show: 'outline',
}
const STATUS_LABEL: Record<RegistrationStatus, string> = {
  signed_up: 'Signed up', invited: 'Invited', declined: 'Declined', attended: 'Attended', no_show: 'No show',
}

export function EventDetailClient({
  event, initialRegistrations, allContacts,
}: { event: Event; initialRegistrations: Registration[]; allContacts: Contact[] }) {
  const [regs, setRegs] = useState<Registration[]>(initialRegistrations)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Registration | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const summary = useMemo(() => {
    const signedUp = regs.filter(r => r.status === 'signed_up' || r.status === 'attended').length
    const declined = regs.filter(r => r.status === 'declined').length
    const awaitingReply = regs.filter(r => r.notified_at && !r.replied_at).length
    const noResponse = regs.filter(r => r.status === 'invited').length
    return { total: regs.length, signedUp, declined, awaitingReply, noResponse }
  }, [regs])

  const unregistered = useMemo(() => {
    const ids = new Set(regs.map(r => r.contact_id))
    return allContacts.filter(c => !ids.has(c.id))
  }, [regs, allContacts])

  function patchLocal(updated: Registration) {
    setRegs(prev => prev.map(r => (r.id === updated.id ? { ...r, ...updated, contact: r.contact } : r)))
  }

  async function addAttendee(contactId: string) {
    setBusy(true)
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: event.id, contact_id: contactId }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      toast({ title: 'Could not add', description: json.error, variant: 'destructive' })
      return
    }
    setRegs(prev => [...prev, json.registration as Registration])
    setAddOpen(false)
    toast({ title: 'Attendee added' })
  }

  async function updateReg(id: string, body: Partial<Registration>) {
    const res = await fetch(`/api/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) {
      toast({ title: 'Could not update', description: json.error, variant: 'destructive' })
      return
    }
    patchLocal(json.registration as Registration)
  }

  async function removeReg(r: Registration) {
    if (!confirm(`Remove ${r.contact?.name ?? 'this contact'} from the event?`)) return
    const res = await fetch(`/api/registrations/${r.id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Could not remove', variant: 'destructive' }); return }
    setRegs(prev => prev.filter(x => x.id !== r.id))
  }

  // Send a template to a set of registrations via the notify endpoint.
  async function notify(templateKey: string, registrationIds: string[]) {
    if (registrationIds.length === 0) { toast({ title: 'No recipients for this action' }); return }
    setBusy(true)
    const res = await fetch(`/api/events/${event.id}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateKey, registrationIds }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      toast({ title: 'Could not send', description: json.error ?? 'Connect a Gmail account in Settings first.', variant: 'destructive' })
      return
    }
    if (Array.isArray(json.registrations)) (json.registrations as Registration[]).forEach(patchLocal)
    toast({ title: `Sent ${json.sent ?? registrationIds.length} email(s)` })
  }

  const invitedIds = regs.filter(r => r.status === 'invited').map(r => r.id)
  const signedUpIds = regs.filter(r => r.status === 'signed_up').map(r => r.id)
  const noReplyIds = regs.filter(r => r.notified_at && !r.replied_at).map(r => r.id)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All conferences
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {event.starts_at && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDate(event.starts_at)}</span>}
            {event.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {event.location}</span>}
            {event.agenda_url && <a href={event.agenda_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground hover:underline"><FileText className="h-4 w-4" /> Agenda</a>}
          </div>
        </div>
      </div>

      {/* Response summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Signed up" value={summary.signedUp} icon={CheckCircle2} />
        <Stat label="No response" value={summary.noResponse} icon={Clock} />
        <Stat label="Awaiting reply" value={summary.awaitingReply} icon={Send} />
        <Stat label="Declined" value={summary.declined} icon={XCircle} />
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Add attendee</Button>
        <Button variant="outline" disabled={busy || invitedIds.length === 0} onClick={() => notify('event_invite', invitedIds)}>
          <Send className="h-4 w-4 mr-1.5" /> Send invite to no-response ({invitedIds.length})
        </Button>
        <Button variant="outline" disabled={busy || signedUpIds.length === 0} onClick={() => notify('agenda', signedUpIds)}>
          <FileText className="h-4 w-4 mr-1.5" /> Send agenda to signed-up ({signedUpIds.length})
        </Button>
        <Button variant="outline" disabled={busy || noReplyIds.length === 0} onClick={() => notify('no_reply_chase', noReplyIds)}>
          <Clock className="h-4 w-4 mr-1.5" /> Chase no-replies ({noReplyIds.length})
        </Button>
      </div>

      {/* Registrations */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attendee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Accommodation</TableHead>
                <TableHead>Dietary</TableHead>
                <TableHead>Notified</TableHead>
                <TableHead>Replied</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No attendees yet. Add someone to get started.</TableCell></TableRow>
              ) : regs.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.contact?.name ?? 'Unknown'}
                    {r.contact?.organization && <span className="block text-xs text-muted-foreground">{r.contact.organization}</span>}
                  </TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v: RegistrationStatus) => updateReg(r.id, { status: v })}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as RegistrationStatus[]).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.accommodation_needed ? <span className="flex items-center gap-1.5 text-foreground"><Bed className="h-3.5 w-3.5" /> {r.accommodation_notes || 'Needed'}</span> : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.dietary_needs ? <span className="flex items-center gap-1.5 text-foreground"><Utensils className="h-3.5 w-3.5" /> {r.dietary_needs}</span> : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.notified_at ? formatDate(r.notified_at) : '—'}</TableCell>
                  <TableCell className="text-xs">
                    {r.replied_at
                      ? <Badge variant="success">Replied</Badge>
                      : r.notified_at ? <Badge variant="warning">Waiting</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(r)}>Edit</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeReg(r)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add attendee dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add attendee</DialogTitle></DialogHeader>
          {unregistered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone in your contacts is already on this event. Add more people from the Contacts page.</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto divide-y">
              {unregistered.map(c => (
                <button key={c.id} disabled={busy} onClick={() => addAttendee(c.id)} className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-accent/40 px-2 rounded">
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {c.organization && <span className="text-muted-foreground"> · {c.organization}</span>}
                  </span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit registration dialog */}
      {editing && (
        <EditRegistrationDialog
          reg={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => { await updateReg(editing.id, body); setEditing(null) }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  )
}

function EditRegistrationDialog({
  reg, onClose, onSave,
}: { reg: Registration; onClose: () => void; onSave: (body: Partial<Registration>) => Promise<void> }) {
  const [accNeeded, setAccNeeded] = useState(reg.accommodation_needed)
  const [accNotes, setAccNotes] = useState(reg.accommodation_notes ?? '')
  const [dietary, setDietary] = useState(reg.dietary_needs ?? '')
  const [responseNotes, setResponseNotes] = useState(reg.response_notes ?? '')
  const [replied, setReplied] = useState(!!reg.replied_at)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave({
      accommodation_needed: accNeeded,
      accommodation_notes: accNotes || null,
      dietary_needs: dietary || null,
      response_notes: responseNotes || null,
      replied_at: replied ? (reg.replied_at ?? new Date().toISOString()) : null,
    })
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{reg.contact?.name ?? 'Attendee'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={accNeeded} onChange={e => setAccNeeded(e.target.checked)} className="h-4 w-4" />
            Needs accommodation
          </label>
          <div className="space-y-1.5"><Label>Accommodation notes</Label><Input value={accNotes} onChange={e => setAccNotes(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Dietary needs</Label><Input value={dietary} onChange={e => setDietary(e.target.value)} placeholder="e.g. vegetarian, gluten free" /></div>
          <div className="space-y-1.5"><Label>Response notes</Label><textarea value={responseNotes} onChange={e => setResponseNotes(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replied} onChange={e => setReplied(e.target.checked)} className="h-4 w-4" />
            Mark as replied
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
