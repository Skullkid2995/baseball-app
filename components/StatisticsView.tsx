'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BarChart3, X } from 'lucide-react'
import SprayChart from './SprayChart'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  Alert,
  Avatar,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '@/components/ui'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Data shapes (only the columns this view reads)
// ---------------------------------------------------------------------------

interface AtBatPlayer {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  team_id: string | null
  photo_url: string | null
}

/**
 * Selected with `*` (like HitStatistics) because some deployed databases predate the
 * add_* migrations: team_side / stolen_bases / field location columns may be missing.
 */
interface AtBatRow {
  id: string
  game_id: string
  player_id: string
  result: string
  rbi?: number | null
  runs_scored?: number | null
  stolen_bases?: number | null
  team_side?: string | null
  field_area?: string | null
  field_zone?: string | null
  hit_distance?: string | null
  hit_x?: number | string | null
  hit_y?: number | string | null
  notation?: string | null
  players: AtBatPlayer | null
}

interface GameRow {
  id: string
  opponent: string
  game_date: string
  team_id?: string | null
}

type SideFilter = 'home' | 'opponent' | 'both'

interface PlayerStats {
  id: string
  name: string
  jersey: number | null
  photoUrl: string | null
  initials: string
  games: Set<string>
  g: number
  pa: number
  ab: number
  h: number
  singles: number
  doubles: number
  triples: number
  hr: number
  rbi: number
  r: number
  bb: number
  hbp: number
  sf: number
  k: number
  sb: number
  avg: number
  obp: number
  slg: number
  ops: number
}

type SortKey =
  | 'name'
  | 'g'
  | 'pa'
  | 'ab'
  | 'h'
  | 'doubles'
  | 'triples'
  | 'hr'
  | 'rbi'
  | 'r'
  | 'bb'
  | 'k'
  | 'sb'
  | 'avg'
  | 'obp'
  | 'slg'
  | 'ops'

type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Batting math (docs/FRONTEND_GUIDE.md)
//   hits      = single + double + triple + home_run
//   at-bats   = every plate appearance except walk, hit_by_pitch, sacrifice_fly, sacrifice_bunt
//   AVG = H/AB · OBP = (H+BB+HBP)/(AB+BB+HBP+SF) · SLG = (1B+2·2B+3·3B+4·HR)/AB · OPS = OBP+SLG
// ---------------------------------------------------------------------------

const HIT_RESULTS = new Set(['single', 'double', 'triple', 'home_run'])
const NON_AB_RESULTS = new Set(['walk', 'hit_by_pitch', 'sacrifice_fly', 'sacrifice_bunt'])

const isHit = (result: string) => HIT_RESULTS.has(result)
const isAtBat = (result: string) => !NON_AB_RESULTS.has(result)
const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const ratio = (n: number, d: number) => (d > 0 ? n / d : 0)

/** `.333` style: three decimals, no leading zero (keeps `1.250` for values >= 1). */
function fmtAvg(value: number, denominator: number): string {
  if (denominator <= 0) return '—'
  return value.toFixed(3).replace(/^0\./, '.')
}

/**
 * Which side batted. `team_side` wins when the row has it; otherwise fall back to the
 * HitStatistics rule (player's team_id vs the game's team_id) and finally, like the
 * scorebook does for legacy rows, to our team.
 */
function sideOf(ab: AtBatRow, gameTeamId: string | null | undefined): 'home' | 'opponent' {
  if (ab.team_side === 'home' || ab.team_side === 'opponent') return ab.team_side
  if (gameTeamId && ab.players?.team_id) return ab.players.team_id === gameTeamId ? 'home' : 'opponent'
  return 'home'
}

/** game_date is a plain `YYYY-MM-DD`; build a local date so it does not shift a day. */
function formatGameDate(raw: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (!m) return raw
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

function newPlayerStats(id: string, p: AtBatPlayer | null, unknownLabel: string): PlayerStats {
  const first = p?.first_name?.trim() ?? ''
  const last = p?.last_name?.trim() ?? ''
  const name = [first, last].filter(Boolean).join(' ') || unknownLabel
  const initials = ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?'
  return {
    id,
    name,
    jersey: p?.jersey_number ?? null,
    photoUrl: p?.photo_url ?? null,
    initials,
    games: new Set<string>(),
    g: 0, pa: 0, ab: 0, h: 0, singles: 0, doubles: 0, triples: 0, hr: 0,
    rbi: 0, r: 0, bb: 0, hbp: 0, sf: 0, k: 0, sb: 0,
    avg: 0, obp: 0, slg: 0, ops: 0,
  }
}

function accumulate(s: PlayerStats, ab: AtBatRow) {
  const r = ab.result
  s.games.add(ab.game_id)
  s.pa += 1
  if (isAtBat(r)) s.ab += 1
  if (isHit(r)) s.h += 1
  if (r === 'single') s.singles += 1
  else if (r === 'double') s.doubles += 1
  else if (r === 'triple') s.triples += 1
  else if (r === 'home_run') s.hr += 1
  else if (r === 'walk') s.bb += 1
  else if (r === 'hit_by_pitch') s.hbp += 1
  else if (r === 'sacrifice_fly') s.sf += 1
  else if (r === 'strikeout') s.k += 1
  s.rbi += num(ab.rbi)
  s.r += num(ab.runs_scored)
  s.sb += num(ab.stolen_bases)
}

function finalize(s: PlayerStats): PlayerStats {
  const totalBases = s.singles + 2 * s.doubles + 3 * s.triples + 4 * s.hr
  s.g = s.games.size
  s.avg = ratio(s.h, s.ab)
  s.obp = ratio(s.h + s.bb + s.hbp, s.ab + s.bb + s.hbp + s.sf)
  s.slg = ratio(totalBases, s.ab)
  s.ops = s.obp + s.slg
  return s
}

// ---------------------------------------------------------------------------
// Labels (view-local; the shared dictionary is not touched)
// ---------------------------------------------------------------------------

const EN = {
  sprayChart: 'Spray chart',
  sprayChartHint: 'Every batted ball as the line registered at the at-bat: home plate to where it landed. Tap a player in the table to filter.',
  filteredBy: 'Showing',
  clearPlayer: 'All players',
  tapToFilter: 'Tap a row to filter the spray chart',
  title: 'Statistics',
  description: 'Cumulative batting across every scored game.',
  loading: 'Loading statistics…',
  loadError: 'Could not load statistics',
  filterGame: 'Game',
  allGames: 'All games',
  filterSide: 'Team',
  sideHome: 'Dodgers',
  sideOpponent: 'Opponents',
  sideBoth: 'Both',
  filterMinAb: 'Min. at-bats',
  minAbHint: 'Players below this AB count are hidden from the leaderboard.',
  avg: 'AVG',
  obp: 'OBP',
  slg: 'SLG',
  ops: 'OPS',
  avgFull: 'Batting average (H/AB)',
  obpFull: 'On-base percentage',
  slgFull: 'Slugging percentage',
  opsFull: 'On-base plus slugging',
  hitsShort: 'H',
  hrShort: 'HR',
  rbiShort: 'RBI',
  hitsFull: 'Hits',
  hrFull: 'Home runs',
  rbiFull: 'Runs batted in',
  totalsTile: 'H / HR / RBI',
  leaderboard: 'Batting leaderboard',
  leaderboardHint: 'Click a column header to sort.',
  player: 'Player',
  g: 'G',
  gFull: 'Games',
  pa: 'PA',
  paFull: 'Plate appearances',
  ab: 'AB',
  abFull: 'At-bats',
  doubles: '2B',
  doublesFull: 'Doubles',
  triples: '3B',
  triplesFull: 'Triples',
  r: 'R',
  rFull: 'Runs scored',
  bb: 'BB',
  bbFull: 'Walks',
  k: 'K',
  kFull: 'Strikeouts',
  sb: 'SB',
  sbFull: 'Stolen bases',
  noPlayersForMin: (n: number) => `No players with at least ${n} at-bats.`,
  playersShown: (n: number) => `${n} player${n === 1 ? '' : 's'}`,
  hitDistribution: 'Hit distribution',
  hitDistributionHint: 'Where hits landed, counted over every hit in the current filter.',
  byFieldArea: 'By field area',
  byDistance: 'By distance',
  noLocationData: 'No location data for these hits.',
  ofHits: (n: number, total: number) => `${n} of ${total} hits have location data`,
  distanceShort: 'Short',
  distanceMedium: 'Medium',
  distanceDeep: 'Deep',
  emptyTitle: 'No at-bats yet',
  emptyDescription: 'Score a game and the season numbers will show up here.',
  emptyFilteredTitle: 'Nothing matches these filters',
  emptyFilteredDescription: 'Try another game or team.',
  unknownPlayer: 'Unknown player',
  scope: (games: number, pa: number) => `${games} game${games === 1 ? '' : 's'} · ${pa} plate appearance${pa === 1 ? '' : 's'}`,
  vs: 'vs',
}

const ES: typeof EN = {
  sprayChart: 'Mapa de batazos',
  sprayChartHint: 'Cada batazo como la línea registrada en el turno: de home a donde cayó. Toca un jugador en la tabla para filtrar.',
  filteredBy: 'Mostrando',
  clearPlayer: 'Todos los jugadores',
  tapToFilter: 'Toca una fila para filtrar el mapa',
  title: 'Estadísticas',
  description: 'Bateo acumulado de todos los juegos anotados.',
  loading: 'Cargando estadísticas…',
  loadError: 'No se pudieron cargar las estadísticas',
  filterGame: 'Juego',
  allGames: 'Todos los juegos',
  filterSide: 'Equipo',
  sideHome: 'Dodgers',
  sideOpponent: 'Rivales',
  sideBoth: 'Ambos',
  filterMinAb: 'Mín. veces al bate',
  minAbHint: 'Los jugadores con menos VB no aparecen en la tabla.',
  avg: 'AVG',
  obp: 'OBP',
  slg: 'SLG',
  ops: 'OPS',
  avgFull: 'Promedio de bateo (H/VB)',
  obpFull: 'Porcentaje de embasarse',
  slgFull: 'Porcentaje de slugging',
  opsFull: 'OBP + SLG',
  hitsShort: 'H',
  hrShort: 'HR',
  rbiShort: 'CI',
  hitsFull: 'Hits',
  hrFull: 'Jonrones',
  rbiFull: 'Carreras impulsadas',
  totalsTile: 'H / HR / CI',
  leaderboard: 'Líderes de bateo',
  leaderboardHint: 'Toca el encabezado de una columna para ordenar.',
  player: 'Jugador',
  g: 'J',
  gFull: 'Juegos',
  pa: 'AP',
  paFull: 'Apariciones al plato',
  ab: 'VB',
  abFull: 'Veces al bate',
  doubles: '2B',
  doublesFull: 'Dobles',
  triples: '3B',
  triplesFull: 'Triples',
  r: 'C',
  rFull: 'Carreras anotadas',
  bb: 'BB',
  bbFull: 'Bases por bolas',
  k: 'K',
  kFull: 'Ponches',
  sb: 'BR',
  sbFull: 'Bases robadas',
  noPlayersForMin: (n: number) => `Ningún jugador con al menos ${n} veces al bate.`,
  playersShown: (n: number) => `${n} jugador${n === 1 ? '' : 'es'}`,
  hitDistribution: 'Distribución de hits',
  hitDistributionHint: 'Dónde cayeron los hits, contando todos los hits del filtro actual.',
  byFieldArea: 'Por zona del campo',
  byDistance: 'Por distancia',
  noLocationData: 'Estos hits no tienen ubicación registrada.',
  ofHits: (n: number, total: number) => `${n} de ${total} hits tienen ubicación`,
  distanceShort: 'Corto',
  distanceMedium: 'Medio',
  distanceDeep: 'Profundo',
  emptyTitle: 'Todavía no hay turnos al bate',
  emptyDescription: 'Anota un juego y aquí aparecerán los números de la temporada.',
  emptyFilteredTitle: 'Nada coincide con estos filtros',
  emptyFilteredDescription: 'Prueba con otro juego u otro equipo.',
  unknownPlayer: 'Jugador desconocido',
  scope: (games: number, pa: number) => `${games} juego${games === 1 ? '' : 's'} · ${pa} aparici${pa === 1 ? 'ón' : 'ones'} al plato`,
  vs: 'vs',
}

type Labels = typeof EN

interface Column {
  key: Exclude<SortKey, 'name'>
  label: keyof Labels
  full: keyof Labels
  kind: 'int' | 'avg'
  /** Denominator used to decide whether an average is undefined. */
  denom?: (s: PlayerStats) => number
}

const COLUMNS: Column[] = [
  { key: 'g', label: 'g', full: 'gFull', kind: 'int' },
  { key: 'pa', label: 'pa', full: 'paFull', kind: 'int' },
  { key: 'ab', label: 'ab', full: 'abFull', kind: 'int' },
  { key: 'h', label: 'hitsShort', full: 'hitsFull', kind: 'int' },
  { key: 'doubles', label: 'doubles', full: 'doublesFull', kind: 'int' },
  { key: 'triples', label: 'triples', full: 'triplesFull', kind: 'int' },
  { key: 'hr', label: 'hrShort', full: 'hrFull', kind: 'int' },
  { key: 'rbi', label: 'rbiShort', full: 'rbiFull', kind: 'int' },
  { key: 'r', label: 'r', full: 'rFull', kind: 'int' },
  { key: 'bb', label: 'bb', full: 'bbFull', kind: 'int' },
  { key: 'k', label: 'k', full: 'kFull', kind: 'int' },
  { key: 'sb', label: 'sb', full: 'sbFull', kind: 'int' },
  { key: 'avg', label: 'avg', full: 'avgFull', kind: 'avg', denom: (s) => s.ab },
  { key: 'obp', label: 'obp', full: 'obpFull', kind: 'avg', denom: (s) => s.ab + s.bb + s.hbp + s.sf },
  { key: 'slg', label: 'slg', full: 'slgFull', kind: 'avg', denom: (s) => s.ab },
  { key: 'ops', label: 'ops', full: 'opsFull', kind: 'avg', denom: (s) => s.ab },
]

const PAGE_SIZE = 1000

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatisticsView() {
  const { language } = useLanguage()
  const L = language === 'es' ? ES : EN
  const locale = language === 'es' ? 'es-MX' : 'en-US'

  const [atBats, setAtBats] = useState<AtBatRow[]>([])
  const [games, setGames] = useState<GameRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [gameFilter, setGameFilter] = useState<string>('all')
  const [sideFilter, setSideFilter] = useState<SideFilter>('home')
  const [minAbInput, setMinAbInput] = useState<string>('1')
  const [sortKey, setSortKey] = useState<SortKey>('avg')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

  const minAb = Math.max(0, Math.floor(Number(minAbInput)) || 0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const gamesReq = supabase
          .from('games')
          .select('*')
          .order('game_date', { ascending: false })

        // Supabase caps a single select at 1000 rows; page through the season.
        const rows: AtBatRow[] = []
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error: abError } = await supabase
            .from('at_bats')
            .select('*, players ( id, first_name, last_name, jersey_number, team_id, photo_url )')
            .order('created_at', { ascending: true })
            .range(from, from + PAGE_SIZE - 1)
          if (abError) throw new Error(abError.message)
          const page = (data ?? []) as unknown as AtBatRow[]
          rows.push(...page)
          if (page.length < PAGE_SIZE) break
        }

        const { data: gamesData, error: gamesError } = await gamesReq
        if (gamesError) throw new Error(gamesError.message)

        if (cancelled) return
        setAtBats(rows)
        setGames((gamesData ?? []) as unknown as GameRow[])
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const gameTeamById = useMemo(() => new Map(games.map((g) => [g.id, g.team_id ?? null])), [games])

  // Game + side filter (min AB applies to the leaderboard only).
  const filtered = useMemo(
    () =>
      atBats.filter(
        (ab) =>
          (gameFilter === 'all' || ab.game_id === gameFilter) &&
          (sideFilter === 'both' || sideOf(ab, gameTeamById.get(ab.game_id)) === sideFilter)
      ),
    [atBats, gameFilter, sideFilter, gameTeamById]
  )

  // Team summary over the filtered at-bats.
  const team = useMemo(() => {
    const t = finalize(
      filtered.reduce((acc, ab) => {
        accumulate(acc, ab)
        return acc
      }, newPlayerStats('team', null, ''))
    )
    return t
  }, [filtered])

  // Per-player aggregates.
  const players = useMemo(() => {
    const map = new Map<string, PlayerStats>()
    for (const ab of filtered) {
      let s = map.get(ab.player_id)
      if (!s) {
        s = newPlayerStats(ab.player_id, ab.players, L.unknownPlayer)
        map.set(ab.player_id, s)
      }
      accumulate(s, ab)
    }
    return Array.from(map.values()).map(finalize)
  }, [filtered, L.unknownPlayer])

  const leaderboard = useMemo(() => {
    const visible = players.filter((p) => p.ab >= minAb)
    const dir = sortDir === 'asc' ? 1 : -1
    const byName = (a: PlayerStats, b: PlayerStats) => a.name.localeCompare(b.name, locale)
    return visible.sort((a, b) => {
      if (sortKey === 'name') return byName(a, b) * dir
      const diff = (a[sortKey] - b[sortKey]) * dir
      if (diff !== 0) return diff
      if (b.h !== a.h) return b.h - a.h
      if (b.ab !== a.ab) return b.ab - a.ab
      return byName(a, b)
    })
  }, [players, minAb, sortKey, sortDir, locale])

  // Hit distribution (hits only).
  const distribution = useMemo(() => {
    const hits = filtered.filter((ab) => isHit(ab.result))
    const byArea = new Map<string, number>()
    const byDistance = new Map<string, number>()
    for (const ab of hits) {
      const area = (ab.field_area ?? '').trim()
      const dist = (ab.hit_distance ?? '').trim()
      if (area) byArea.set(area, (byArea.get(area) ?? 0) + 1)
      if (dist) byDistance.set(dist, (byDistance.get(dist) ?? 0) + 1)
    }
    const toRows = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    return { totalHits: hits.length, byArea: toRows(byArea), byDistance: toRows(byDistance) }
  }, [filtered])

  const gamesInScope = useMemo(() => new Set(filtered.map((ab) => ab.game_id)).size, [filtered])

  // Spray chart: the filtered at-bats, narrowed to one player when a row is tapped
  const sprayAtBats = useMemo(
    () => (selectedPlayerId ? filtered.filter((ab) => ab.player_id === selectedPlayerId) : filtered),
    [filtered, selectedPlayerId]
  )
  const selectedPlayer = useMemo(() => players.find((p) => p.id === selectedPlayerId) ?? null, [players, selectedPlayerId])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const distanceLabel = (raw: string) => {
    switch (raw.toUpperCase()) {
      case 'SHORT':
        return L.distanceShort
      case 'MEDIUM':
        return L.distanceMedium
      case 'DEEP':
        return L.distanceDeep
      default:
        return raw.replace(/_/g, ' ').toLowerCase()
    }
  }
  const areaLabel = (raw: string) => raw.replace(/^_+|_+$/g, '').replace(/_+/g, ' ').toLowerCase()

  const header = <PageHeader title={L.title} description={L.description} />

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingState label={L.loading} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <Alert variant="error" title={L.loadError}>
          {error}
        </Alert>
      </div>
    )
  }

  const nothingAtAll = atBats.length === 0
  const nothingMatches = !nothingAtAll && filtered.length === 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={L.title}
        description={filtered.length > 0 ? L.scope(gamesInScope, filtered.length) : L.description}
      />

      {/* Filters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label={L.filterGame}>
          <Select value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>
            <option value="all">{L.allGames}</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {L.vs} {g.opponent} · {formatGameDate(g.game_date, locale)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={L.filterSide}>
          <Select value={sideFilter} onChange={(e) => setSideFilter(e.target.value as SideFilter)}>
            <option value="home">{L.sideHome}</option>
            <option value="opponent">{L.sideOpponent}</option>
            <option value="both">{L.sideBoth}</option>
          </Select>
        </FormField>
        <FormField label={L.filterMinAb} hint={L.minAbHint}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={minAbInput}
            onChange={(e) => setMinAbInput(e.target.value)}
            onBlur={() => setMinAbInput(String(minAb))}
          />
        </FormField>
      </div>

      {nothingAtAll && (
        <EmptyState icon={<BarChart3 />} title={L.emptyTitle} description={L.emptyDescription} />
      )}
      {nothingMatches && (
        <EmptyState icon={<BarChart3 />} title={L.emptyFilteredTitle} description={L.emptyFilteredDescription} />
      )}

      {filtered.length > 0 && (
        <>
          {/* Team summary tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label={L.avg} title={L.avgFull} value={fmtAvg(team.avg, team.ab)} sub={`${team.h} ${L.hitsShort} / ${team.ab} ${L.ab}`} />
            <StatTile
              label={L.obp}
              title={L.obpFull}
              value={fmtAvg(team.obp, team.ab + team.bb + team.hbp + team.sf)}
              sub={`${team.pa} ${L.pa} · ${team.bb} ${L.bb}`}
            />
            <StatTile
              label={L.slg}
              title={L.slgFull}
              value={fmtAvg(team.slg, team.ab)}
              sub={`${L.ops} ${fmtAvg(team.ops, team.ab)}`}
            />
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{L.totalsTile}</p>
                <div className="mt-1 flex items-baseline gap-5">
                  <MiniStat label={L.hitsShort} title={L.hitsFull} value={team.h} />
                  <MiniStat label={L.hrShort} title={L.hrFull} value={team.hr} />
                  <MiniStat label={L.rbiShort} title={L.rbiFull} value={team.rbi} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Spray chart: hit lines as registered, green hits / red outs */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{L.sprayChart}</CardTitle>
                <CardDescription>{L.sprayChartHint}</CardDescription>
              </div>
              {selectedPlayer && (
                <button
                  type="button"
                  onClick={() => setSelectedPlayerId(null)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground hover:bg-blue-100"
                  title={L.clearPlayer}
                >
                  {L.filteredBy}: {selectedPlayer.name}
                  <X className="size-3.5" />
                </button>
              )}
            </CardHeader>
            <CardContent>
              <SprayChart atBats={sprayAtBats} lang={locale.startsWith('es') ? 'es' : 'en'} />
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <section className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-base font-semibold tracking-tight">{L.leaderboard}</h3>
              <p className="text-xs text-muted-foreground">
                {L.playersShown(leaderboard.length)} · {L.leaderboardHint} · {L.tapToFilter}
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <SortableTh
                      label={L.player}
                      active={sortKey === 'name'}
                      dir={sortDir}
                      onClick={() => toggleSort('name')}
                      align="left"
                      className="min-w-[10rem]"
                    />
                    {COLUMNS.map((col) => (
                      <SortableTh
                        key={col.key}
                        label={L[col.label] as string}
                        title={L[col.full] as string}
                        active={sortKey === col.key}
                        dir={sortDir}
                        onClick={() => toggleSort(col.key)}
                        align="right"
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 && (
                    <tr className="border-t border-border">
                      <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        {L.noPlayersForMin(minAb)}
                      </td>
                    </tr>
                  )}
                  {leaderboard.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPlayerId((cur) => (cur === p.id ? null : p.id))}
                      aria-selected={selectedPlayerId === p.id}
                      className={cn(
                        'cursor-pointer border-t border-border hover:bg-slate-50/60',
                        selectedPlayerId === p.id && 'bg-accent/60 hover:bg-accent/60'
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar src={p.photoUrl} alt={p.name} initials={p.initials} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{p.name}</div>
                            {p.jersey !== null && (
                              <div className="text-xs text-muted-foreground tabular-nums">#{p.jersey}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-2 py-2.5 text-right tabular-nums whitespace-nowrap',
                            col.kind === 'avg' && 'font-medium',
                            sortKey === col.key && 'bg-accent/40'
                          )}
                        >
                          {col.kind === 'avg' ? fmtAvg(p[col.key], col.denom ? col.denom(p) : 1) : p[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Hit distribution */}
          <Card>
            <CardHeader>
              <CardTitle>{L.hitDistribution}</CardTitle>
              <CardDescription>{L.hitDistributionHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <BarList
                title={L.byFieldArea}
                rows={distribution.byArea.map((r) => ({ key: r.key, label: areaLabel(r.key), count: r.count }))}
                totalHits={distribution.totalHits}
                capitalize
                emptyLabel={L.noLocationData}
                coverage={L.ofHits}
              />
              <BarList
                title={L.byDistance}
                rows={distribution.byDistance.map((r) => ({ key: r.key, label: distanceLabel(r.key), count: r.count }))}
                totalHits={distribution.totalHits}
                emptyLabel={L.noLocationData}
                coverage={L.ofHits}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small presentational pieces (local to this view)
// ---------------------------------------------------------------------------

function StatTile({ label, title, value, sub }: { label: string; title?: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground" title={title}>
          {label}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, title, value }: { label: string; title?: string; value: number }) {
  return (
    <div title={title}>
      <div className="text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

function SortableTh({
  label,
  title,
  active,
  dir,
  onClick,
  align,
  className,
}: {
  label: string
  title?: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align: 'left' | 'right'
  className?: string
}) {
  const Icon = dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-2 py-3 font-semibold whitespace-nowrap', align === 'right' ? 'text-right' : 'px-4 text-left', className)}
    >
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn(
          'inline-flex items-center gap-1 rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          align === 'right' && 'flex-row-reverse',
          active && 'text-primary'
        )}
      >
        <span>{label}</span>
        {active && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      </button>
    </th>
  )
}

function BarList({
  title,
  rows,
  totalHits,
  emptyLabel,
  coverage,
  capitalize = false,
}: {
  title: string
  rows: { key: string; label: string; count: number }[]
  totalHits: number
  emptyLabel: string
  coverage: (n: number, total: number) => string
  capitalize?: boolean
}) {
  const withData = rows.reduce((sum, r) => sum + r.count, 0)
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0)
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        {withData > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{coverage(withData, totalHits)}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const pct = withData > 0 ? Math.round((r.count / withData) * 100) : 0
            const width = max > 0 ? (r.count / max) * 100 : 0
            return (
              <li key={r.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className={cn('min-w-0 truncate text-slate-700', capitalize && 'capitalize')} title={r.key}>
                    {r.label}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    <span className="text-sm font-medium text-foreground">{r.count}</span> · {pct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
