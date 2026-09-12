'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  MapPin,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingState,
  PageHeader,
} from '@/components/ui'

interface Game {
  id: string
  opponent: string
  game_date: string
  game_time: string | null
  stadium: string | null
  our_score: number | null
  opponent_score: number | null
  game_status: string
  lineup_template_id: string | null
  opponent_lineup_template_id: string | null
  batting_first: 'home' | 'opponent' | null
}

interface AtBatRow {
  id: string
  player_id: string
  result: string | null
  rbi: number | null
  team_side: string | null
  players: {
    id: string
    first_name: string
    last_name: string
    jersey_number: number | null
    photo_url: string | null
  } | null
}

interface HitterStats {
  playerId: string
  firstName: string
  lastName: string
  jersey: number | null
  photoUrl: string | null
  ab: number
  h: number
  hr: number
  rbi: number
  avg: number
}

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'outline'

const HIT_RESULTS = new Set(['single', 'double', 'triple', 'home_run'])
const NON_AT_BAT_RESULTS = new Set(['walk', 'hit_by_pitch', 'sacrifice_fly', 'sacrifice_bunt'])

/** `game_date` is a plain `YYYY-MM-DD`; build a local Date so the day never shifts with the timezone. */
function parseGameDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function localIsoDate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatGameTime(time: string | null): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  if (Number.isNaN(hour)) return time
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes ?? '00'} ${ampm}`
}

/** Baseball-style average: `.287` rather than `0.287`. */
function formatAvg(value: number): string {
  const s = value.toFixed(3)
  return s.startsWith('0.') ? s.slice(1) : s
}

function byDateAsc(a: Game, b: Game) {
  return a.game_date.localeCompare(b.game_date) || (a.game_time ?? '').localeCompare(b.game_time ?? '')
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  hint?: ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-4"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{hint}</p>}
    </Card>
  )
}

/** Same visual language as the lineup checklist in GamesList. */
function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
      )}
      <span className="text-slate-700">{label}</span>
    </li>
  )
}

export default function DashboardView() {
  const { language } = useLanguage()
  const [games, setGames] = useState<Game[]>([])
  const [atBats, setAtBats] = useState<AtBatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const L =
    language === 'es'
      ? {
          title: 'Panel',
          description: 'Resumen de la temporada: récord, bateo del equipo y próximos juegos.',
          loading: 'Cargando panel...',
          loadError: 'No se pudo cargar el panel',
          record: 'Récord',
          winPct: 'PCT',
          noCompletedGames: 'Sin juegos terminados',
          gamesPlayed: 'Juegos jugados',
          scheduledShort: 'programados',
          inProgressShort: 'en curso',
          teamAvg: 'Promedio de bateo',
          abShort: 'VB',
          runs: 'Carreras a favor / en contra',
          differential: 'Diferencial',
          nextGame: 'Próximo juego',
          viewGames: 'Ver juegos',
          noNextGame: 'Sin juegos programados',
          noNextGameHint: 'Crea el siguiente juego desde la sección de Juegos.',
          readyToScore: 'Listo para anotar',
          setupPending: 'Configuración pendiente',
          lineupStatus: 'Estado de alineaciones',
          ourLineupOk: 'Nuestro equipo: Alineación elegida',
          ourLineupPending: 'Nuestro equipo: Pendiente',
          opponent: 'Oponente',
          lineupOk: 'Alineación elegida',
          lineupPending: 'Pendiente',
          battingFirstOk: 'Local/Visitante: Seleccionado',
          battingFirstPending: 'Local/Visitante: Pendiente',
          recentResults: 'Resultados recientes',
          recentResultsHint: 'Últimos 5 juegos',
          noResults: 'Aún no hay resultados',
          noResultsHint: 'Los juegos terminados aparecerán aquí.',
          win: 'G',
          loss: 'P',
          tie: 'E',
          inProgress: 'En curso',
          postponed: 'Pospuesto',
          cancelled: 'Cancelado',
          topHitters: 'Mejores bateadores',
          topHittersHint: 'Por hits · mínimo 1 turno al bate',
          noHitters: 'Aún no hay turnos al bate',
          noHittersHint: 'Las estadísticas aparecen al anotar un juego.',
          player: 'Jugador',
          avg: 'AVG',
          hits: 'H',
          homeRuns: 'HR',
          rbi: 'CI',
        }
      : {
          title: 'Dashboard',
          description: 'Season overview: record, team batting and upcoming games.',
          loading: 'Loading dashboard...',
          loadError: 'Could not load the dashboard',
          record: 'Record',
          winPct: 'PCT',
          noCompletedGames: 'No completed games',
          gamesPlayed: 'Games played',
          scheduledShort: 'scheduled',
          inProgressShort: 'in progress',
          teamAvg: 'Team batting average',
          abShort: 'AB',
          runs: 'Runs scored / allowed',
          differential: 'Differential',
          nextGame: 'Next game',
          viewGames: 'View games',
          noNextGame: 'No scheduled games',
          noNextGameHint: 'Create the next game from the Games section.',
          readyToScore: 'Ready to score',
          setupPending: 'Setup pending',
          lineupStatus: 'Lineup status',
          ourLineupOk: 'Our team: Lineup selected',
          ourLineupPending: 'Our team: Pending',
          opponent: 'Opponent',
          lineupOk: 'Lineup selected',
          lineupPending: 'Pending',
          battingFirstOk: 'Home/Away: Selected',
          battingFirstPending: 'Home/Away: Pending',
          recentResults: 'Recent results',
          recentResultsHint: 'Last 5 games',
          noResults: 'No results yet',
          noResultsHint: 'Completed games will show up here.',
          win: 'W',
          loss: 'L',
          tie: 'T',
          inProgress: 'In progress',
          postponed: 'Postponed',
          cancelled: 'Cancelled',
          topHitters: 'Top hitters',
          topHittersHint: 'By hits · min 1 at-bat',
          noHitters: 'No at-bats yet',
          noHittersHint: 'Stats appear once you score a game.',
          player: 'Player',
          avg: 'AVG',
          hits: 'H',
          homeRuns: 'HR',
          rbi: 'RBI',
        }
  const locale = language === 'es' ? 'es-MX' : 'en-US'

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const [gamesRes, atBatsRes] = await Promise.all([
          supabase
            .from('games')
            .select(
              'id, opponent, game_date, game_time, stadium, our_score, opponent_score, game_status, lineup_template_id, opponent_lineup_template_id, batting_first'
            )
            .order('game_date', { ascending: false }),
          supabase
            .from('at_bats')
            .select('id, player_id, result, rbi, team_side, players ( id, first_name, last_name, jersey_number, photo_url )')
            // Our team bats as `home`; legacy rows created before the column existed are null and also ours.
            .or('team_side.eq.home,team_side.is.null'),
        ])
        if (cancelled) return
        if (gamesRes.error) {
          setError(gamesRes.error.message)
          return
        }
        if (atBatsRes.error) {
          setError(atBatsRes.error.message)
          return
        }
        setGames((gamesRes.data ?? []) as unknown as Game[])
        setAtBats((atBatsRes.data ?? []) as unknown as AtBatRow[])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <LoadingState label={L.loading} />
  }

  if (error) {
    return (
      <Alert variant="error" title={L.loadError}>
        {error}
      </Alert>
    )
  }

  // ---- Games-derived numbers -------------------------------------------------
  const completed = games.filter((g) => g.game_status === 'completed')
  let wins = 0
  let losses = 0
  let ties = 0
  for (const g of completed) {
    const us = g.our_score ?? 0
    const them = g.opponent_score ?? 0
    if (us > them) wins++
    else if (us < them) losses++
    else ties++
  }

  const scheduledGames = games.filter((g) => g.game_status === 'scheduled').sort(byDateAsc)
  const inProgressCount = games.filter((g) => g.game_status === 'in_progress').length
  const played = games.filter((g) => g.game_status === 'completed' || g.game_status === 'in_progress')
  const runsFor = played.reduce((sum, g) => sum + (g.our_score ?? 0), 0)
  const runsAgainst = played.reduce((sum, g) => sum + (g.opponent_score ?? 0), 0)
  const runDiff = runsFor - runsAgainst

  const today = localIsoDate()
  const nextGame = scheduledGames.find((g) => g.game_date.slice(0, 10) >= today) ?? scheduledGames[0] ?? null
  const nextGameReady = !!(nextGame?.lineup_template_id && nextGame?.opponent_lineup_template_id && nextGame?.batting_first)

  const recent = games
    .filter((g) => g.game_status !== 'scheduled')
    .sort((a, b) => byDateAsc(b, a))
    .slice(0, 5)

  // ---- At-bat-derived numbers (our team only) --------------------------------
  let teamAB = 0
  let teamH = 0
  const byPlayer = new Map<string, HitterStats>()
  for (const ab of atBats) {
    if (!ab.result) continue
    const isAtBat = !NON_AT_BAT_RESULTS.has(ab.result)
    const isHit = HIT_RESULTS.has(ab.result)
    if (isAtBat) teamAB++
    if (isHit) teamH++

    if (!ab.players) continue
    const stats = byPlayer.get(ab.player_id) ?? {
      playerId: ab.player_id,
      firstName: ab.players.first_name,
      lastName: ab.players.last_name,
      jersey: ab.players.jersey_number,
      photoUrl: ab.players.photo_url,
      ab: 0,
      h: 0,
      hr: 0,
      rbi: 0,
      avg: 0,
    }
    if (isAtBat) stats.ab++
    if (isHit) stats.h++
    if (ab.result === 'home_run') stats.hr++
    stats.rbi += typeof ab.rbi === 'number' ? ab.rbi : 0
    byPlayer.set(ab.player_id, stats)
  }
  const teamAvg = teamAB > 0 ? teamH / teamAB : 0
  const topHitters = [...byPlayer.values()]
    .filter((s) => s.ab >= 1)
    .map((s) => ({ ...s, avg: s.h / s.ab }))
    .sort((a, b) => b.h - a.h || b.avg - a.avg || b.hr - a.hr || b.rbi - a.rbi)
    .slice(0, 5)

  // ---- Presentation helpers --------------------------------------------------
  const recordValue = `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`
  const recordHint = completed.length > 0 ? `${L.winPct} ${formatAvg(wins / completed.length)}` : L.noCompletedGames
  const gamesHint = [
    `${scheduledGames.length} ${L.scheduledShort}`,
    inProgressCount > 0 ? `${inProgressCount} ${L.inProgressShort}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  function resultBadge(g: Game): { variant: BadgeVariant; label: string } {
    if (g.game_status === 'in_progress') return { variant: 'primary', label: L.inProgress }
    if (g.game_status === 'postponed') return { variant: 'warning', label: L.postponed }
    if (g.game_status === 'cancelled') return { variant: 'outline', label: L.cancelled }
    const us = g.our_score ?? 0
    const them = g.opponent_score ?? 0
    if (us > them) return { variant: 'success', label: L.win }
    if (us < them) return { variant: 'danger', label: L.loss }
    return { variant: 'default', label: L.tie }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={L.title} description={L.description} />

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Trophy />} label={L.record} value={recordValue} hint={recordHint} />
        <StatTile icon={<CalendarDays />} label={L.gamesPlayed} value={completed.length} hint={gamesHint} />
        <StatTile
          icon={<Target />}
          label={L.teamAvg}
          value={formatAvg(teamAvg)}
          hint={`${teamH} ${L.hits} / ${teamAB} ${L.abShort}`}
        />
        <StatTile
          icon={<Activity />}
          label={L.runs}
          value={
            <>
              {runsFor}
              <span className="mx-1.5 text-xl font-medium text-muted-foreground">/</span>
              {runsAgainst}
            </>
          }
          hint={`${L.differential} ${runDiff > 0 ? '+' : ''}${runDiff}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next game */}
        <Link
          href="/games"
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{L.nextGame}</CardTitle>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  {L.viewGames}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {nextGame ? (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold tracking-tight">vs {nextGame.opponent}</h4>
                    <Badge variant={nextGameReady ? 'success' : 'warning'}>
                      {nextGameReady ? L.readyToScore : L.setupPending}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {parseGameDate(nextGame.game_date).toLocaleDateString(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    {nextGame.game_time && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-4" aria-hidden="true" />
                        {formatGameTime(nextGame.game_time)}
                      </span>
                    )}
                    {nextGame.stadium && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4" aria-hidden="true" />
                        {nextGame.stadium}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs">
                    <p className="mb-1.5 font-semibold text-slate-700">{L.lineupStatus}</p>
                    <ul className="space-y-1">
                      <ChecklistRow
                        ok={!!nextGame.lineup_template_id}
                        label={nextGame.lineup_template_id ? L.ourLineupOk : L.ourLineupPending}
                      />
                      <ChecklistRow
                        ok={!!nextGame.opponent_lineup_template_id}
                        label={`${L.opponent} (${nextGame.opponent}): ${
                          nextGame.opponent_lineup_template_id ? L.lineupOk : L.lineupPending
                        }`}
                      />
                      <ChecklistRow
                        ok={!!nextGame.batting_first}
                        label={nextGame.batting_first ? L.battingFirstOk : L.battingFirstPending}
                      />
                    </ul>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<CalendarDays />}
                  title={L.noNextGame}
                  description={L.noNextGameHint}
                  className="border-0 bg-transparent py-8"
                />
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Recent results */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{L.recentResults}</CardTitle>
                <CardDescription>{L.recentResultsHint}</CardDescription>
              </div>
              <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                icon={<History />}
                title={L.noResults}
                description={L.noResultsHint}
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((g) => {
                  const badge = resultBadge(g)
                  return (
                    <li key={g.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
                        {parseGameDate(g.game_date).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">vs {g.opponent}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {g.our_score ?? 0}
                        <span className="mx-1 text-muted-foreground">–</span>
                        {g.opponent_score ?? 0}
                      </span>
                      <Badge variant={badge.variant} className="w-9 justify-center sm:w-auto">
                        {badge.label}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top hitters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{L.topHitters}</CardTitle>
              <CardDescription>{L.topHittersHint}</CardDescription>
            </div>
            <BarChart3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          {topHitters.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title={L.noHitters}
              description={L.noHittersHint}
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">{L.player}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{L.avg}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{L.hits}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{L.homeRuns}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{L.rbi}</th>
                  </tr>
                </thead>
                <tbody>
                  {topHitters.map((p, index) => (
                    <tr key={p.playerId} className="border-t border-border hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                          <Avatar
                            size="sm"
                            src={p.photoUrl}
                            alt={`${p.firstName} ${p.lastName}`}
                            initials={`${p.firstName.charAt(0)}${p.lastName.charAt(0)}`}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {p.firstName} {p.lastName}
                            </p>
                            {p.jersey !== null && (
                              <p className="text-xs text-muted-foreground tabular-nums">#{p.jersey}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatAvg(p.avg)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.h}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.hr}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.rbi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
