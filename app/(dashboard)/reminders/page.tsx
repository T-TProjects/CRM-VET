import { createClient } from '@/lib/supabase/server'
import { RemindersClient } from '@/components/reminders/reminders-client'
import type { Reminder, Contact } from '@/types'

export const dynamic = 'force-dynamic'

export default async function RemindersPage() {
  const supabase = createClient()
  const [{ data: reminders }, { data: contacts }] = await Promise.all([
    supabase.from('reminders').select('*, contact:contacts(*), event:events(*)').order('due_date', { ascending: true }),
    supabase.from('contacts').select('*').order('name'),
  ])
  return <RemindersClient initialReminders={(reminders ?? []) as Reminder[]} contacts={(contacts ?? []) as Contact[]} />
}
