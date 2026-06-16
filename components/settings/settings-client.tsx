'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, RefreshCw, Plus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import type { EmailTemplate } from '@/types'

export function SettingsClient({
  templates: initialTemplates, gmailAccounts,
}: { templates: EmailTemplate[]; gmailAccounts: { email: string; updated_at: string }[] }) {
  const params = useSearchParams()
  const { toast } = useToast()
  const [templates, setTemplates] = useState(initialTemplates)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (params.get('gmail_connected')) {
      toast({ title: 'Gmail connected', description: params.get('gmail_account') ?? undefined })
    } else if (params.get('gmail_error')) {
      toast({ title: 'Gmail connection failed', description: params.get('gmail_error') ?? undefined, variant: 'destructive' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function syncNow() {
    setSyncing(true)
    const res = await fetch('/api/gmail/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const json = await res.json()
    setSyncing(false)
    if (!res.ok) { toast({ title: 'Sync failed', description: json.error, variant: 'destructive' }); return }
    toast({ title: 'Sync complete', description: `${json.synced} new email(s), ${json.repliesDetected} reply(ies) detected` })
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Email connection and templates.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" /> Gmail</CardTitle>
          <CardDescription>Connect a Gmail account to send notifications and detect replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {gmailAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No account connected yet.</p>
          ) : (
            <ul className="space-y-2">
              {gmailAccounts.map(a => (
                <li key={a.email} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{a.email}</span>
                  <Badge variant="success">Connected</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button asChild variant={gmailAccounts.length ? 'outline' : 'default'}>
              <a href="/api/gmail/connect"><Plus className="h-4 w-4 mr-1.5" /> {gmailAccounts.length ? 'Connect another' : 'Connect Gmail'}</a>
            </Button>
            {gmailAccounts.length > 0 && (
              <Button variant="outline" onClick={syncNow} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} /> Sync now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email templates</CardTitle>
          <CardDescription>
            Used for automated sends. Placeholders: {'{{contact_name}}'}, {'{{event_name}}'}, {'{{event_date}}'}, {'{{event_location}}'}, {'{{agenda_url}}'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {templates.map(t => (
            <TemplateEditor key={t.id} template={t} onSaved={(saved) => setTemplates(prev => prev.map(x => x.id === saved.id ? saved : x))} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function TemplateEditor({ template, onSaved }: { template: EmailTemplate; onSaved: (t: EmailTemplate) => void }) {
  const { toast } = useToast()
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)
  const [saving, setSaving] = useState(false)
  const dirty = subject !== template.subject || body !== template.body

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/templates/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { toast({ title: 'Could not save', description: json.error, variant: 'destructive' }); return }
    onSaved(json.template as EmailTemplate)
    toast({ title: 'Template saved' })
  }

  return (
    <div className="space-y-2 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{template.name}</Label>
        <Badge variant="outline" className="font-mono text-[10px]">{template.key}</Badge>
      </div>
      <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
      <textarea value={body} onChange={e => setBody(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  )
}
