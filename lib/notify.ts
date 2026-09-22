import { getAdminClient, getFreshAccessToken, sendGmail, type GmailTokenRow } from '@/lib/gmail'
import { renderTemplate, templateVars, bodyToHtml, buildUpdateEmail } from '@/lib/templates'
import type { Contact, Event, EmailTemplate, Registration } from '@/types'

export interface NotifyResult {
  sent: number
  skipped: number
  registrations: Registration[]
  error?: string
}

/**
 * Send a template email to a set of registrations on an event, then stamp
 * notified_at (and agenda_sent_at for the agenda template). Logs each sent
 * email so the Gmail sync can match replies on the thread.
 */
export async function sendTemplateToRegistrations(
  eventId: string,
  templateKey: string,
  registrationIds: string[]
): Promise<NotifyResult> {
  const admin = getAdminClient()

  const { data: event } = await admin.from('events').select('*').eq('id', eventId).single()
  if (!event) return { sent: 0, skipped: 0, registrations: [], error: 'Event not found' }

  const { data: template } = await admin
    .from('email_templates')
    .select('*')
    .eq('key', templateKey)
    .single()
  if (!template) return { sent: 0, skipped: 0, registrations: [], error: `Template "${templateKey}" not found` }

  const { data: tokens } = await admin
    .from('gmail_tokens')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
  const token = (tokens?.[0] as GmailTokenRow | undefined)
  if (!token) return { sent: 0, skipped: 0, registrations: [], error: 'No Gmail account connected' }

  const accessToken = await getFreshAccessToken(token, admin)
  if (!accessToken) return { sent: 0, skipped: 0, registrations: [], error: 'Could not refresh Gmail access' }

  const { data: regs } = await admin
    .from('registrations')
    .select('*, contact:contacts(*)')
    .eq('event_id', eventId)
    .in('id', registrationIds)

  const isAgenda = templateKey === 'agenda'
  const nowIso = new Date().toISOString()
  const updated: Registration[] = []
  let sent = 0
  let skipped = 0

  for (const reg of (regs ?? []) as Registration[]) {
    const contact = reg.contact as Contact | undefined
    if (!contact?.email) { skipped++; continue }

    const { subject, body } = renderTemplate(template as EmailTemplate, templateVars(contact, event as Event))
    const result = await sendGmail(accessToken, token.email, { to: contact.email, subject, body, html: bodyToHtml(body) })
    if (!result) { skipped++; continue }

    const patch: Record<string, unknown> = { notified_at: nowIso, updated_at: nowIso }
    if (isAgenda) patch.agenda_sent_at = nowIso

    const { data: savedReg } = await admin
      .from('registrations')
      .update(patch)
      .eq('id', reg.id)
      .select('*, contact:contacts(*)')
      .single()
    if (savedReg) updated.push(savedReg as Registration)

    // Log the sent email so the sync can match replies by thread.
    await admin.from('emails').insert({
      thread_id: result.threadId,
      from_email: token.email,
      from_name: 'Tonia CRM',
      subject,
      body_text: body,
      received_at: nowIso,
      is_read: true,
      contact_id: contact.id,
      event_id: eventId,
      registration_id: reg.id,
    })

    sent++
  }

  return { sent, skipped, registrations: updated }
}

/**
 * Send a one-off "update / last-minute notes" email to a set of registrations.
 * Uses the coordinator's typed note plus an optional agenda/documents reminder.
 * Logs each sent email so replies thread, but does NOT change notified/reply
 * status — an update isn't an invitation.
 */
export async function sendUpdateToRegistrations(
  eventId: string,
  note: string,
  includeDocs: boolean,
  registrationIds: string[]
): Promise<NotifyResult> {
  const admin = getAdminClient()

  const { data: event } = await admin.from('events').select('*').eq('id', eventId).single()
  if (!event) return { sent: 0, skipped: 0, registrations: [], error: 'Event not found' }

  const { data: tokens } = await admin
    .from('gmail_tokens')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
  const token = tokens?.[0] as GmailTokenRow | undefined
  if (!token) return { sent: 0, skipped: 0, registrations: [], error: 'No Gmail account connected' }

  const accessToken = await getFreshAccessToken(token, admin)
  if (!accessToken) return { sent: 0, skipped: 0, registrations: [], error: 'Could not refresh Gmail access' }

  const { data: regs } = await admin
    .from('registrations')
    .select('*, contact:contacts(*)')
    .eq('event_id', eventId)
    .in('id', registrationIds)

  const nowIso = new Date().toISOString()
  let sent = 0
  let skipped = 0

  for (const reg of (regs ?? []) as Registration[]) {
    const contact = reg.contact as Contact | undefined
    if (!contact?.email) { skipped++; continue }

    const { subject, body } = buildUpdateEmail(contact, event as Event, note, includeDocs)
    const result = await sendGmail(accessToken, token.email, { to: contact.email, subject, body, html: bodyToHtml(body) })
    if (!result) { skipped++; continue }

    // Log the sent email so the sync can match replies by thread.
    await admin.from('emails').insert({
      thread_id: result.threadId,
      from_email: token.email,
      from_name: 'Tonia CRM',
      subject,
      body_text: body,
      received_at: nowIso,
      is_read: true,
      contact_id: contact.id,
      event_id: eventId,
      registration_id: reg.id,
    })

    sent++
  }

  return { sent, skipped, registrations: [] }
}

/**
 * Send a TEST of an update email to a single address only — no attendees are
 * emailed and nothing is logged. Uses the event's real agenda/documents but a
 * sample attendee name, and prefixes the subject with [TEST].
 */
export async function sendTestUpdateEmail(
  eventId: string,
  note: string,
  includeDocs: boolean,
  to: string
): Promise<{ ok?: boolean; error?: string }> {
  const admin = getAdminClient()

  const { data: event } = await admin.from('events').select('*').eq('id', eventId).single()
  if (!event) return { error: 'Event not found' }

  const { data: tokens } = await admin
    .from('gmail_tokens')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
  const token = tokens?.[0] as GmailTokenRow | undefined
  if (!token) return { error: 'No Gmail account connected. Connect one in Settings first.' }

  const accessToken = await getFreshAccessToken(token, admin)
  if (!accessToken) return { error: 'Could not refresh Gmail access' }

  const sampleContact = { name: 'there', email: to } as unknown as Contact
  const { subject, body } = buildUpdateEmail(sampleContact, event as Event, note, includeDocs)
  const result = await sendGmail(accessToken, token.email, { to, subject: `[TEST] ${subject}`, body, html: bodyToHtml(body) })
  if (!result) return { error: 'Gmail could not send the test email' }
  return { ok: true }
}

/**
 * Send a one-off TEST email of a template to a single address, using the
 * event's real details but a sample attendee name. Does NOT touch any
 * registration or log the email — it's purely a preview.
 */
export async function sendTestEmail(
  eventId: string,
  templateKey: string,
  to: string
): Promise<{ ok?: boolean; error?: string }> {
  const admin = getAdminClient()

  const { data: event } = await admin.from('events').select('*').eq('id', eventId).single()
  if (!event) return { error: 'Event not found' }

  const { data: template } = await admin
    .from('email_templates')
    .select('*')
    .eq('key', templateKey)
    .single()
  if (!template) return { error: `Template "${templateKey}" not found` }

  const { data: tokens } = await admin
    .from('gmail_tokens')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
  const token = tokens?.[0] as GmailTokenRow | undefined
  if (!token) return { error: 'No Gmail account connected. Connect one in Settings first.' }

  const accessToken = await getFreshAccessToken(token, admin)
  if (!accessToken) return { error: 'Could not refresh Gmail access' }

  const sampleContact = { name: 'there', email: to } as unknown as Contact
  const { subject, body } = renderTemplate(template as EmailTemplate, templateVars(sampleContact, event as Event))
  const result = await sendGmail(accessToken, token.email, { to, subject: `[TEST] ${subject}`, body, html: bodyToHtml(body) })
  if (!result) return { error: 'Gmail could not send the test email' }
  return { ok: true }
}
