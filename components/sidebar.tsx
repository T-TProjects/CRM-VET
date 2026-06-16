'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Users, CalendarDays, Bell, Mail, Settings, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types'

interface SidebarProps {
  user: User
  pendingCount?: number
}

type NavItem = { href: string; label: string; icon: React.ElementType; showBadge?: boolean }

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/events', label: 'Conferences', icon: CalendarDays },
  { href: '/reminders', label: 'Reminders', icon: Bell, showBadge: true },
  { href: '/emails', label: 'Emails', icon: Mail },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ user, pendingCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon
    const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
    const badge = item.showBadge && pendingCount > 0
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {badge && (
          <span className={cn(
            'rounded-full text-xs px-1 py-0.5 min-w-[1.25rem] text-center font-semibold shrink-0',
            isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-destructive text-destructive-foreground'
          )}>
            {pendingCount}
          </span>
        )}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Users className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm leading-tight">Tonia CRM</span>
        </div>
      </div>

      <div className="border-b px-4 py-3">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map(item => <NavLink key={item.href} item={item} />)}
      </nav>

      <div className="border-t p-3">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b bg-card px-4">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="mr-3 rounded-md p-1.5 hover:bg-accent">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="font-semibold text-sm">Tonia CRM</span>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
