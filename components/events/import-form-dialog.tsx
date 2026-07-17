'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import type { Registration } from '@/types'

// One person parsed from the pasted form spreadsheet.
export interface ParsedAttendee {
  name: string
  email: string | null
  clinic: string | null
  dietary: string | null
  day1: boolean
  day2: boolean
  dinner1: boolean
  dinner2: boolean
  accommodation_needed: boolean
  arrival_date: string | null
  departure_date: string | null
  travel: string | null
  notes: string | null
}

export type DateOrder = 'dmy' | 'mdy'

// Parse a numeric date. `order` says which way round ambiguous dates are:
// 'dmy' = NZ day-first, 'mdy' = US month-first (how Microsoft Forms exports).
// A number over 12 settles it either way regardless of `order`.
function parseDateFlexible(s: string, order: DateOrder): string | null {
  const t = s.trim()
  if (!t) return null
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    let year = Number(m[3])
    if (year < 100) year += 2000
    let day: number
    let month: number
    if (a > 12 && b <= 12) { day = a; month = b }
    else if (b > 12 && a <= 12) { day = b; month = a }
    else if (order === 'mdy') { month = a; day = b }
    else { day = a; month = b }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

// "2026-09-08" → "08 Sep 2026" for the preview.
function friendlyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ParseResult {
  people: ParsedAttendee[]
  skipped: number
  missingColumns: string[]
  noHeader: boolean
  /** Date order worked out from the data itself (null = couldn't tell). */
  detectedOrder: DateOrder | null
  /** Date order actually used for this parse. */
  usedOrder: DateOrder
  /** How many rows had accommodation dates. */
  dateCount: number
}

// Parse rows copied from the Microsoft Forms Excel export (tab-separated,
// heading row included). Column matching is by keyword so extra columns
// (ID, Start time, etc.) are ignored.
export function parseFormSpreadsheet(text: string, dateOrder?: DateOrder): ParseResult {
  const empty: ParseResult = {
    people: [], skipped: 0, missingColumns: [], noHeader: false,
    detectedOrder: null, usedOrder: dateOrder ?? 'mdy', dateCount: 0,
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return empty

  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const findLast = (pred: (h: string) => boolean) => {
    let idx = -1
    headers.forEach((h, i) => { if (pred(h)) idx = i })
    return idx
  }
  const col = {
    name: findLast(h => /attendee|full name/.test(h)),
    email: findLast(h => /email/.test(h)),
    clinic: findLast(h => /clinic/.test(h)),
    days: findLast(h => /which day|days will/.test(h)),
    dinner: findLast(h => /dinner/.test(h)),
    dietary: findLast(h => /dietary/.test(h)),
    checkin: findLast(h => /check.?in/.test(h)),
    // "depart" alone would also match the travel question ("arrival & departure times"),
    // so only accept it on headers that aren't about travel.
    checkout: findLast(h => /check.?out/.test(h) || (/depart/.test(h) && !/travel|flight|arrival|time/.test(h))),
    accom: findLast(h => /accommodation/.test(h) && !/check.?in|check.?out|depart/.test(h)),
    travel: findLast(h => /travel|flight/.test(h)),
    notes: findLast(h => /anything else|notes/.test(h)),
  }
  if (col.name === -1) col.name = findLast(h => h === 'name')

  // No recognisable heading row: we can't map columns safely.
  if (col.name === -1) return { ...empty, noHeader: true }

  const missingColumns: string[] = []
  if (col.email === -1) missingColumns.push('Email')
  if (col.clinic === -1) missingColumns.push('Clinic')
  if (col.days === -1) missingColumns.push('Days attending')

  const get = (cells: string[], i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '')

  // Work out whether dates are day-first (NZ) or month-first (the US style
  // Microsoft Forms exports use): any date with a number over 12 settles it.
  let detected: DateOrder | null = null
  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    for (const idx of [col.checkin, col.checkout]) {
      const m = get(cells, idx).match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
      if (!m) continue
      const a = Number(m[1])
      const b = Number(m[2])
      if (a > 12 && b <= 12) detected = 'dmy'
      else if (b > 12 && a <= 12) detected = 'mdy'
      if (detected) break
    }
    if (detected) break
  }
  const usedOrder: DateOrder = dateOrder ?? detected ?? 'mdy'

  const people: ParsedAttendee[] = []
  let skipped = 0
  let dateCount = 0

  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    const name = get(cells, col.name)
    if (!name) { skipped++; continue }
    if (get(cells, col.checkin) || get(cells, col.checkout)) dateCount++
    const days = get(cells, col.days).toLowerCase()
    const dinner = get(cells, col.dinner).toLowerCase()
    const accomAns = get(cells, col.accom).toLowerCase()
    const rawEmail = get(cells, col.email)
    people.push({
      name,
      email: rawEmail && rawEmail.includes('@') ? rawEmail : null,
      clinic: get(cells, col.clinic) || null,
      dietary: get(cells, col.dietary) || null,
      day1: /both/.test(days) || /day\s*1/.test(days),
      day2: /both/.test(days) || /day\s*2/.test(days),
      dinner1: /both/.test(dinner) || /night\s*1|dinner\s*1/.test(dinner) || /^y(es)?\b/.test(dinner),
      dinner2: /both/.test(dinner) || /night\s*2|dinner\s*2/.test(dinner),
      accommodation_needed: /^y(es)?\b/.test(accomAns),
      arrival_date: parseDateFlexible(get(cells, col.checkin), usedOrder),
      departure_date: parseDateFlexible(get(cells, col.checkout), usedOrder),
      travel: get(cells, col.travel) || null,
      notes: get(cells, col.notes) || null,
    })
  }
  return { people, skipped, missingColumns, noHeader: false, detectedOrder: detected, usedOrder, dateCount }
}

function daysLabel(p: ParsedAttendee): string {
  if (p.day1 && p.day2) return 'Both'
  if (p.day1) return 'Day 1'
  if (p.day2) return 'Day 2'
  return '—'
}
function dinnerLabel(p: ParsedAttendee): string {
  if (p.dinner1 && p.dinner2) return 'Both'
  if (p.dinner1) return 'Dinner 1'
  if (p.dinner2) return 'Dinner 2'
  return '—'
}

export function ImportFormDialog({
  eventId, onClose, onImported,
}: {
  eventId: string
  onClose: () => void
  onImported: (regs: Registration[]) => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [dateOrder, setDateOrder] = useState<DateOrder | null>(null)
  const { toast } = useToast()

  const parsed = useMemo(() => parseFormSpreadsheet(text, dateOrder ?? undefined), [text, dateOrder])

  async function doImport() {
    setBusy(true)
    const res = await fetch(`/api/events/${eventId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ people: parsed.people }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      toast({ title: 'Could not import', description: json.error, variant: 'destructive' })
      return
    }
    onImported((json.registrations ?? []) as Registration[])
    toast({ title: `Imported ${json.imported} attendee${json.imported === 1 ? '' : 's'}` })
  }

  const previewRows = parsed.people.slice(0, 8)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import attendees from your form</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            In Microsoft Forms open <span className="font-medium text-foreground">Responses → Open in Excel</span>.
            Select all the responses <span className="font-medium text-foreground">including the heading row</span>, copy, and paste below.
            Names, emails, clinics, days, dinner, dietary and accommodation dates are all matched automatically.
            Pasting the same list again later just updates people — no duplicates.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'Paste the copied spreadsheet rows here…'}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono"
          />

          {text.trim() !== '' && parsed.noHeader && (
            <p className="text-sm text-destructive">
              I couldn&rsquo;t find the column headings. Make sure you copy the heading row (the row with &ldquo;Attendee full name&rdquo; etc.) along with the responses.
            </p>
          )}

          {parsed.dateCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Dates in the paste are:</span>
              <button
                type="button"
                onClick={() => setDateOrder('dmy')}
                className={`rounded-full border px-2.5 py-1 ${parsed.usedOrder === 'dmy' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
              >
                Day / Month (NZ)
              </button>
              <button
                type="button"
                onClick={() => setDateOrder('mdy')}
                className={`rounded-full border px-2.5 py-1 ${parsed.usedOrder === 'mdy' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
              >
                Month / Day (US)
              </button>
              <span className="text-muted-foreground">— check the accommodation dates below look right, and flip this if not.</span>
            </div>
          )}

          {parsed.people.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Found {parsed.people.length} attendee{parsed.people.length === 1 ? '' : 's'}
                {parsed.skipped > 0 ? ` (${parsed.skipped} row${parsed.skipped === 1 ? '' : 's'} skipped — no name)` : ''}:
              </p>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Dinner</TableHead>
                      <TableHead>Dietary</TableHead>
                      <TableHead>Accommodation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell className="text-sm">{p.clinic ?? '—'}</TableCell>
                        <TableCell className="text-sm">{p.email ?? '—'}</TableCell>
                        <TableCell className="text-sm">{daysLabel(p)}</TableCell>
                        <TableCell className="text-sm">{dinnerLabel(p)}</TableCell>
                        <TableCell className="text-sm">{p.dietary ?? '—'}</TableCell>
                        <TableCell className="text-sm">
                          {p.accommodation_needed
                            ? `Yes${p.arrival_date && p.departure_date ? ` (${friendlyDate(p.arrival_date)} → ${friendlyDate(p.departure_date)})` : ''}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsed.people.length > previewRows.length && (
                <p className="text-xs text-muted-foreground">…and {parsed.people.length - previewRows.length} more.</p>
              )}
              {parsed.missingColumns.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Heads up: no {parsed.missingColumns.join(', ').toLowerCase()} column{parsed.missingColumns.length === 1 ? '' : 's'} found in the paste —
                  those details will be left blank.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={doImport} disabled={busy || parsed.people.length === 0}>
            {busy ? 'Importing…' : `Import ${parsed.people.length || ''} attendee${parsed.people.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
