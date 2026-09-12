'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, UserRound, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { getBaseballPositions } from '@/lib/translations'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  buttonVariants,
} from '@/components/ui'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamRef {
  id: string
  name: string
  city: string
}

interface Player {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  positions: string[]
  handedness: string | null
  team_id: string | null
  photo_url: string | null
  date_of_birth: string | null
  is_active: boolean | null
  batting_hand: string | null
  throwing_hand: string | null
  height_inches: number | null
  weight_lbs: number | null
  contact_number: string | null
  emergency_number: string | null
  emergency_contact_name: string | null
  debut_date: string | null
  team: TeamRef | null
}

type SortKey = 'team' | 'player'
type SortDir = 'asc' | 'desc'

const NO_TEAM = '__none__'
const OPPONENT_CITY = 'Opponent'
const POSITION_ORDER = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "Pitcher (P)" / "Lanzador (P)" -> "P". Falls back to the label itself. */
function positionCode(label: string): string {
  const match = /\(([^()]+)\)\s*$/.exec(label)
  if (match) return match[1].trim().toUpperCase()
  const trimmed = label.trim()
  return trimmed.length <= 3 ? trimmed.toUpperCase() : trimmed
}

function positionRank(code: string): number {
  const idx = POSITION_ORDER.indexOf(code)
  return idx === -1 ? POSITION_ORDER.length : idx
}

/** Parse a `YYYY-MM-DD` date without timezone drift. */
function parseDate(value: string | null): Date | null {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

function ageFrom(dob: string | null): number | null {
  const birth = parseDate(dob)
  if (!birth) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

function isActive(player: Player): boolean {
  return player.is_active !== false
}

function fullName(player: Player): string {
  return `${player.first_name} ${player.last_name}`.trim()
}

function initials(player: Player): string {
  return `${player.first_name.charAt(0)}${player.last_name.charAt(0)}`
}

function teamSortName(player: Player): string {
  return player.team ? `${player.team.name} ${player.team.city}`.toLowerCase() : ''
}

function compareJersey(a: Player, b: Player): number {
  const ja = a.jersey_number && a.jersey_number > 0 ? a.jersey_number : Number.POSITIVE_INFINITY
  const jb = b.jersey_number && b.jersey_number > 0 ? b.jersey_number : Number.POSITIVE_INFINITY
  return ja - jb
}

function compareName(a: Player, b: Player): number {
  return (
    a.last_name.localeCompare(b.last_name, undefined, { sensitivity: 'base' }) ||
    a.first_name.localeCompare(b.first_name, undefined, { sensitivity: 'base' })
  )
}

function compareTeam(a: Player, b: Player): number {
  const ta = teamSortName(a)
  const tb = teamSortName(b)
  // Players without a team go last.
  if (!ta && tb) return 1
  if (ta && !tb) return -1
  return ta.localeCompare(tb, undefined, { sensitivity: 'base' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePlayer(row: any): Player {
  const rawTeam = Array.isArray(row.teams) ? row.teams[0] : row.teams
  const team: TeamRef | null =
    rawTeam && typeof rawTeam === 'object'
      ? { id: String(rawTeam.id ?? row.team_id ?? ''), name: String(rawTeam.name ?? ''), city: String(rawTeam.city ?? '') }
      : null
  return {
    id: String(row.id),
    first_name: String(row.first_name ?? ''),
    last_name: String(row.last_name ?? ''),
    jersey_number: typeof row.jersey_number === 'number' ? row.jersey_number : null,
    positions: Array.isArray(row.positions) ? row.positions.filter((p: unknown) => typeof p === 'string') : [],
    handedness: row.handedness ?? null,
    team_id: row.team_id ?? null,
    photo_url: row.photo_url ?? null,
    date_of_birth: row.date_of_birth ?? null,
    is_active: typeof row.is_active === 'boolean' ? row.is_active : null,
    batting_hand: row.batting_hand ?? null,
    throwing_hand: row.throwing_hand ?? null,
    height_inches: typeof row.height_inches === 'number' ? row.height_inches : null,
    weight_lbs: typeof row.weight_lbs === 'number' ? row.weight_lbs : null,
    contact_number: row.contact_number ?? null,
    emergency_number: row.emergency_number ?? null,
    emergency_contact_name: row.emergency_contact_name ?? null,
    debut_date: row.debut_date ?? null,
    team,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlayersView() {
  const { language } = useLanguage()

  const L =
    language === 'es'
      ? {
          title: 'Jugadores',
          description: 'Directorio de jugadores de todos los equipos. Toca un jugador para ver su ficha.',
          loading: 'Cargando jugadores...',
          errorTitle: 'No se pudieron cargar los jugadores',
          search: 'Buscar',
          searchPlaceholder: 'Nombre, apellido o número...',
          team: 'Equipo',
          allTeams: 'Todos los equipos',
          noTeam: 'Sin equipo',
          position: 'Posición',
          allPositions: 'Todas las posiciones',
          activeOnly: 'Activos',
          colPlayer: 'Jugador',
          colTeam: 'Equipo',
          colPositions: 'Posiciones',
          colHandedness: 'Lateralidad',
          colAge: 'Edad',
          colStatus: 'Estado',
          sortBy: 'Ordenar por',
          active: 'Activo',
          inactive: 'Inactivo',
          opponent: 'Rival',
          righty: 'Diestro',
          lefty: 'Zurdo',
          switch: 'Ambidiestro',
          years: 'años',
          noPlayersTitle: 'Aún no hay jugadores',
          noPlayersDescription: 'Agrega jugadores a un equipo desde la sección Equipos.',
          noMatchesTitle: 'Sin resultados',
          noMatchesDescription: 'Ningún jugador coincide con los filtros actuales.',
          clearFilters: 'Limpiar filtros',
          profile: 'Perfil',
          jersey: 'Número',
          dateOfBirth: 'Fecha de nacimiento',
          age: 'Edad',
          debut: 'Debut',
          height: 'Estatura',
          weight: 'Peso',
          inches: 'pulg',
          pounds: 'lb',
          battingHand: 'Batea',
          throwingHand: 'Lanza',
          contact: 'Contacto',
          contactNumber: 'Teléfono de contacto',
          emergencyNumber: 'Teléfono de emergencia',
          emergencyContactName: 'Contacto de emergencia',
          editHint: 'Edita este jugador desde Equipos',
          goToTeams: 'Ir a Equipos',
          viewDetails: 'Ver ficha',
          notProvided: '—',
        }
      : {
          title: 'Players',
          description: 'Roster directory across all teams. Tap a player to see their profile.',
          loading: 'Loading players...',
          errorTitle: 'Could not load players',
          search: 'Search',
          searchPlaceholder: 'First name, last name or number...',
          team: 'Team',
          allTeams: 'All teams',
          noTeam: 'No team',
          position: 'Position',
          allPositions: 'All positions',
          activeOnly: 'Active only',
          colPlayer: 'Player',
          colTeam: 'Team',
          colPositions: 'Positions',
          colHandedness: 'Handedness',
          colAge: 'Age',
          colStatus: 'Status',
          sortBy: 'Sort by',
          active: 'Active',
          inactive: 'Inactive',
          opponent: 'Opponent',
          righty: 'Righty',
          lefty: 'Lefty',
          switch: 'Switch',
          years: 'yrs',
          noPlayersTitle: 'No players yet',
          noPlayersDescription: 'Add players to a team from the Teams section.',
          noMatchesTitle: 'No results',
          noMatchesDescription: 'No player matches the current filters.',
          clearFilters: 'Clear filters',
          profile: 'Profile',
          jersey: 'Jersey',
          dateOfBirth: 'Date of birth',
          age: 'Age',
          debut: 'Debut',
          height: 'Height',
          weight: 'Weight',
          inches: 'in',
          pounds: 'lbs',
          battingHand: 'Bats',
          throwingHand: 'Throws',
          contact: 'Contact',
          contactNumber: 'Contact number',
          emergencyNumber: 'Emergency number',
          emergencyContactName: 'Emergency contact',
          editHint: 'Edit this player from Teams',
          goToTeams: 'Go to Teams',
          viewDetails: 'View profile',
          notProvided: '—',
        }

  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<TeamRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('team')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selected, setSelected] = useState<Player | null>(null)

  const closeDetail = useCallback(() => setSelected(null), [])

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [playersRes, teamsRes] = await Promise.all([
          supabase
            .from('players')
            .select('*, teams ( id, name, city )')
            .order('last_name')
            .order('first_name'),
          supabase.from('teams').select('id, name, city').order('name'),
        ])
        if (cancelled) return
        if (playersRes.error) {
          setError(playersRes.error.message)
          return
        }
        setPlayers((playersRes.data ?? []).map(normalizePlayer))
        if (!teamsRes.error) {
          setTeams((teamsRes.data ?? []) as TeamRef[])
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch players')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // -------------------------------------------------------------------------
  // Derived labels
  // -------------------------------------------------------------------------

  // code -> localized full label, e.g. "SS" -> "Campo Corto (SS)"
  const positionLabelByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const label of getBaseballPositions(language)) map.set(positionCode(label), label)
    return map
  }, [language])

  const handednessLabel = useCallback(
    (value: string | null): string => {
      if (!value) return L.notProvided
      const v = value.trim().toLowerCase()
      if (v === 'righty' || v === 'r' || v === 'right') return L.righty
      if (v === 'lefty' || v === 'l' || v === 'left') return L.lefty
      if (v === 'switch' || v === 's' || v === 'both') return L.switch
      return value
    },
    [L.notProvided, L.righty, L.lefty, L.switch]
  )

  const formatDate = useCallback(
    (value: string | null): string => {
      const date = parseDate(value)
      if (!date) return L.notProvided
      return date.toLocaleDateString(language === 'es' ? 'es' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    },
    [language, L.notProvided]
  )

  const formatHeight = (inches: number | null): string => {
    if (!inches || inches <= 0) return L.notProvided
    const ft = Math.floor(inches / 12)
    const rest = inches % 12
    return `${ft}'${rest}" · ${inches} ${L.inches}`
  }

  const formatWeight = (lbs: number | null): string => {
    if (!lbs || lbs <= 0) return L.notProvided
    return `${lbs} ${L.pounds}`
  }

  // -------------------------------------------------------------------------
  // Filtering & sorting
  // -------------------------------------------------------------------------

  const positionOptions = useMemo(() => {
    const codes = new Set<string>()
    for (const p of players) for (const label of p.positions) codes.add(positionCode(label))
    return Array.from(codes)
      .sort((a, b) => positionRank(a) - positionRank(b) || a.localeCompare(b))
      .map((code) => ({ code, label: positionLabelByCode.get(code) ?? code }))
  }, [players, positionLabelByCode])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return players.filter((p) => {
      if (activeOnly && !isActive(p)) return false
      if (teamFilter === NO_TEAM) {
        if (p.team_id) return false
      } else if (teamFilter && p.team_id !== teamFilter) {
        return false
      }
      if (positionFilter && !p.positions.some((label) => positionCode(label) === positionFilter)) return false
      if (q) {
        const jersey = p.jersey_number && p.jersey_number > 0 ? String(p.jersey_number) : ''
        const haystack = `${p.first_name} ${p.last_name}`.toLowerCase()
        const matchesName = haystack.includes(q)
        const matchesJersey = jersey !== '' && (jersey === q || (q.startsWith('#') && jersey === q.slice(1)))
        if (!matchesName && !matchesJersey) return false
      }
      return true
    })
  }, [players, search, teamFilter, positionFilter, activeOnly])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const list = [...filtered]
    list.sort((a, b) => {
      if (sortKey === 'team') {
        return compareTeam(a, b) * dir || compareJersey(a, b) || compareName(a, b)
      }
      return compareName(a, b) * dir || compareJersey(a, b) || compareTeam(a, b)
    })
    return list
  }, [filtered, sortKey, sortDir])

  const hasFilters = search.trim() !== '' || teamFilter !== '' || positionFilter !== '' || !activeOnly

  function clearFilters() {
    setSearch('')
    setTeamFilter('')
    setPositionFilter('')
    setActiveOnly(true)
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderPositions(player: Player) {
    if (player.positions.length === 0) return <span className="text-muted-foreground">{L.notProvided}</span>
    return (
      <div className="flex flex-wrap gap-1">
        {player.positions.map((label) => (
          <Badge key={label} variant="outline" title={positionLabelByCode.get(positionCode(label)) ?? label}>
            {positionCode(label)}
          </Badge>
        ))}
      </div>
    )
  }

  function renderTeam(player: Player) {
    if (!player.team) return <span className="text-muted-foreground">{L.noTeam}</span>
    const opponent = player.team.city === OPPONENT_CITY
    return (
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-800">{player.team.name}</div>
        {opponent ? (
          <Badge variant="warning" className="mt-0.5">
            {L.opponent}
          </Badge>
        ) : (
          player.team.city && <div className="truncate text-xs text-muted-foreground">{player.team.city}</div>
        )}
      </div>
    )
  }

  function renderStatus(player: Player) {
    return isActive(player) ? (
      <Badge variant="success">{L.active}</Badge>
    ) : (
      <Badge variant="default">{L.inactive}</Badge>
    )
  }

  function renderSortHeader(label: string, column: SortKey) {
    const active = sortKey === column
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md uppercase tracking-wide transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active && 'text-foreground'
        )}
        title={`${L.sortBy}: ${label}`}
      >
        {label}
        <Icon className={cn('size-3.5', active ? 'text-primary' : 'text-slate-400')} aria-hidden="true" />
      </button>
    )
  }

  function onRowKeyDown(e: React.KeyboardEvent, player: Player) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected(player)
    }
  }

  const ariaSort = (column: SortKey): 'ascending' | 'descending' | 'none' =>
    sortKey === column ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  let content: React.ReactNode
  if (loading) {
    content = <LoadingState label={L.loading} />
  } else if (error) {
    content = (
      <Alert variant="error" title={L.errorTitle}>
        {error}
      </Alert>
    )
  } else if (players.length === 0) {
    content = <EmptyState icon={<UserRound />} title={L.noPlayersTitle} description={L.noPlayersDescription} />
  } else if (sorted.length === 0) {
    content = (
      <EmptyState
        icon={<Search />}
        title={L.noMatchesTitle}
        description={L.noMatchesDescription}
        action={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {L.clearFilters}
            </Button>
          ) : undefined
        }
      />
    )
  } else {
    content = (
      <>
        {/* Table (sm and up) */}
        <div className="hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold" aria-sort={ariaSort('player')}>
                  {renderSortHeader(L.colPlayer, 'player')}
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold" aria-sort={ariaSort('team')}>
                  {renderSortHeader(L.colTeam, 'team')}
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  {L.colPositions}
                </th>
                <th scope="col" className="hidden px-4 py-3 text-left font-semibold md:table-cell">
                  {L.colHandedness}
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right font-semibold lg:table-cell">
                  {L.colAge}
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  {L.colStatus}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((player) => {
                const age = ageFrom(player.date_of_birth)
                return (
                  <tr
                    key={player.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${L.viewDetails}: ${fullName(player)}`}
                    onClick={() => setSelected(player)}
                    onKeyDown={(e) => onRowKeyDown(e, player)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-slate-50/60 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={player.photo_url} alt={fullName(player)} initials={initials(player)} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{fullName(player)}</span>
                            {player.jersey_number && player.jersey_number > 0 ? (
                              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                #{player.jersey_number}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground md:hidden">{handednessLabel(player.handedness)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{renderTeam(player)}</td>
                    <td className="px-4 py-3">{renderPositions(player)}</td>
                    <td className="hidden px-4 py-3 text-slate-700 md:table-cell">{handednessLabel(player.handedness)}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-slate-700 lg:table-cell">
                      {age !== null ? age : <span className="text-muted-foreground">{L.notProvided}</span>}
                    </td>
                    <td className="px-4 py-3">{renderStatus(player)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Card list (below sm) */}
        <ul className="space-y-3 sm:hidden">
          {sorted.map((player) => {
            const age = ageFrom(player.date_of_birth)
            return (
              <li key={player.id}>
                <Card className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSelected(player)}
                    className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${L.viewDetails}: ${fullName(player)}`}
                  >
                    <Avatar src={player.photo_url} alt={fullName(player)} initials={initials(player)} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{fullName(player)}</span>
                            {player.jersey_number && player.jersey_number > 0 ? (
                              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                #{player.jersey_number}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {player.team ? (
                              <>
                                {player.team.name}
                                {player.team.city === OPPONENT_CITY ? ` · ${L.opponent}` : player.team.city ? ` · ${player.team.city}` : ''}
                              </>
                            ) : (
                              L.noTeam
                            )}
                          </div>
                        </div>
                        {renderStatus(player)}
                      </div>
                      <div className="mt-2">{renderPositions(player)}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {handednessLabel(player.handedness)}
                        {age !== null ? ` · ${age} ${L.years}` : ''}
                      </div>
                    </div>
                  </button>
                </Card>
              </li>
            )
          })}
        </ul>
      </>
    )
  }

  const selectedAge = selected ? ageFrom(selected.date_of_birth) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={L.title}
        count={loading || error ? undefined : sorted.length}
        description={L.description}
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)_minmax(0,220px)_auto] lg:items-end">
          <FormField label={L.search}>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={L.searchPlaceholder}
                className="pl-9"
                aria-label={L.search}
              />
            </div>
          </FormField>
          <FormField label={L.team}>
            <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label={L.team}>
              <option value="">{L.allTeams}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.city === OPPONENT_CITY ? `${team.name} (${L.opponent})` : `${team.name}${team.city ? ` · ${team.city}` : ''}`}
                </option>
              ))}
              <option value={NO_TEAM}>{L.noTeam}</option>
            </Select>
          </FormField>
          <FormField label={L.position}>
            <Select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              aria-label={L.position}
            >
              <option value="">{L.allPositions}</option>
              {positionOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>
          <label className="flex h-9 cursor-pointer select-none items-center gap-2 text-sm font-medium text-slate-700 lg:px-1">
            <Checkbox checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            {L.activeOnly}
          </label>
        </div>
      </Card>

      {content}

      {/* Read-only detail modal */}
      {selected && (
        <Modal
          size="md"
          title={fullName(selected)}
          description={
            selected.team
              ? `${selected.team.name}${selected.team.city === OPPONENT_CITY ? ` · ${L.opponent}` : selected.team.city ? ` · ${selected.team.city}` : ''}`
              : L.noTeam
          }
          onClose={closeDetail}
          closeOnBackdrop
          footer={
            <>
              <p className="mr-auto text-xs text-muted-foreground">{L.editHint}</p>
              <Link href="/teams" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Users />
                {L.goToTeams}
              </Link>
            </>
          }
        >
          <div className="space-y-6">
            {/* Identity */}
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
              <Avatar
                src={selected.photo_url}
                alt={fullName(selected)}
                initials={initials(selected)}
                size="xl"
                rounded="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="text-lg font-semibold tracking-tight">{fullName(selected)}</span>
                  {selected.jersey_number && selected.jersey_number > 0 ? (
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">#{selected.jersey_number}</span>
                  ) : null}
                  {renderStatus(selected)}
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">
                  {selected.positions.length > 0 ? (
                    selected.positions.map((label) => (
                      <Badge key={label} variant="primary">
                        {positionLabelByCode.get(positionCode(label)) ?? label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">{L.notProvided}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile */}
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.profile}</h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-slate-50/60 p-4 text-sm sm:grid-cols-2">
                <DetailItem label={L.team}>
                  {selected.team ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {selected.team.name}
                      {selected.team.city === OPPONENT_CITY ? (
                        <Badge variant="warning">{L.opponent}</Badge>
                      ) : selected.team.city ? (
                        <span className="text-muted-foreground">{selected.team.city}</span>
                      ) : null}
                    </span>
                  ) : (
                    L.noTeam
                  )}
                </DetailItem>
                <DetailItem label={L.jersey}>
                  {selected.jersey_number && selected.jersey_number > 0 ? `#${selected.jersey_number}` : L.notProvided}
                </DetailItem>
                <DetailItem label={L.dateOfBirth}>
                  {formatDate(selected.date_of_birth)}
                  {selectedAge !== null ? (
                    <span className="text-muted-foreground"> · {selectedAge} {L.years}</span>
                  ) : null}
                </DetailItem>
                <DetailItem label={L.debut}>{formatDate(selected.debut_date)}</DetailItem>
                <DetailItem label={L.colHandedness}>{handednessLabel(selected.handedness)}</DetailItem>
                <DetailItem label={`${L.battingHand} / ${L.throwingHand}`}>
                  {handednessLabel(selected.batting_hand)} / {handednessLabel(selected.throwing_hand)}
                </DetailItem>
                <DetailItem label={L.height}>{formatHeight(selected.height_inches)}</DetailItem>
                <DetailItem label={L.weight}>{formatWeight(selected.weight_lbs)}</DetailItem>
              </dl>
            </section>

            {/* Contact */}
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.contact}</h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-slate-50/60 p-4 text-sm sm:grid-cols-2">
                <DetailItem label={L.contactNumber}>
                  {selected.contact_number ? (
                    <a href={`tel:${selected.contact_number}`} className="text-primary hover:underline">
                      {selected.contact_number}
                    </a>
                  ) : (
                    L.notProvided
                  )}
                </DetailItem>
                <DetailItem label={L.emergencyNumber}>
                  {selected.emergency_number ? (
                    <a href={`tel:${selected.emergency_number}`} className="text-primary hover:underline">
                      {selected.emergency_number}
                    </a>
                  ) : (
                    L.notProvided
                  )}
                </DetailItem>
                <DetailItem label={L.emergencyContactName} className="sm:col-span-2">
                  {selected.emergency_contact_name || L.notProvided}
                </DetailItem>
              </dl>
            </section>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DetailItem({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-slate-800">{children}</dd>
    </div>
  )
}
