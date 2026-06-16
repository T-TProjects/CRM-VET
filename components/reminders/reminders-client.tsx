'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, daysSince } from '@/lib/utils'
import type { Reminder, Contact } from '@/types'

const empty = { title: '', notes: '', due_date: '', contact_id: '' }

export function RemindersClient({ initialReminders, contacts }: { initialReminders: Reminder[]; contacts: Contact[] }) {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function create() {
    if (!form.title.trim() || !form.due_date) {
      toast({ title: 'Title and due date are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, contact_id: form.contact_id || null }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { toast({ title: 'Could not create', description: json.error, variant: 'destructive' }); return }
    setReminders(prev => [...prev, json.reminder as Reminder].sort((a, b) => a.due_date.localeCompare(b.due_date)))
    setOpen(false)
    setForm(empty)
    toast({ title: 'Reminder added' })
  }

  async function toggle(r: Reminder) {
    const res = await fetch(`/api/reminders/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !r.completed }),
    })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Could not update', variant: 'destructive' }); return }
    setReminders(prev => prev.map(x => x.id === r.id ? (json.reminder as Reminder) : x))
  }

  async function remove(r: Reminder) {
    const res = await fetch(`/api/reminders/${r.id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Could not delete', variant: 'destructive' }); return }
    setReminders(prev => prev.filter(x => x.id !== r.id))
  }

  const open_ = reminders.filter(r => !r.completed)
  const done = reminders.filter(r => r.completed)

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reminders</h1>
          <p className="text-sm text-muted-foreground">{open_.length} open</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Add reminder</Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {open_.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nothing open. Nice.</p>
          ) : open_.map(r => {
            const overdue = daysSince(r.due_date) >= 0
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" checked={false} onChange={() => toggle(r)} className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.contact?.name ? `${r.contact.name} · ` : ''}
                    <span className={overdue ? 'text-destructive' : ''}>Due {formatDate(r.due_date)}</span>
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed</p>
          <Card>
            <CardContent className="p-0 divide-y">
              {done.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <input type="checkbox" checked readOnly onChange={() => toggle(r)} className="h-4 w-4 shrink-0" />
                  <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">{r.title}</p>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add reminder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Linked contact (optional)</Label>
              <Select value={form.contact_id || 'none'} onValueChange={v => setForm({ ...form, contact_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
