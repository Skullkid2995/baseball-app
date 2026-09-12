'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Play, Radio } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { defaultScope, gameInScope, type ScopedTeam } from '@/lib/scope'
import TraditionalScorebook from '@/components/TraditionalScorebook'
import { Badge, Button, Card, CardContent, EmptyState, LoadingState, PageHeader } from '@/components/ui'

interface GameRow {
  id: string
  opponent: string
  game_date: string
  game_time: string | null
  stadium: string | null
  weather_conditions: string | null
  our_score: number
  opponent_score: number
  innings_played: number
  game_status: string
  team_id?: string | null
}

const TEXT = {
  es: {
    title: 'Juego actual',
    description: 'El juego en curso de tu equipo, listo para anotar.',
    none: 'No hay ningún juego en curso',
    noneHint: 'Cuando un juego se inicie desde Juegos aparecerá aquí.',
    next: 'Próximo juego',
    pick: 'Hay varios juegos en curso. Elige uno:',
    open: 'Abrir',
    goGames: 'Ir a Juegos',
    goSchedule: 'Ver calendario',
    loading: 'Buscando el juego en curso…',
    live: 'En juego',
  },
  en: {
    title: 'Current game',
    description: "Your team's game in progress, ready to score.",
    none: 'No game in progress',
    noneHint: 'When a game is started from Games it shows up here.',
    next: 'Next game',
    pick: 'Several games are in progress. Pick one:',
    open: 'Open',
    goGames: 'Go to Games',
    goSchedule: 'See schedule',
    loading: 'Looking for the game in progress…',
    live: 'Live',
  },
}

export default function LiveGameView() {
  const { language } = useLanguage()
  const lang = language === 'es' ? 'es' : 'en'
  const L = TEXT[lang]
  const locale = lang === 'es' ? 'es-MX' : 'en-US'
  const router = useRouter()
  const { role, isSuperAdmin, teamId, leagueId, loading: permsLoading } = usePermissions()
  const scopeUser = useMemo(() => ({ role, isSuperAdmin, teamId, leagueId }), [role, isSuperAdmin, teamId, leagueId])
  const [games, setGames] = useState<GameRow[]>([])
  const [teams, setTeams] = useState<ScopedTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [chosen, setChosen] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [g, t] = await Promise.all([
        supabase.from('games').select('*').order('game_date', { ascending: true }),
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

  const level = defaultScope(scopeUser)
  const scoped = useMemo(() => games.filter((g) => gameInScope(g, level, scopeUser, teams)), [games, level, scopeUser, teams])
  const live = scoped.filter((g) => g.game_status === 'in_progress')
  const today = new Date().toISOString().slice(0, 10)
  const next = scoped.filter((g) => g.game_status === 'scheduled' && g.game_date >= today)[0] ?? scoped.filter((g) => g.game_status === 'scheduled')[0]
  const current = live.length === 1 ? live[0] : live.find((g) => g.id === chosen) ?? null

  if (loading || permsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={L.title} description={L.description} />
        <LoadingState label={L.loading} />
      </div>
    )
  }

  if (current) {
    return <TraditionalScorebook game={current} onClose={() => router.push('/games')} />
  }

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div className="space-y-5">
      <PageHeader title={L.title} description={L.description} />
      {live.length > 1 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{L.pick}</p>
            <ul className="divide-y divide-border">
              {live.map((g) => (
                <li key={g.id} className="flex items-center gap-3 py-2">
                  <Badge variant="warning">{L.live}</Badge>
                  <div className="min-w-0 flex-1 text-sm font-semibold">
                    vs {g.opponent} <span className="text-muted-foreground">· {fmtDate(g.game_date)}</span>
                  </div>
                  <Button size="sm" variant="warning" onClick={() => setChosen(g.id)}>
                    <Play /> {L.open}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <>
          <EmptyState icon={<Radio />} title={L.none} description={L.noneHint} />
          {next && (
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <CalendarDays className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{L.next}</div>
                  <div className="truncate text-sm font-semibold">vs {next.opponent}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {fmtDate(next.game_date)}
                    {next.game_time ? ` · ${next.game_time.slice(0, 5)}` : ''}
                    {next.stadium ? ` · ${next.stadium}` : ''}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/games">
              <Button variant="primary">{L.goGames}</Button>
            </Link>
            <Link href="/schedule">
              <Button variant="outline">{L.goSchedule}</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
