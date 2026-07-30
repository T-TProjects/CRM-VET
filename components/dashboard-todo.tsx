'use client'

import { useEffect, useState } from 'react'
import { Plus, X, ListChecks } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TodoItem { id: string; text: string; updates: string; done: boolean }

const STORAGE_KEY = 'dashboard-todo'

// A simple to-do list for the dashboard. Each row has a done tick box, the thing
// to do, and a free-text "updates" note. The task and the updates are both editable.
// Saved in this browser only (no dates, no server).
export function DashboardTodo() {
  const [items, setItems] = useState<TodoItem[]>([])
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Load saved items on the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      setItems(raw ? (JSON.parse(raw) as TodoItem[]) : [])
    } catch {
      setItems([])
    }
    setLoaded(true)
  }, [])

  // Save whenever items change (but not before the first load).
  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, loaded])

  function add() {
    const t = text.trim()
    if (!t) return
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
    setItems(prev => [...prev, { id, text: t, updates: '', done: false }])
    setText('')
  }

  function toggle(id: string) {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, done: !x.done } : x)))
  }

  function edit(id: string, field: 'text' | 'updates', value: string) {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, [field]: value } : x)))
  }

  function remove(id: string) {
    setItems(prev => prev.filter(x => x.id !== id))
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-1.5">
          <ListChecks className="h-4 w-4" /> To-do list
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={e => { e.preventDefault(); add() }} className="flex gap-2">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add something to do and press Enter…"
          />
          <Button type="submit" disabled={!text.trim()}><Plus className="h-4 w-4" /></Button>
        </form>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet. Add your first task above.</p>
        ) : (
          <ul className="space-y-2">
            {/* Column labels */}
            <li className="hidden sm:flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
              <span className="w-4 shrink-0" />
              <span className="flex-1">Task</span>
              <span className="flex-1">Updates</span>
              <span className="w-4 shrink-0" />
            </li>
            {items.map(item => (
              <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 shrink-0"
                  aria-label="Mark done"
                />
                <Input
                  value={item.text}
                  onChange={e => edit(item.id, 'text', e.target.value)}
                  className={`flex-1 ${item.done ? 'line-through text-muted-foreground' : ''}`}
                  placeholder="Task"
                />
                <Input
                  value={item.updates}
                  onChange={e => edit(item.id, 'updates', e.target.value)}
                  className="flex-1"
                  placeholder="Updates / notes…"
                />
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="self-end sm:self-auto text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
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
