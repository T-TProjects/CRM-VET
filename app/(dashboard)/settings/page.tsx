import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/gmail'
import { SettingsClient } from '@/components/settings/settings-client'
import type { EmailTemplate } from '@/types'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = createClient()
  // Raw service-role client (no cookies) — gmail_tokens has no authenticated
  // RLS policy, so a user-scoped client returns nothing.
  const admin = getAdminClient()

  const [{ data: templates }, { data: tokens }] = await Promise.all([
    supabase.from('email_templates').select('*').order('name'),
    admin.from('gmail_tokens').select('email, updated_at').order('created_at'),
  ])

  return (
    <SettingsClient
      templates={(templates ?? []) as EmailTemplate[]}
      gmailAccounts={(tokens ?? []) as { email: string; updated_at: string }[]}
    />
  )
}
