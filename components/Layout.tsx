'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { User, Session } from '@supabase/supabase-js'
import { BarChart3, CalendarDays, Lock, LogOut, Menu, Radio, X } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import ViewModeSwitcher from '@/components/ViewModeSwitcher'
import { useViewMode } from '@/contexts/ViewModeContext'
import BaseballMark from '@/components/BaseballMark'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/contexts/LanguageContext'
import { NAV_GROUPS, findNavItem } from '@/lib/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'
import { roleLabel } from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { t, language } = useLanguage()
  const { canView, loading: permsLoading, role } = usePermissions()
  const { mode } = useViewMode()
  // 'mobile' forces the drawer layout everywhere; 'desktop' forces the sidebar everywhere
  const forceMobile = mode === 'mobile'
  const forceDesktop = mode === 'desktop'

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then((response) => {
      if (response.data.user) {
        setUser(response.data.user)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const current = findNavItem(pathname)
  const visibleGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canView(i.feature)) })).filter((g) => g.items.length > 0)
  const blocked = !permsLoading && !!current && !canView(current.feature)
  // Bottom quick menu (phone layout): current game, schedule, statistics
  const quickItems = [
    { href: '/live', label: t.liveGame, Icon: Radio, feature: 'live' },
    { href: '/schedule', label: t.schedule, Icon: CalendarDays, feature: 'schedule' },
    { href: '/statistics', label: t.statistics, Icon: BarChart3, feature: 'statistics' },
  ].filter((i) => canView(i.feature))
  const pageTitle = current ? t[current.labelKey] : t.appTitle
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : ''

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0b1526] text-slate-100">
      {/* Brand */}
      <div className="flex h-24 items-center gap-3 border-b border-white/10 px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-300 text-slate-950 shadow-[0_0_24px_#6ee7b720]">
          <BaseballMark className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-base font-black tracking-tight leading-tight">{t.appTitle}</div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-300">{language === 'es' ? 'Tu clubhouse' : 'Your clubhouse'}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label={t.menu}>
        {visibleGroups.map((group) => (
          <div key={group.labelKey}>
            <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {t[group.labelKey]}
            </p>
            <ul className="space-y-1">
              {group.items.map(({ href, labelKey, Icon, soon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                        active
                          ? 'bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/20'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-4 shrink-0',
                          active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-200'
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{t[labelKey]}</span>
                      {soon && (
                        <span className="rounded-full border border-border bg-card px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t.soon}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* View mode + user */}
      <div className="space-y-2 border-t border-white/10 p-3">
        <ViewModeSwitcher />
        {user && (
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-300">{user.email}</p>
              <p className="text-[11px] text-muted-foreground">{roleLabel(role, language === 'es' ? 'es' : 'en')}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={handleLogout} title={t.logout} aria-label={t.logout} className="text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut />
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen ballpark-background" data-view={mode}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-800 bg-[#0b1526]',
          forceMobile ? 'hidden' : forceDesktop ? 'block' : 'hidden lg:block'
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className={cn('fixed inset-0 z-50', forceDesktop ? 'hidden' : forceMobile ? '' : 'lg:hidden')}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0b1526] shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-300 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className={cn('flex min-h-screen flex-col', forceMobile ? '' : forceDesktop ? 'pl-64' : 'lg:pl-64')}>
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className={cn(forceMobile ? '' : forceDesktop ? 'hidden' : 'lg:hidden')}
            onClick={() => setMobileOpen(true)}
            aria-label={t.menu}
          >
            <Menu />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className={cn(
                'hidden size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:flex',
                forceMobile ? '' : forceDesktop ? 'hidden' : 'lg:hidden'
              )}
            >
              <BaseballMark className="size-4" />
            </span>
            <div className="min-w-0"><p className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:block">{language === 'es' ? 'Baseball · Centro de equipo' : 'Baseball · Team central'}</p><h1 className="truncate text-lg font-extrabold tracking-tight">{pageTitle}</h1></div>
          </div>
          <LanguageSwitcher />
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              title={t.logout}
              className={cn(forceMobile ? '' : forceDesktop ? 'hidden' : 'lg:hidden')}
            >
              <LogOut />
              <span className="hidden sm:inline">{t.logout}</span>
            </Button>
          )}
        </header>

        <main className={cn('flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8', quickItems.length > 0 && (forceMobile ? 'pb-24' : forceDesktop ? '' : 'pb-24 lg:pb-8'))}>
          <div className={cn('mx-auto w-full', forceMobile ? 'max-w-3xl' : 'max-w-6xl')}>
            {permsLoading && current ? (
              <div className="py-16 text-center text-sm text-muted-foreground">…</div>
            ) : blocked ? (
              <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Lock className="size-5" />
                </span>
                <h2 className="text-lg font-semibold">{language === 'es' ? 'Sin acceso a esta sección' : 'No access to this section'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language === 'es' ? 'Pídele a un super admin que active el permiso para tu rol.' : 'Ask a super admin to enable it for your role.'}
                </p>
              </div>
            ) : (
              children
            )}
          </div>
        </main>

        {quickItems.length > 0 && (
          <nav
            className={cn(
              'fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-[#0b1526]/95 text-white backdrop-blur',
              forceMobile ? '' : forceDesktop ? 'hidden' : 'lg:hidden'
            )}
            aria-label="quick menu"
          >
            <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${quickItems.length}, minmax(0, 1fr))` }}>
              {quickItems.map(({ href, label, Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex flex-col items-center gap-0.5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 text-[11px] font-semibold',
                        active ? 'text-emerald-300' : 'text-slate-400 hover:text-white'
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}
