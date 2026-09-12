'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { allowedScopes, defaultScope, gameInScope, type ScopeLevel, type ScopedTeam } from '@/lib/scope'
import { Badge, Button, Card, CardContent, EmptyState, LoadingState, PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'

interface GameRow {
  id: string
  opponent: string
  game_date: string
  game_time: string | null
  stadium: string | null
  game_status: string
  our_score: number
  opponent_score: number
  team_id?: string | null
  opponent_team_id?: string | null
  league_id?: string | null
}

const TEXT = {
  es: {
    title: 'Calendario',
    description: 'Juegos programados según tu equipo, tu liga o todo.',
    scope: { team: 'Mi equipo', league: 'Mi liga', all: 'Todos' },
    today: 'Hoy',
    noGames: 'No hay juegos en este mes.',
    noGamesHint: 'Cambia de mes o de alcance.',
    upcoming: 'Juegos del mes',
    vs: 'vs',
    live: 'En juego',
    status: { scheduled: 'Programado', in_progress: 'En juego', completed: 'Terminado', postponed: 'Pospuesto', cancelled: 'Cancelado' },
    openLive: 'Abrir juego',
    days: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    loading: 'Cargando calendario…',
  },
  en: {
    title: 'Schedule',
    description: 'Scheduled games for your team, your league, or everything.',
    scope: { team: 'My team', league: 'My league', all: 'All' },
    today: 'Today',
    noGames: 'No games this month.',
    noGamesHint: 'Change the month or the scope.',
    upcoming: 'Games this month',
    vs: 'vs',
    live: 'Live',
    status: { scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', postponed: 'Postponed', cancelled: 'Cancelled' },
    openLive: 'Open game',
    days: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    loading: 'Loading schedule…',
  },
}

const statusVariant = (s: string) => (s === 'in_progress' ? 'warning' : s === 'completed' ? 'success' : s === 'cancelled' || s === 'postponed' ? 'danger' : 'primary')

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ScheduleView() {
  const { language } = useLanguage()
  const lang = language === 'es' ? 'es' : 'en'
  const L = TEXT[lang]
  const locale = lang === 'es' ? 'es-MX' : 'en-US'
  const { role, isSuperAdmin, teamId, leagueId, loading: permsLoading } = usePermissions()
  const scopeUser = useMemo(() => ({ role, isSuperAdmin, teamId, leagueId }), [role, isSuperAdmin, teamId, leagueId])
  const scopes = allowedScopes(scopeUser)
  const [scope, setScope] = useState<ScopeLevel | null>(null)
  const [games, setGames] = useState<GameRow[]>([])
  const [teams, setTeams] = useState<ScopedTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  useEffect(() => {
    if (!permsLoading && scope === null) setScope(defaultScope(scopeUser))
  }, [permsLoading, scope, scopeUser])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [g, t] = await Promise.all([
        supabase.from('games').select('id, opponent, game_date, game_time, stadium, game_status, our_score, opponent_score, team_id, opponent_team_id, league_id').order('game_date'),
        supabase.from('teams').select('id, name, league_id'),
      ])
      if (cancelled) return
      setGames((g.data as GameRow[]) ?? [])
      setTeams((t.data as ScopedTeam[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const level: ScopeLevel = scope ?? defaultScope(scopeUser)
  const scoped = useMemo(() => games.filter((g) => gameInScope(g, level, scopeUser, teams)), [games, level, scopeUser, teams])

  // Calendar grid for the month (weeks start on Sunday)
  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    const cells: { date: Date; inMonth: boolean; games: GameRow[] }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = ymd(d)
      cells.push({ date: d, inMonth: d.getMonth() === month.getMonth(), games: scoped.filter((g) => g.game_date === key) })
    }
    // drop trailing empty week
    while (cells.length > 35 && cells.slice(35).every((c) => !c.inMonth)) cells.splice(35)
    return cells
  }, [month, scoped])

  const monthGames = useMemo(() => {
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    return scoped.filter((g) => g.game_date.startsWith(prefix)).sort((a, b) => a.game_date.localeCompare(b.game_date) || (a.game_time ?? '').localeCompare(b.game_time ?? ''))
  }, [month, scoped])

  const todayKey = ymd(new Date())
  const monthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '')
  const fmtDay = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  }

  if (loading || permsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={L.title} description={L.description} />
        <LoadingState label={L.loading} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={L.title}
        description={L.description}
        actions={
          scopes.length > 1 ? (
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              {scopes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', level === s ? 'bg-card shadow-sm' : 'text-slate-500 hover:text-slate-800')}
                >
                  {L.scope[s]}
                </button>
              ))}
            </div>
          ) : (
            <Badge variant="outline">{L.scope[level]}</Badge>
          )
        }
      />

      {/* Month calendar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="previous month">
              <ChevronLeft />
            </Button>
            <div className="text-sm font-semibold capitalize">{monthLabel}</div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
                {L.today}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="next month">
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
            {L.days.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((c, i) => {
              const key = ymd(c.date)
              const isToday = key === todayKey
              const live = c.games.some((g) => g.game_status === 'in_progress')
              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[52px] rounded-lg border p-1 text-left text-xs sm:min-h-[64px]',
                    c.inMonth ? 'border-border bg-card' : 'border-transparent bg-slate-50/60 text-slate-400',
                    isToday && 'ring-2 ring-primary'
                  )}
                >
                  <div className={cn('mb-0.5 text-[11px] font-semibold', isToday && 'text-primary')}>{c.date.getDate()}</div>
                  {c.games.slice(0, 2).map((g) => (
                    <div
                      key={g.id}
                      className={cn(
                        'truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight',
                        g.game_status === 'in_progress' ? 'bg-amber-100 text-amber-900' : g.game_status === 'completed' ? 'bg-emerald-100 text-emerald-900' : 'bg-blue-100 text-blue-900'
                      )}
                      title={`${L.vs} ${g.opponent}`}
                    >
                      {fmtTime(g.game_time)} {g.opponent}
                    </div>
                  ))}
                  {c.games.length > 2 && <div className="text-[10px] text-muted-foreground">+{c.games.length - 2}</div>}
                  {live && <span className="sr-only">{L.live}</span>}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Month list */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{L.upcoming}</h3>
        {monthGames.length === 0 ? (
          <EmptyState icon={<CalendarDays />} title={L.noGames} description={L.noGamesHint} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {monthGames.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-20 shrink-0 text-xs font-semibold capitalize text-slate-600">{fmtDay(g.game_date)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {L.vs} {g.opponent}
                    {g.game_status === 'completed' && (
                      <span className="ml-2 tabular-nums text-muted-foreground">
                        {g.our_score}-{g.opponent_score}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    {g.game_time && <span>{fmtTime(g.game_time)}</span>}
                    {g.stadium && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {g.stadium}
                      </span>
                    )}
                  </div>
                </div>
                {g.game_status === 'in_progress' ? (
                  <Link href="/live" className="shrink-0">
                    <Button size="sm" variant="warning">
                      <Play /> {L.openLive}
                    </Button>
                  </Link>
                ) : (
                  <Badge variant={statusVariant(g.game_status)}>{L.status[g.game_status as keyof typeof L.status] ?? g.game_status}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
