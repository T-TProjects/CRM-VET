import { createClient as createAdminClient } from '@supabase/supabase-js'

/** Service-role Supabase client — bypasses RLS for token + email storage. */
export function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export interface GmailTokenRow {
  id: string
  email: string
  access_token: string
  refresh_token: string
  expires_at: string
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    access_token: data.access_token as string,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

/** Returns a valid access token for the row, refreshing + persisting if expired. */
export async function getFreshAccessToken(
  token: GmailTokenRow,
  supabase: ReturnType<typeof getAdminClient>
): Promise<string | null> {
  if (new Date(token.expires_at).getTime() > Date.now() + 60_000) {
    return token.access_token
  }
  const refreshed = await refreshAccessToken(token.refresh_token)
  if (!refreshed) return null
  await supabase
    .from('gmail_tokens')
    .update({ access_token: refreshed.access_token, expires_at: refreshed.expires_at, updated_at: new Date().toISOString() })
    .eq('id', token.id)
  return refreshed.access_token
}

/** Send a plain-text email via the Gmail API. Returns the Gmail thread id on success. */
export async function sendGmail(
  accessToken: string,
  fromEmail: string,
  opts: { to: string; subject: string; body: string }
): Promise<{ threadId: string | null } | null> {
  const headers = [
    `From: ${fromEmail}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
  ].join('\r\n')
  const raw = `${headers}\r\n\r\n${opts.body}`
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { threadId: data.threadId ?? null }
}

export function extractHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

export function parseEmailBody(payload: Record<string, unknown>): string {
  const mimeType = payload.mimeType as string
  const body = payload.body as { data?: string } | undefined
  const parts = payload.parts as Record<string, unknown>[] | undefined
  if (mimeType === 'text/plain' && body?.data) {
    return Buffer.from(body.data, 'base64').toString('utf-8')
  }
  if (parts) {
    for (const part of parts) {
      const text = parseEmailBody(part)
      if (text) return text
    }
  }
  return ''
}
