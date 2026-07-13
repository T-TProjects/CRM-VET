'use client'

import { useEffect, useState } from 'react'
import { Plus, X, CheckSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Task { id: string; text: string; done: boolean }

const KEY = 'crm-quick-tasks'

// A simple to-do / notes box. Saved in this browser only (no dates, no tracking).
export function QuickTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Load saved tasks once, on the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setTasks(JSON.parse(raw) as Task[])
    } catch {
      /* ignore malformed storage */
    }
    setLoaded(true)
  }, [])

  // Save whenever tasks change (but not before the first load).
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(tasks))
  }, [tasks, loaded])

  function add() {
    const t = text.trim()
    if (!t) return
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
    setTasks(prev => [...prev, { id, text: t, done: false }])
    setText('')
  }

  function toggle(id: string) {
    setTasks(prev => prev.map(x => (x.id === id ? { ...x, done: !x.done } : x)))
  }

  function remove(id: string) {
    setTasks(prev => prev.filter(x => x.id !== id))
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-1.5"><CheckSquare className="h-4 w-4" /> To do &amp; notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={e => { e.preventDefault(); add() }} className="flex gap-2">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Type something to do and press Enter…" />
          <Button type="submit" disabled={!text.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet. Add a note or task above.</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map(t => (
              <li key={t.id} className="flex items-center gap-2 group">
                <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} className="h-4 w-4 shrink-0" />
                <span className={`flex-1 text-sm ${t.done ? 'line-through text-muted-foreground' : ''}`}>{t.text}</span>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                  aria-label="Delete"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
