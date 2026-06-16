import { createClient } from '@/lib/supabase/server'
import { ContactsClient } from '@/components/contacts/contacts-client'
import type { Contact } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ContactsPage() {
  const supabase = createClient()
  const { data } = await supabase.from('contacts').select('*').order('name', { ascending: true })
  return <ContactsClient initialContacts={(data ?? []) as Contact[]} />
}
