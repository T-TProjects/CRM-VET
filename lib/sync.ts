import {
  getAdminClient, getFreshAccessToken, extractHeader, parseEmailBody, type GmailTokenRow,
} from '@/lib/gmail'

export interface SyncResult {
  synced: number
  repliesDetected: number
  accounts: string[]
}

function isNoReplyAddress(email: string): boolean {
  return /^(noreply|no-reply|notifications?|donotreply|mailer|postmaster|bounce|bounces)@/i.test(email)
}

/**
 * Pull recent inbox messages from every connected Gmail account, store new
 * ones, and detect replies: when an inbound email matches a thread we emailed
 * (or a known contact), stamp replied_at on the relevant registrations.
 */
export async function syncInbox(lookbackDays = 30): Promise<SyncResult> {
  const admin = getAdminClient()

  const { data: tokens } = await admin
    .from('gmail_tokens')
    .select('*')
    .order('created_at', { ascending: true })

  if (!tokens?.length) return { synced: 0, repliesDetected: 0, accounts: [] }

  const { data: existing } = await admin.from('emails').select('gmail_id')
  const existingIds = new Set((existing ?? []).filter(e => e.gmail_id).map(e => e.gmail_id as string))

  let synced = 0
  let repliesDetected = 0
  const accounts: string[] = []

  for (const token of tokens as GmailTokenRow[]) {
    accounts.push(token.email)
    const accessToken = await getFreshAccessToken(token, admin)
    if (!accessToken) continue

    const afterEpoch = Math.floor((Date.now() - lookbackDays * 86400_000) / 1000)
    const query = `after:${afterEpoch} -label:spam -label:trash`
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!listRes.ok) continue
    const listData = await listRes.json()
    const messages: { id: string; threadId: string }[] = listData.messages ?? []

    for (const msg of messages.filter(m => !existingIds.has(m.id))) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!msgRes.ok) continue
      const msgData = await msgRes.json()
      const headers = (msgData.payload?.headers ?? []) as { name: string; value: string }[]

      const subject = extractHeader(headers, 'Subject') || '(no subject)'
      const fromRaw = extractHeader(headers, 'From')
      const dateRaw = extractHeader(headers, 'Date')
      const messageId = extractHeader(headers, 'Message-ID').trim() || null

      const fromMatch = fromRaw.match(/^(?:"?(.+?)"?\s)?<?([^\s>]+@[^\s>]+)>?$/)
      const fromName = fromMatch?.[1]?.trim() ?? null
      const fromEmail = (fromMatch?.[2]?.trim() ?? fromRaw).toLowerCase()

      // Skip our own outbound and obvious automated senders.
      if (fromEmail === token.email.toLowerCase() || isNoReplyAddress(fromEmail)) continue

      const bodyText = parseEmailBody(msgData.payload ?? {})
      const receivedAt = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString()

      // Match to a contact by sender address.
      const { data: contact } = await admin
        .from('contacts')
        .select('id')
        .ilike('email', fromEmail)
        .limit(1)
        .maybeSingle()

      // Match to a thread we previously emailed (gives us event + registration).
      const { data: priorEmail } = await admin
        .from('emails')
        .select('event_id, registration_id')
        .eq('thread_id', msg.threadId)
        .not('registration_id', 'is', null)
        .limit(1)
        .maybeSingle()

      await admin.from('emails').insert({
        gmail_id: msg.id,
        message_id: messageId,
        thread_id: msg.threadId,
        from_email: fromEmail,
        from_name: fromName,
        subject,
        body_text: bodyText || null,
        received_at: receivedAt,
        is_read: false,
        contact_id: contact?.id ?? null,
        event_id: priorEmail?.event_id ?? null,
        registration_id: priorEmail?.registration_id ?? null,
      })
      existingIds.add(msg.id)
      synced++

      // Stamp replied_at: prefer the exact registration from the thread,
      // otherwise every pending registration for the matched contact.
      if (priorEmail?.registration_id) {
        const { data } = await admin
          .from('registrations')
          .update({ replied_at: receivedAt, updated_at: new Date().toISOString() })
          .eq('id', priorEmail.registration_id)
          .is('replied_at', null)
          .select('id')
        repliesDetected += data?.length ?? 0
      } else if (contact?.id) {
        const { data } = await admin
          .from('registrations')
          .update({ replied_at: receivedAt, updated_at: new Date().toISOString() })
          .eq('contact_id', contact.id)
          .not('notified_at', 'is', null)
          .is('replied_at', null)
          .select('id')
        repliesDetected += data?.length ?? 0
      }
    }
  }

  return { synced, repliesDetected, accounts }
}
