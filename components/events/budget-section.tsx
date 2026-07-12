'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import type { BudgetItem } from '@/types'

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD' })
}

export function BudgetSection({ eventId, initialItems }: { eventId: string; initialItems: BudgetItem[] }) {
  const [items, setItems] = useState<BudgetItem[]>(initialItems)
  const [editing, setEditing] = useState<BudgetItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const totals = useMemo(() => {
    let est = 0, act = 0
    for (const i of items) { est += i.estimated ?? 0; act += i.actual ?? 0 }
    return { est, act, variance: act - est }
  }, [items])

  async function addItem(body: Partial<BudgetItem>) {
    setBusy(true)
    const res = await fetch(`/api/events/${eventId}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, sort_order: items.length }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { toast({ title: 'Could not add', description: json.error, variant: 'destructive' }); return }
    setItems(prev => [...prev, json.item as BudgetItem])
    setAdding(false)
  }

  async function updateItem(id: string, body: Partial<BudgetItem>) {
    const res = await fetch(`/api/budget-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Could not save', description: json.error, variant: 'destructive' }); return }
    setItems(prev => prev.map(i => (i.id === id ? (json.item as BudgetItem) : i)))
    setEditing(null)
  }

  async function removeItem(item: BudgetItem) {
    if (!confirm('Remove this budget line?')) return
    const res = await fetch(`/api/budget-items/${item.id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Could not remove', variant: 'destructive' }); return }
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-1.5"><Wallet className="h-4 w-4" /> Budget</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1.5" /> Add line</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Estimated</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No budget lines yet. Add one to start tracking costs.</TableCell></TableRow>
            ) : items.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.category || '—'}</TableCell>
                <TableCell className="text-right">{money(i.estimated)}</TableCell>
                <TableCell className="text-right">{money(i.actual)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {i.estimated != null && i.actual != null ? money(i.actual - i.estimated) : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[220px]"><span className="line-clamp-2" title={i.notes ?? ''}>{i.notes || '—'}</span></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(i)}>Edit</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{money(totals.est)}</TableCell>
                <TableCell className="text-right">{money(totals.act)}</TableCell>
                <TableCell className="text-right">{money(totals.variance)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {adding && <LineDialog title="Add budget line" onClose={() => setAdding(false)} onSave={addItem} busy={busy} />}
      {editing && <LineDialog title="Edit budget line" item={editing} onClose={() => setEditing(null)} onSave={(b) => updateItem(editing.id, b)} busy={busy} />}
    </Card>
  )
}

function LineDialog({
  title, item, onClose, onSave, busy,
}: {
  title: string
  item?: BudgetItem
  onClose: () => void
  onSave: (b: Partial<BudgetItem>) => void | Promise<void>
  busy: boolean
}) {
  const [form, setForm] = useState({
    category: item?.category ?? '',
    estimated: item?.estimated != null ? String(item.estimated) : '',
    actual: item?.actual != null ? String(item.actual) : '',
    notes: item?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const toNum = (s: string): number | null => {
    const t = s.trim()
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  async function save() {
    setSaving(true)
    await onSave({
      category: form.category || null,
      estimated: toNum(form.estimated),
      actual: toNum(form.actual),
      notes: form.notes || null,
    })
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Venue hire, Catering, Dinner" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Estimated ($)</Label><Input type="number" inputMode="decimal" value={form.estimated} onChange={e => setForm({ ...form, estimated: e.target.value })} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Actual ($)</Label><Input type="number" inputMode="decimal" value={form.actual} onChange={e => setForm({ ...form, actual: e.target.value })} placeholder="0.00" /></div>
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
