'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { eligibleReserves, readReserves, type Reserves, type ReserveSide } from '@/lib/scorecard/reserves'
import { useLanguage } from '@/contexts/LanguageContext'
import { MlbPortrait } from './MlbIdentity'
import type { RosterPlayer } from './PitcherPicker'

export interface ReserveDraft { side: ReserveSide; selection: Reserves; ready: boolean }
export default function ReserveSelection({ gameId, side, teamName, roster, starters, onChange }: {
  gameId: string; side: ReserveSide; teamName: string; roster: RosterPlayer[]; starters: string[]; onChange: (value: ReserveDraft) => void
}) {
  const { language } = useLanguage(), es = language === 'es'
  const [selected, setSelected] = useState<Reserves | null>(null), [ready, setReady] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setReady(false); setError('')
    supabase.from('games').select('roster_reserves').eq('id', gameId).single().then(({ data, error }) => {
      if (!active) return
      if (error) setError('No se pudo cargar la banca / Could not load reserves.')
      else { setSelected(readReserves(data.roster_reserves, side)); setReady(true) }
    })
    return () => { active = false }
  }, [gameId, side, retry])
  const selection = eligibleReserves(roster, starters, selected)
  const serialized = JSON.stringify(selection)
  useEffect(() => { onChange({ side, selection: JSON.parse(serialized), ready }) }, [side, serialized, ready, onChange])
  function setRole(id: string, role: string) {
    setSelected({ bench: [...selection.bench.filter(x => x !== id), ...(role === 'bench' ? [id] : [])], bullpen: [...selection.bullpen.filter(x => x !== id), ...(role === 'bullpen' ? [id] : [])] })
  }
  return <section className="space-y-3 rounded-xl border border-slate-300 bg-white p-4"><h3 className="font-bold">{es ? 'Banca y bullpen para este juego' : 'Bench and bullpen for this game'}</h3><p className="text-sm text-slate-600">{es ? 'Elige quién estará disponible para los cambios. Los titulares y el abridor se excluyen automáticamente.' : 'Choose players available for substitutions. Starters and the starting pitcher are excluded automatically.'}</p>
    <p className="text-sm font-semibold">{es ? 'Banca' : 'Bench'}: {selection.bench.length} · Bullpen: {selection.bullpen.length}</p>
    {error ? <p role="alert">{error} <button type="button" className="min-h-11 underline" onClick={() => setRetry(v => v + 1)}>{es ? 'Reintentar' : 'Retry'}</button></p> : !ready ? <p role="status">{es ? 'Cargando banca…' : 'Loading reserves…'}</p> : <div className="max-h-80 divide-y overflow-y-auto">
      {roster.filter(p => !starters.includes(p.id)).map(p => <div key={p.id} className="flex flex-wrap items-center gap-3 py-2"><MlbPortrait name={`${p.first_name} ${p.last_name}`} team={teamName} className="size-12" /><div className="min-w-0 flex-1 text-sm"><strong>{p.first_name} {p.last_name}</strong><p className="text-xs text-slate-500">{p.positions?.join(', ')}</p></div><select aria-label={`${es ? 'Disponibilidad de' : 'Availability for'} ${p.first_name} ${p.last_name}`} value={selection.bench.includes(p.id) ? 'bench' : selection.bullpen.includes(p.id) ? 'bullpen' : ''} onChange={e => setRole(p.id, e.target.value)} className="min-h-11 rounded border border-slate-300 px-2 text-sm"><option value="">{es ? 'No disponible' : 'Unavailable'}</option><option value="bench">{es ? 'Banca' : 'Bench'}</option><option value="bullpen">Bullpen</option></select></div>)}
      {!roster.some(p => !starters.includes(p.id)) && <p className="py-3 text-sm">{es ? 'Agrega suplentes a la plantilla del equipo para elegirlos aquí.' : 'Add substitutes to the team roster to select them here.'}</p>}
    </div>}
  </section>
}
