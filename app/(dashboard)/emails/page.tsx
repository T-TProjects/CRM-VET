import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import type { Email } from '@/types'

export const dynamic = 'force-dynamic'

export default async function EmailsPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('emails')
    .select('*, contact:contacts(*)')
    .order('received_at', { ascending: false })
    .limit(100)
  const emails = (data ?? []) as Email[]

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Emails</h1>
        <p className="text-sm text-muted-foreground">Synced from your connected Gmail. Manage the connection in Settings.</p>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {emails.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No emails yet. Connect Gmail in Settings and run a sync.
            </p>
          ) : emails.map(e => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{e.from_name || e.from_email}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {e.contact && <Badge variant="secondary">{e.contact.name}</Badge>}
                  <span className="text-xs text-muted-foreground">{formatDateTime(e.received_at)}</span>
                </div>
              </div>
              <p className="truncate text-sm text-muted-foreground">{e.subject}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
