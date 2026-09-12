'use client'

import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import LineupTemplates from '@/components/LineupTemplates'
import { Alert, Avatar, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'

interface TeamRow {
  id: string
  name: string
  city: string
  logo_url: string | null
  players: { id: string }[]
}

/** Lineup templates per team: pick a team on the left, manage its saved lineup on the right. */
export default function LineupsView() {
  const { language } = useLanguage()
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const L =
    language === 'es'
      ? {
          title: 'Alineaciones',
          description: 'Plantillas de alineación guardadas por equipo. Se usan al preparar un juego.',
          teams: 'Equipos',
          players: 'jugadores',
          opponent: 'Oponente',
          pick: 'Selecciona un equipo para ver o editar su alineación.',
          none: 'No hay equipos todavía',
          noneHint: 'Crea un equipo en la sección Equipos para poder armar una alineación.',
        }
      : {
          title: 'Lineups',
          description: 'Saved lineup templates per team. They are used when preparing a game.',
          teams: 'Teams',
          players: 'players',
          opponent: 'Opponent',
          pick: 'Pick a team to view or edit its lineup.',
          none: 'No teams yet',
          noneHint: 'Create a team under Teams before building a lineup.',
        }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('teams')
          .select('id, name, city, logo_url, players ( id )')
          .order('name')
        if (error) {
          setError(error.message)
          return
        }
        const rows = (data || []) as TeamRow[]
        // Our own teams (non-opponent) first, then by roster size
        rows.sort((a, b) => {
          const ao = a.city === 'Opponent' ? 1 : 0
          const bo = b.city === 'Opponent' ? 1 : 0
          if (ao !== bo) return ao - bo
          return (b.players?.length || 0) - (a.players?.length || 0)
        })
        setTeams(rows)
        setSelectedTeamId((prev) => prev ?? rows[0]?.id ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load teams')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingState />
  if (error) return <Alert variant="error">{error}</Alert>

  const selected = teams.find((t) => t.id === selectedTeamId) || null

  return (
    <div className="space-y-6">
      <PageHeader title={L.title} description={L.description} />

      {teams.length === 0 ? (
        <EmptyState icon={<ClipboardList />} title={L.none} description={L.noneHint} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          {/* Team picker */}
          <Card className="h-fit overflow-hidden">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {L.teams}
            </div>
            <ul className="divide-y divide-border">
              {teams.map((team) => {
                const active = team.id === selectedTeamId
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTeamId(team.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                        active ? 'bg-accent' : 'hover:bg-slate-50'
                      )}
                    >
                      <Avatar
                        src={team.logo_url}
                        alt={team.name}
                        initials={team.name.charAt(0)}
                        rounded="lg"
                        className={cn(team.logo_url && 'object-contain p-0.5')}
                      />
                      <div className="min-w-0 flex-1">
                        <div className={cn('truncate text-sm font-medium', active && 'text-accent-foreground')}>
                          {team.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {team.city === 'Opponent' ? L.opponent : team.city} · {team.players?.length || 0} {L.players}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* Templates for the selected team */}
          <Card className="p-5 sm:p-6">
            {selected ? (
              <LineupTemplates key={selected.id} teamId={selected.id} onClose={() => {}} embedded />
            ) : (
              <EmptyState icon={<ClipboardList />} title={L.pick} className="py-16" />
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
