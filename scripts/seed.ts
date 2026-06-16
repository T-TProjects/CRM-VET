/**
 * Seed sample data for local development.
 *   npm run seed
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: contacts } = await supabase
    .from('contacts')
    .insert([
      { name: 'Jane Doe', organization: 'Acme Co', email: 'jane@example.com', status: 'active', dietary_needs: 'Vegetarian' },
      { name: 'John Smith', organization: 'Globex', email: 'john@example.com', status: 'prospect' },
      { name: 'Mary Lee', organization: 'Initech', email: 'mary@example.com', status: 'active', accommodation_notes: 'Ground floor room' },
    ])
    .select('*')

  const { data: event } = await supabase
    .from('events')
    .insert({
      name: 'Annual Client Conference 2026',
      location: 'Sydney',
      starts_at: '2026-09-10',
      ends_at: '2026-09-11',
      agenda_url: 'https://example.com/agenda.pdf',
      status: 'upcoming',
    })
    .select('*')
    .single()

  if (contacts && event) {
    await supabase.from('registrations').insert(
      contacts.map((c, i) => ({
        event_id: event.id,
        contact_id: c.id,
        status: i === 0 ? 'signed_up' : 'invited',
        dietary_needs: c.dietary_needs,
        accommodation_notes: c.accommodation_notes,
      }))
    )
  }

  console.log('Seed complete.')
}

main().catch((e) => { console.error(e); process.exit(1) })
