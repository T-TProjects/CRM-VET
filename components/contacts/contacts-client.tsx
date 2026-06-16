'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { Contact, ContactStatus } from '@/types'

const STATUS_VARIANT: Record<ContactStatus, 'success' | 'secondary' | 'outline'> = {
  active: 'success',
  prospect: 'secondary',
  inactive: 'outline',
}

const empty = {
  name: '', organization: '', email: '', phone: '',
  status: 'prospect' as ContactStatus, dietary_needs: '', accommodation_notes: '', notes: '',
}

export function ContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return contacts
    return contacts.filter(c =>
      [c.name, c.organization, c.email].filter(Boolean).some(v => v!.toLowerCase().includes(q))
    )
  }, [contacts, search])

  function openNew() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({
      name: c.name, organization: c.organization ?? '', email: c.email ?? '', phone: c.phone ?? '',
      status: c.status, dietary_needs: c.dietary_needs ?? '',
      accommodation_notes: c.accommodation_notes ?? '', notes: c.notes ?? '',
    })
    setOpen(true)
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const url = editing ? `/api/contacts/${editing.id}` : '/api/contacts'
    const method = editing ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast({ title: 'Could not save', description: json.error, variant: 'destructive' })
      return
    }
    const saved = json.contact as Contact
    setContacts(prev =>
      editing ? prev.map(c => (c.id === saved.id ? saved : c)) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    )
    setOpen(false)
    toast({ title: editing ? 'Contact updated' : 'Contact added' })
  }

  async function remove(c: Contact) {
    if (!confirm(`Delete ${c.name}? This also removes their event registrations.`)) return
    const res = await fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast({ title: 'Could not delete', variant: 'destructive' })
      return
    }
    setContacts(prev => prev.filter(x => x.id !== c.id))
    toast({ title: 'Contact deleted' })
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">{contacts.length} people</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Add contact</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, org, email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No contacts found.</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.organization ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[c.status]} className="capitalize">{c.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit contact' : 'Add contact'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Organization"><Input value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v: ContactStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <Field label="Dietary needs (default)"><Input value={form.dietary_needs} onChange={e => setForm({ ...form, dietary_needs: e.target.value })} placeholder="e.g. vegetarian, nut allergy" /></Field>
            <Field label="Accommodation notes (default)"><Input value={form.accommodation_notes} onChange={e => setForm({ ...form, accommodation_notes: e.target.value })} placeholder="e.g. ground floor room" /></Field>
            <Field label="Notes"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px]" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
