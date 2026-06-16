import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/settings-client'
import type { EmailTemplate } from '@/types'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = createClient()
  const service = createServiceClient()

  const [{ data: templates }, { data: tokens }] = await Promise.all([
    supabase.from('email_templates').select('*').order('name'),
    service.from('gmail_tokens').select('email, updated_at').order('created_at'),
  ])

  return (
    <SettingsClient
      templates={(templates ?? []) as EmailTemplate[]}
      gmailAccounts={(tokens ?? []) as { email: string; updated_at: string }[]}
    />
  )
}
