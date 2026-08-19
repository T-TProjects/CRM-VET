import type { Contact, Event, EmailTemplate } from '@/types'
import { formatDate } from '@/lib/utils'

/** Variables available to email templates via {{placeholder}} syntax. */
export function templateVars(contact: Contact, event: Event): Record<string, string> {
  return {
    contact_name: contact.name ?? '',
    contact_email: contact.email ?? '',
    event_name: event.name ?? '',
    event_location: event.location ?? '',
    event_date: event.starts_at ? formatDate(event.starts_at) : 'TBC',
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
