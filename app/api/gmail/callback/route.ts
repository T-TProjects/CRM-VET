import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

// GET /api/gmail/callback — Google redirects here after consent.
export async function GET(request: Request) {
  const supabase = getAdminClient()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?gmail_error=${error ?? 'no_code'}`)
  }

  const redirectUri = `${appUrl}/api/gmail/callback`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('Gmail token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(`${appUrl}/settings?gmail_error=token_exchange_failed`)
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json()

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const profile = await profileRes.json()
  const gmailEmail = profile.email as string

  const { error: upsertErr } = await supabase.from('gmail_tokens').upsert(
    {
      email: gmailEmail,
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  )

  if (upsertErr) {
    console.error('Failed to store Gmail tokens:', upsertErr)
    return NextResponse.redirect(`${appUrl}/settings?gmail_error=token_storage_failed`)
  }

  return NextResponse.redirect(`${appUrl}/settings?gmail_connected=1&gmail_account=${encodeURIComponent(gmailEmail)}`)
}
