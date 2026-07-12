'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CalendarDays, MapPin, FileText, Plus, Send, Trash2,
  CheckCircle2, Clock, XCircle, Bed, Utensils, Pencil, Search, Star, Download,
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
import { RunSheetSection } from '@/components/events/run-sheet-section'
import { BudgetSection } from '@/components/events/budget-section'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Event, EventStatus, Registration, Contact, RegistrationStatus, RunSheetItem, BudgetItem } from '@/types'

const STATUS_VARIANT: Record<RegistrationStatus, 'success' | 'secondary' | 'outline' | 'warning' | 'destructive'> = {
  signed_up: 'success', invited: 'warning', declined: 'destructive', attended: 'success', no_show: 'outline',
}
const STATUS_LABEL: Record<RegistrationStatus, string> = {
  signed_up: 'Signed up', invited: 'Invited', declined: 'Declined', attended: 'Attended', no_show: 'No show',
}
const EVENT_STATUS_VARIANT: Record<EventStatus, 'success' | 'secondary' | 'outline' | 'warning' | 'destructive'> = {
  active: 'success', upcoming: 'warning', draft: 'secondary', completed: 'outline', cancelled: 'destructive',
}

export function EventDetailClient({
  event, initialRegistrations, allContacts, initialRunSheet, initialBudget,
}: {
  event: Event
  initialRegistrations: Registration[]
  allContacts: Contact[]
  initialRunSheet: RunSheetItem[]
  initialBudget: BudgetItem[]
}) {
  const router = useRouter()
  const [regs, setRegs] = useState<Registration[]>(initialRegistrations)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Registration | null>(null)
  const [busy, setBusy] = useState(false)
  const [ev, setEv] = useState(event)
  const [editOpen, setEditOpen] = useState(false)
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const { toast } = useToast()

  const summary = useMemo(() => {
    const signedUp = regs.filter(r => r.status === 'signed_up' || r.status === 'attended').length
    const declined = regs.filter(r => r.status === 'declined').length
    const awaitingReply = regs.filter(r => r.notified_at && !r.replied_at).length
    const noResponse = regs.filter(r => r.status === 'invited').length
    return { total: regs.length, signedUp, declined, awaitingReply, noResponse }
  }, [regs])

  // Catering / accommodation tallies for the venue and hotel.
  const catering = useMemo(() => {
    let day1 = 0, day2 = 0, dinner1 = 0, dinner2 = 0, rooms = 0
    for (const r of regs) {
      if (r.day1_attending) day1++
      if (r.day2_attending) day2++
      if (r.dinner1_attending) dinner1++
      if (r.dinner2_attending) dinner2++
      if (r.accommodation_needed) rooms++
    }
    const diet = new Map<string, number>()
    for (const r of regs) {
      const d = r.dietary_needs?.trim()
      if (d) diet.set(d, (diet.get(d) ?? 0) + 1)
    }
    const dietary = Array.from(diet.entries()).sort((a, b) => b[1] - a[1])
    return { day1, day2, dinner1, dinner2, rooms, dietary }
  }, [regs])

  const unregistered = useMemo(() => {
    const ids = new Set(regs.map(r => r.contact_id))
    return allContacts.filter(c => !ids.has(c.id))
  }, [regs, allContacts])

  const visibleUnregistered = useMemo(() => {
    const q = attendeeSearch.toLowerCase().trim()
    if (!q) return unregistered
    return unregistered.filter(c =>
      [c.name, c.organization, c.email, ...(c.groups ?? [])].filter(Boolean).some(v => v!.toLowerCase().includes(q))
    )
  }, [unregistered, attendeeSearch])

  const allGroups = useMemo(() => {
    const set = new Set<string>()
    allContacts.forEach(c => (c.groups ?? []).forEach(g => set.add(g)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allContacts])

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

  async function updateEvent(body: Partial<Event>): Promise<boolean> {
    const res = await fetch(`/api/events/${ev.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) {
      toast({ title: 'Could not save', description: json.error, variant: 'destructive' })
      return false
    }
    setEv(json.event as Event)
    toast({ title: 'Conference updated' })
    return true
  }

  async function deleteEvent() {
    if (!confirm(`Delete "${ev.name}"? This removes the conference and all its attendees, run sheet and budget. This cannot be undone.`)) return
    setBusy(true)
    const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { toast({ title: 'Could not delete', variant: 'destructive' }); return }
    toast({ title: 'Conference deleted' })
    router.push('/events')
    router.refresh()
  }

  async function bulkAddAttendees(people: { name: string; email: string }[]) {
    if (people.length === 0) return
    setBusy(true)
    const res = await fetch(`/api/events/${ev.id}/attendees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ people }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      toast({ title: 'Could not add', description: json.error, variant: 'destructive' })
      return
    }
    const added = (json.registrations ?? []) as Registration[]
    setRegs(prev => [...prev, ...added])
    setBulkOpen(false)
    setBulkText('')
    toast({ title: `Added ${json.added} attendee${json.added === 1 ? '' : 's'}` })
  }

  async function addGroup(group: string) {
    const ids = unregistered.filter(c => (c.groups ?? []).includes(group)).map(c => c.id)
    if (ids.length === 0) { toast({ title: `No new contacts in "${group}"` }); return }
    setBusy(true)
    const res = await fetch(`/api/events/${ev.id}/attendees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: ids }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { toast({ title: 'Could not add group', description: json.error, variant: 'destructive' }); return }
    const added = (json.registrations ?? []) as Registration[]
    setRegs(prev => [...prev, ...added])
    setAddOpen(false)
    toast({ title: `Added ${json.added} from "${group}"` })
  }

  function exportAttendeesCSV() {
    const rows: (string | number)[][] = [[
      'Clinic', 'Name', 'Status', 'Day 1', 'Day 2', 'Dinner 1', 'Dinner 2',
      'Dietary', 'Needs room', 'Travel', 'Notes',
    ]]
    for (const r of regs) {
      rows.push([
        r.contact?.organization ?? '', r.contact?.name ?? '', STATUS_LABEL[r.status],
        r.day1_attending ? 'Y' : '', r.day2_attending ? 'Y' : '',
        r.dinner1_attending ? 'Y' : '', r.dinner2_attending ? 'Y' : '',
        r.dietary_needs ?? '', r.accommodation_needed ? 'Y' : '',
        r.travel_notes ?? '', r.response_notes ?? '',
      ])
    }
    downloadCSV(`${ev.name} - attendees.csv`, rows)
  }

  function exportHotelCSV() {
    const guests = regs.filter(r => r.accommodation_needed)
    if (guests.length === 0) { toast({ title: 'No one needs accommodation yet' }); return }
    const rows: (string | number)[][] = [[
      'Clinic', 'Guest name', 'Check-in', 'Check-out', 'Nights', 'Dietary', 'Notes',
    ]]
    for (const r of guests) {
      rows.push([
        r.contact?.organization ?? '', r.contact?.name ?? '',
        r.arrival_date ? formatDate(r.arrival_date) : '', r.departure_date ? formatDate(r.departure_date) : '',
        nightsBetween(r.arrival_date, r.departure_date),
        r.dietary_needs ?? '', r.accommodation_notes ?? '',
      ])
    }
    downloadCSV(`${ev.name} - hotel list.csv`, rows)
  }

  const keyContact = allContacts.find(c => c.id === ev.key_contact_id) ?? null
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
          <h1 className="text-2xl font-semibold">{ev.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {ev.starts_at && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDate(ev.starts_at)}
                {ev.ends_at && ev.ends_at.slice(0, 10) !== ev.starts_at.slice(0, 10) ? ` – ${formatDate(ev.ends_at)}` : ''}
              </span>
            )}
            {ev.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {ev.location}</span>}
            {ev.agenda_url && <a href={ev.agenda_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground hover:underline"><FileText className="h-4 w-4" /> Agenda</a>}
            {keyContact && <span className="flex items-center gap-1.5"><Star className="h-4 w-4" /> Key contact: {keyContact.name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={EVENT_STATUS_VARIANT[ev.status]} className="capitalize">{ev.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1.5" /> Edit</Button>
          <Button variant="outline" size="sm" className="text-destructive" disabled={busy} onClick={deleteEvent}><Trash2 className="h-4 w-4 mr-1.5" /> Delete</Button>
        </div>
      </div>

      {/* Response summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Signed up" value={summary.signedUp} icon={CheckCircle2} />
        <Stat label="No response" value={summary.noResponse} icon={Clock} />
        <Stat label="Awaiting reply" value={summary.awaitingReply} icon={Send} />
        <Stat label="Declined" value={summary.declined} icon={XCircle} />
      </div>

      {/* Catering & accommodation summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Utensils className="h-4 w-4" /> Catering &amp; accommodation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            <MiniStat label="Day 1" value={catering.day1} />
            <MiniStat label="Day 2" value={catering.day2} />
            <MiniStat label="Dinner 1" value={catering.dinner1} />
            <MiniStat label="Dinner 2" value={catering.dinner2} />
            <MiniStat label="Rooms" value={catering.rooms} />
          </div>
          {catering.dietary.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground">Dietary:</span>
              {catering.dietary.map(([label, count]) => (
                <Badge key={label} variant="secondary" className="font-normal">{label} × {count}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setAttendeeSearch(''); setAddOpen(true) }}><Plus className="h-4 w-4 mr-1.5" /> Add attendee</Button>
        <Button variant="outline" onClick={() => { setBulkText(''); setBulkOpen(true) }}><Plus className="h-4 w-4 mr-1.5" /> Add multiple</Button>
        <Button variant="outline" disabled={busy || invitedIds.length === 0} onClick={() => notify('event_invite', invitedIds)}>
          <Send className="h-4 w-4 mr-1.5" /> Send invite to no-response ({invitedIds.length})
        </Button>
        <Button variant="outline" disabled={busy || signedUpIds.length === 0} onClick={() => notify('agenda', signedUpIds)}>
          <FileText className="h-4 w-4 mr-1.5" /> Send agenda to signed-up ({signedUpIds.length})
        </Button>
        <Button variant="outline" disabled={busy || noReplyIds.length === 0} onClick={() => notify('no_reply_chase', noReplyIds)}>
          <Clock className="h-4 w-4 mr-1.5" /> Chase no-replies ({noReplyIds.length})
        </Button>
        <Button variant="outline" disabled={regs.length === 0} onClick={exportAttendeesCSV}>
          <Download className="h-4 w-4 mr-1.5" /> Export attendee list
        </Button>
        <Button variant="outline" disabled={catering.rooms === 0} onClick={exportHotelCSV}>
          <Download className="h-4 w-4 mr-1.5" /> Export hotel list
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
                <TableHead>Notes</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No attendees yet. Add someone to get started.</TableCell></TableRow>
              ) : regs.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.contact?.name ?? 'Unknown'}
                    {r.contact?.organization && <span className="block text-xs text-muted-foreground">{r.contact.organization}</span>}
                    {(r.day1_attending || r.day2_attending || r.dinner1_attending || r.dinner2_attending) && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {r.day1_attending && <AttendTag>Day 1</AttendTag>}
                        {r.day2_attending && <AttendTag>Day 2</AttendTag>}
                        {r.dinner1_attending && <AttendTag>Dinner 1</AttendTag>}
                        {r.dinner2_attending && <AttendTag>Dinner 2</AttendTag>}
                      </span>
                    )}
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
                    {r.accommodation_needed ? (
                      <span className="text-foreground">
                        <span className="flex items-center gap-1.5"><Bed className="h-3.5 w-3.5" /> {r.accommodation_notes || 'Needed'}</span>
                        {(r.arrival_date || r.departure_date) && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {r.arrival_date ? formatDate(r.arrival_date) : '?'} → {r.departure_date ? formatDate(r.departure_date) : '?'}
                            {nightsBetween(r.arrival_date, r.departure_date) && ` (${nightsBetween(r.arrival_date, r.departure_date)}n)`}
                          </span>
                        )}
                      </span>
                    ) : '—'}
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
                  <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                    {r.response_notes ? <span className="line-clamp-2" title={r.response_notes}>{r.response_notes}</span> : '—'}
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

      {/* Run sheet */}
      <RunSheetSection eventId={ev.id} initialItems={initialRunSheet} />

      {/* Budget */}
      <BudgetSection eventId={ev.id} initialItems={initialBudget} />

      {/* Add attendee dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAttendeeSearch('') }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add attendee</DialogTitle></DialogHeader>
          {unregistered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone in your contacts is already on this event. Add more people from the Contacts page.</p>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input autoFocus placeholder="Search name, org, group…" value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)} className="pl-9" />
              </div>
              {allGroups.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Add a whole group</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allGroups.map(g => (
                      <button key={g} disabled={busy} onClick={() => addGroup(g)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50">
                        + {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="max-h-[45vh] overflow-y-auto divide-y">
                {visibleUnregistered.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">No matching contacts.</p>
                ) : visibleUnregistered.map(c => (
                  <button key={c.id} disabled={busy} onClick={() => addAttendee(c.id)} className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-accent/40 px-2 rounded">
                    <span>
                      <span className="font-medium">{c.name}</span>
                      {c.organization && <span className="text-muted-foreground"> · {c.organization}</span>}
                    </span>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add multiple attendees dialog */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) setBulkText('') }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add multiple attendees</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste the list the key contact gave you, one per line. Each line can be a name, an email, or &ldquo;Name, email&rdquo;. New people are added to your contacts automatically.
            </p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={'Jane Doe, jane@acme.com\nJohn Smith <john@globex.com>\nmary@initech.com'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[160px] font-mono"
            />
            <p className="text-xs text-muted-foreground">{parseAttendees(bulkText).length} attendee(s) detected.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={() => bulkAddAttendees(parseAttendees(bulkText))} disabled={busy || parseAttendees(bulkText).length === 0}>
              {busy ? 'Adding…' : 'Add attendees'}
            </Button>
          </DialogFooter>
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

      {/* Edit conference dialog */}
      {editOpen && (
        <EditEventDialog event={ev} contacts={allContacts} onClose={() => setEditOpen(false)} onSave={updateEvent} />
      )}
    </div>
  )
}

function EditEventDialog({
  event, contacts, onClose, onSave,
}: { event: Event; contacts: Contact[]; onClose: () => void; onSave: (body: Partial<Event>) => Promise<boolean> }) {
  const toDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
  const [form, setForm] = useState({
    name: event.name,
    location: event.location ?? '',
    venue: event.venue ?? '',
    dinner_venue: event.dinner_venue ?? '',
    catering_contact: event.catering_contact ?? '',
    starts_at: toDate(event.starts_at),
    ends_at: toDate(event.ends_at),
    agenda_url: event.agenda_url ?? '',
    status: event.status,
    key_contact_id: event.key_contact_id ?? '',
    description: event.description ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const ok = await onSave({
      name: form.name.trim(),
      location: form.location || null,
      venue: form.venue || null,
      dinner_venue: form.dinner_venue || null,
      catering_contact: form.catering_contact || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      agenda_url: form.agenda_url || null,
      status: form.status,
      key_contact_id: form.key_contact_id || null,
      description: form.description || null,
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit conference</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Location (town/city)</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Venue</Label><Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} placeholder="Meeting venue" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Dinner venue</Label><Input value={form.dinner_venue} onChange={e => setForm({ ...form, dinner_venue: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Catering contact</Label><Input value={form.catering_contact} onChange={e => setForm({ ...form, catering_contact: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Starts</Label><Input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Ends</Label><Input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Agenda link</Label><Input value={form.agenda_url} onChange={e => setForm({ ...form, agenda_url: e.target.value })} placeholder="https://…" /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label>Key contact (optional)</Label>
            <Select value={form.key_contact_id || 'none'} onValueChange={v => setForm({ ...form, key_contact_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.organization ? ` · ${c.organization}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Whole nights between two ISO dates, or '' if either is missing.
function nightsBetween(arrival: string | null, departure: string | null): string {
  if (!arrival || !departure) return ''
  const ms = new Date(departure).getTime() - new Date(arrival).getTime()
  const n = Math.round(ms / 86_400_000)
  return n > 0 ? String(n) : ''
}

// Build a CSV (Excel-friendly, UTF-8 BOM) and trigger a download.
function downloadCSV(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map(r => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Parse a pasted attendee list: one per line, each a name, an email, or "Name, email".
function parseAttendees(text: string): { name: string; email: string }[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const email = line.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? ''
      let name = line.replace(email, '').replace(/[<>,;]+/g, ' ').trim()
      if (!name) name = email
      return { name, email }
    })
    .filter(p => p.name || p.email)
}

function AttendTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      {children}
    </span>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
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
  const [arrival, setArrival] = useState(reg.arrival_date ?? '')
  const [departure, setDeparture] = useState(reg.departure_date ?? '')
  const [dietary, setDietary] = useState(reg.dietary_needs ?? '')
  const [travel, setTravel] = useState(reg.travel_notes ?? '')
  const [day1, setDay1] = useState(!!reg.day1_attending)
  const [day2, setDay2] = useState(!!reg.day2_attending)
  const [dinner1, setDinner1] = useState(!!reg.dinner1_attending)
  const [dinner2, setDinner2] = useState(!!reg.dinner2_attending)
  const [responseNotes, setResponseNotes] = useState(reg.response_notes ?? '')
  const [replied, setReplied] = useState(!!reg.replied_at)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave({
      day1_attending: day1,
      day2_attending: day2,
      dinner1_attending: dinner1,
      dinner2_attending: dinner2,
      accommodation_needed: accNeeded,
      accommodation_notes: accNotes || null,
      arrival_date: arrival || null,
      departure_date: departure || null,
      dietary_needs: dietary || null,
      travel_notes: travel || null,
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
          <div className="space-y-1.5">
            <Label>Attending</Label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day1} onChange={e => setDay1(e.target.checked)} className="h-4 w-4" /> Day 1</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day2} onChange={e => setDay2(e.target.checked)} className="h-4 w-4" /> Day 2</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dinner1} onChange={e => setDinner1(e.target.checked)} className="h-4 w-4" /> Dinner 1</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dinner2} onChange={e => setDinner2(e.target.checked)} className="h-4 w-4" /> Dinner 2</label>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Dietary needs</Label><Input value={dietary} onChange={e => setDietary(e.target.value)} placeholder="e.g. vegetarian, gluten free" /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={accNeeded} onChange={e => setAccNeeded(e.target.checked)} className="h-4 w-4" />
            Needs accommodation
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Arrival</Label><Input type="date" value={arrival} onChange={e => setArrival(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Departure</Label><Input type="date" value={departure} onChange={e => setDeparture(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Accommodation notes</Label><Input value={accNotes} onChange={e => setAccNotes(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Travel / flights</Label><Input value={travel} onChange={e => setTravel(e.target.value)} placeholder="e.g. arrives 4:55pm, departs 5:50pm" /></div>
          <div className="space-y-1.5"><Label>Notes</Label><textarea value={responseNotes} onChange={e => setResponseNotes(e.target.value)} placeholder="Notes about this person for this event" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" /></div>
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
