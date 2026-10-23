'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { Badge, Button, Input, Modal } from '@/components/ui'
import { jerseyLabel, MlbPortrait } from './MlbIdentity'
import { isPitcher } from '@/lib/scorecard/reserves'

export interface RosterPlayer {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  positions?: string[] | null
  is_active?: boolean | null
}

interface PitcherPickerProps {
  teamName: string
  roster: RosterPlayer[]
  positionPlayers?: RosterPlayer[]
  currentPitcherId?: string | null
  inning: number
  /** Why the picker opened: first pitcher of the game, or a pitching change */
  reason: 'start' | 'change'
  onPick: (player: RosterPlayer) => void
  onClose: () => void
}

/** Who is on the mound for the fielding team. Pitchers (position P) come first. */
export default function PitcherPicker({ teamName, roster, positionPlayers, currentPitcherId, inning, reason, onPick, onClose }: PitcherPickerProps) {
  const { language } = useLanguage()
  const es = language === 'es'
  const [q, setQ] = useState('')
  const [pool, setPool] = useState<'pitchers' | 'position'>('pitchers')

  const list = useMemo(() => {
    const isP = isPitcher
    const source = pool === 'pitchers' ? roster.filter(isPitcher) : (positionPlayers ?? roster.filter(p => !isPitcher(p)))
    const filtered = source.filter((p) => {
      if (!q.trim()) return true
      const s = `${p.first_name} ${p.last_name} ${p.jersey_number ?? ''}`.toLowerCase()
      return s.includes(q.trim().toLowerCase())
    })
    return filtered.sort((a, b) => Number(isP(b)) - Number(isP(a)) || (a.jersey_number ?? 999) - (b.jersey_number ?? 999))
  }, [roster, positionPlayers, pool, q])

  const title = reason === 'start' ? (es ? '¿Quién abre en la loma?' : 'Who is starting on the mound?') : es ? 'Cambio de pitcher' : 'Pitching change'
  const description = es
    ? `${teamName} · entrada ${inning}. Cada turno queda registrado contra este pitcher.`
    : `${teamName} · inning ${inning}. Every at-bat is recorded against this pitcher.`

  return (
    <Modal onClose={onClose} title={title} description={description} size="md" locked={reason === 'start'} closeOnBackdrop={false}>
      <div className="space-y-3">
        <div role="group" aria-label={es ? 'Tipo de lanzador' : 'Pitcher type'} className="flex flex-wrap gap-2">{(['pitchers', 'position'] as const).map(value => <button type="button" key={value} aria-pressed={pool === value} onClick={() => { setPool(value); setQ('') }} className={'min-h-11 rounded-lg border px-4 py-2 text-sm font-bold ' + (pool === value ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-slate-300 bg-white text-slate-800')}>{value === 'pitchers' ? 'Pitchers' : (es ? 'Jugadores de posición' : 'Position players')}</button>)}</div>
        {pool === 'position' && <p className="text-sm text-slate-600">{es ? 'El jugador quedará registrado como lanzador. Revisa también las posiciones defensivas y el bateador designado.' : 'The selected player will be recorded as the pitcher. Also review fielding positions and the designated hitter.'}</p>}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder={es ? 'Buscar por nombre o número' : 'Search by name or number'} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{es ? 'No hay jugadores disponibles en esta lista.' : 'No available players in this list.'}</p>
        ) : (
          <ul className="max-h-[55vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {list.map((p) => {
              const isP = isPitcher(p)
              const current = p.id === currentPitcherId
              const jersey = jerseyLabel(p.jersey_number, teamName)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    disabled={current}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-accent disabled:cursor-default disabled:bg-blue-50"
                  >
                    <MlbPortrait name={`${p.first_name} ${p.last_name}`} team={teamName} className="size-12" />
                    {jersey !== null && <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">{jersey}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {p.first_name} {p.last_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">{(p.positions ?? []).join(', ') || '—'}</span>
                    </span>
                    {isP && <Badge variant="primary">P</Badge>}
                    {current && <Badge variant="success">{es ? 'En la loma' : 'On the mound'}</Badge>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {reason === 'change' && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              {es ? 'Cancelar' : 'Cancel'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
