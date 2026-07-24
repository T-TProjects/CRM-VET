// Build and download a polished Word (.docx) version of the meeting minutes,
// entirely in the browser. The `docx` library is imported lazily so it only
// loads when someone actually clicks the button.

import type { MeetingMinutes } from '@/types'

const NAVY = '1F3B57'
const GREY = '545554'

export async function downloadMinutesDocx(fileBase: string, m: MeetingMinutes) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
  } = await import('docx')

  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 260, after: 100 },
      children: [new TextRun({ text, bold: true, color: NAVY, size: 26 })],
    })

  const body = (text: string) =>
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 22 })] })

  // docx block elements (Paragraph | Table). Kept loose because the classes
  // come from a lazy import.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = []

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: m.title, bold: true, color: NAVY, size: 40 })],
    })
  )
  if (m.date?.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: m.date, color: GREY, size: 20 })],
      })
    )
  }

  // Present / Apologies
  if (m.attendees.length) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: 'Present: ', bold: true, size: 22 }),
          new TextRun({ text: m.attendees.join(', '), size: 22 }),
        ],
      })
    )
  }
  if (m.apologies.length) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: 'Apologies: ', bold: true, size: 22 }),
          new TextRun({ text: m.apologies.join(', '), size: 22 }),
        ],
      })
    )
  }

  // Summary
  if (m.summary?.trim()) {
    children.push(heading('Summary'))
    children.push(body(m.summary))
  }

  // Agenda items
  if (m.agenda_items.length) {
    children.push(heading('Agenda'))
    m.agenda_items.forEach((a, i) => {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          children: [new TextRun({ text: `${i + 1}. ${a.topic}`, bold: true, size: 22 })],
        })
      )
      if (a.discussion?.trim()) {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: 360 },
            children: [new TextRun({ text: a.discussion, size: 22 })],
          })
        )
      }
    })
  }

  // Decisions
  if (m.decisions.length) {
    children.push(heading('Decisions'))
    m.decisions.forEach((d) => {
      const runs = [
        new TextRun({ text: `${d.topic}: `, bold: true, size: 22 }),
        new TextRun({ text: d.decision, size: 22 }),
      ]
      if (d.outcome?.trim()) runs.push(new TextRun({ text: `  (${d.outcome})`, italics: true, color: GREY, size: 22 }))
      children.push(new Paragraph({ spacing: { after: 100 }, bullet: { level: 0 }, children: runs }))
    })
  }

  // Action items — a table reads best
  if (m.action_items.length) {
    children.push(heading('Action items'))
    const border = { style: BorderStyle.SINGLE, size: 1, color: 'D5D8DC' }
    const borders = { top: border, bottom: border, left: border, right: border }
    const cell = (text: string, opts: { bold?: boolean; color?: string; fill?: string } = {}) =>
      new TableCell({
        borders,
        shading: opts.fill ? { fill: opts.fill } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: 20 })] })],
      })
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        cell('Action', { bold: true, color: 'FFFFFF', fill: NAVY }),
        cell('Owner', { bold: true, color: 'FFFFFF', fill: NAVY }),
        cell('Due', { bold: true, color: 'FFFFFF', fill: NAVY }),
      ],
    })
    const rows = [headerRow]
    m.action_items.forEach((a) => {
      rows.push(new TableRow({ children: [cell(a.action), cell(a.owner ?? '—'), cell(a.due ?? '—')] }))
    })
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [5400, 2400, 2400],
        rows,
      })
    )
  }

  // Next meeting
  if (m.next_meeting?.trim()) {
    children.push(heading('Next meeting'))
    children.push(body(m.next_meeting))
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileBase}-minutes.docx`
  a.click()
  URL.revokeObjectURL(url)
}
