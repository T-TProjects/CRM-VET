import type { Contact, Event, EmailTemplate } from '@/types'
import { formatDate } from '@/lib/utils'

/** Variables available to email templates via {{placeholder}} syntax. */
export function templateVars(contact: Contact, event: Event): Record<string, string> {
  const start = event.starts_at ? formatDate(event.starts_at) : ''
  const end = event.ends_at ? formatDate(event.ends_at) : ''
  const sameDay = !!event.starts_at && !!event.ends_at && event.starts_at.slice(0, 10) === event.ends_at.slice(0, 10)
  let eventDates = start || end || 'TBC'
  if (start && end && !sameDay) eventDates = `${start} – ${end}`

  return {
    contact_name: contact.name ?? '',
    contact_email: contact.email ?? '',
    event_name: event.name ?? '',
    event_location: event.location ?? '',
    event_date: event.starts_at ? formatDate(event.starts_at) : 'TBC',
    // Full date range, e.g. "8 Sep 2026 – 9 Sep 2026" (single day if start == end).
    event_dates: eventDates,
    agenda_url: event.agenda_url ?? '',
    // Named document links, one per line: "Agenda: https://…"
    documents: (event.documents ?? [])
      .filter(d => d && d.url && d.url.trim())
      .map(d => (d.label && d.label.trim() ? `${d.label.trim()}: ${d.url.trim()}` : d.url.trim()))
      .join('\n'),
  }
}

/** Replace {{key}} occurrences with values; unknown keys collapse to empty string. */
export function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '')
}

export function renderTemplate(tpl: EmailTemplate, vars: Record<string, string>) {
  return { subject: render(tpl.subject, vars), body: render(tpl.body, vars) }
}

/** Default wording for the editable "Event update" template. */
export const UPDATE_TEMPLATE_DEFAULT = {
  key: 'event_update',
  name: 'Event update',
  subject: 'Update: {{event_name}}',
  body:
    'Hi {{contact_name}},\n\n' +
    '[Type your update here — for example a change to the start time or the dinner venue.]\n\n' +
    'Thanks,\nTonia',
}

/**
 * Render the "Event update" email for one recipient from an editable subject/body
 * (which may contain {{placeholders}}), optionally appending a reminder of the
 * agenda and event documents — only the ones that actually exist.
 */
export function renderUpdateEmail(
  contact: Contact,
  event: Event,
  subjectTpl: string,
  bodyTpl: string,
  includeDocs: boolean
): { subject: string; body: string } {
  const vars = templateVars(contact, event)
  let body = render(bodyTpl, vars)

  if (includeDocs) {
    const reminder: string[] = []
    if (vars.agenda_url) reminder.push(`Agenda: ${vars.agenda_url}`)
    if (vars.documents) reminder.push(vars.documents)
    if (reminder.length) {
      body += `\n\nAs a reminder, here are the details for ${vars.event_name}:\n\n` + reminder.join('\n')
    }
  }

  return { subject: render(subjectTpl, vars), body }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Turn a plain-text email body into simple, branded HTML: Calibri font,
 * clickable links, and the company logo below the signature.
 */
export function bodyToHtml(text: string): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://crm-vet-six.vercel.app').replace(/\/+$/, '')
  const logo = `${appUrl}/tvc-logo.png`
  const escaped = escapeHtml(text)
  // Bold a short "Label:" at the start of a line (e.g. Dates:, Location:,
  // Agenda Link:) — only when a value follows the colon on the same line.
  const bolded = escaped.replace(/^([ \t]*)([^\s:][^:\n]{0,38}):(\s+)(?=\S)/gm, '$1<strong>$2:</strong>$3')
  const linked = bolded.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0D3354;">$1</a>')
  const withBreaks = linked.replace(/\r?\n/g, '<br>')
  return (
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="font-family: Calibri, 'Segoe UI', Helvetica, Arial, sans-serif; font-size:15px; color:#333333; line-height:1.55;">` +
    withBreaks +
    `<br><br><img src="${logo}" alt="The Vet Company" width="180" style="width:180px;height:auto;border:0;display:block;margin-top:6px;">` +
    `</div></body></html>`
  )
}
