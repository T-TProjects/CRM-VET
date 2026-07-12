'use client'

import { useState } from 'react'
import { Plus, Trash2, ListOrdered } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import type { RunSheetItem } from '@/types'

export function RunSheetSection({ eventId, initialItems }: { eventId: string; initialItems: RunSheetItem[] }) {
  const [items, setItems] = useState<RunSheetItem[]>(initialItems)
  const [editing, setEditing] = useState<RunSheetItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  async function addItem(body: Partial<RunSheetItem>) {
    setBusy(true)
    const res = await fetch(`/api/events/${eventId}/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, sort_order: items.length }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { toast({ title: 'Could not add', description: json.error, variant: 'destructive' }); return }
    setItems(prev => [...prev, json.item as RunSheetItem])
    setAdding(false)
  }

  async function updateItem(id: string, body: Partial<RunSheetItem>) {
    const res = await fetch(`/api/agenda-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Could not save', description: json.error, variant: 'destructive' }); return }
    setItems(prev => prev.map(i => (i.id === id ? (json.item as RunSheetItem) : i)))
    setEditing(null)
  }

  async function removeItem(item: RunSheetItem) {
    if (!confirm('Remove this run sheet item?')) return
    const res = await fetch(`/api/agenda-items/${item.id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Could not remove', variant: 'destructive' }); return }
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-1.5"><ListOrdered className="h-4 w-4" /> Run sheet</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1.5" /> Add item</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Time</TableHead>
              <TableHead className="w-[80px]">Day</TableHead>
              <TableHead>Session / activity</TableHead>
              <TableHead>Presenter</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No run sheet items yet. Add one to build the order of the day.</TableCell></TableRow>
            ) : items.map(i => (
              <TableRow key={i.id}>
                <TableCell>{i.start_time || '—'}</TableCell>
                <TableCell>{i.day || '—'}</TableCell>
                <TableCell className="font-medium">{i.title || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.presenter || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.location || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[220px]"><span className="line-clamp-2" title={i.notes ?? ''}>{i.notes || '—'}</span></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(i)}>Edit</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {adding && <ItemDialog title="Add run sheet item" onClose={() => setAdding(false)} onSave={addItem} busy={busy} />}
      {editing && <ItemDialog title="Edit run sheet item" item={editing} onClose={() => setEditing(null)} onSave={(b) => updateItem(editing.id, b)} busy={busy} />}
    </Card>
  )
}

function ItemDialog({
  title, item, onClose, onSave, busy,
}: {
  title: string
  item?: RunSheetItem
  onClose: () => void
  onSave: (b: Partial<RunSheetItem>) => void | Promise<void>
  busy: boolean
}) {
  const [form, setForm] = useState({
    start_time: item?.start_time ?? '',
    day: item?.day ?? '',
    title: item?.title ?? '',
    presenter: item?.presenter ?? '',
    location: item?.location ?? '',
    notes: item?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave({
      start_time: form.start_time || null,
      day: form.day || null,
      title: form.title || null,
      presenter: form.presenter || null,
      location: form.location || null,
      notes: form.notes || null,
    })
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Time</Label><Input value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} placeholder="e.g. 9:00am" /></div>
            <div className="space-y-1.5"><Label>Day</Label><Input value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} placeholder="e.g. Day 1" /></div>
          </div>
          <div className="space-y-1.5"><Label>Session / activity</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Presenter / lead</Label><Input value={form.presenter} onChange={e => setForm({ ...form, presenter: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || busy}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
