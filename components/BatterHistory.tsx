'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { battingLine, loadBatterHistory } from '@/lib/batterStats'
import SprayChart, { type SprayAtBat } from './SprayChart'

export interface BatterHistoryContext {
  gameId: string
  batterId: string
  pitcherId: string | null
  pitcherName: string
  gameLine: string
}

export default function BatterHistory({ context, lang }: { context: BatterHistoryContext; lang: 'en' | 'es' }) {
  const es = lang === 'es'
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<'game' | 'all'>('game')
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<{ key: string; rows: SprayAtBat[]; error: boolean } | null>(null)
  const gesture = useRef<{ y: number; dragged: boolean } | null>(null)
  const { gameId, batterId, pitcherId, pitcherName, gameLine } = context
  const key = `${gameId}:${batterId}:${pitcherId}:${scope}:${retry}`
  useEffect(() => {
    if (!open || !pitcherId) return
    let cancelled = false
    loadBatterHistory(supabase, batterId, pitcherId, scope === 'game' ? gameId : undefined)
      .then(rows => { if (!cancelled) setState({ key, rows, error: false }) })
      .catch(() => { if (!cancelled) setState({ key, rows: [], error: true }) })
    return () => { cancelled = true }
  }, [open, gameId, batterId, pitcherId, scope, key])
  const ready = state?.key === key
  return <div className="mt-1">
    <button type="button" aria-expanded={open} aria-controls="batter-pitcher-history"
      className="touch-none rounded-lg py-2 text-left text-sm text-white focus-visible:outline-2"
      onPointerDown={e => { gesture.current = { y: e.clientY, dragged: false }; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerMove={e => { if (gesture.current && e.clientY - gesture.current.y > 24) { gesture.current.dragged = true; setOpen(true) } }}
      onPointerCancel={() => { gesture.current = null }}
      onClick={() => { if (!gesture.current?.dragged) setOpen(v => !v); gesture.current = null }}>
      <span className="font-bold tabular-nums">{gameLine}</span> <span className="text-xs text-slate-300">{es ? 'en el juego · H-AB' : 'this game · H-AB'}</span>
      <span className="block text-xs text-slate-300">{es ? 'Arrastra abajo o toca: vs ' : 'Pull down or tap: vs '}{pitcherName || (es ? 'lanzador' : 'pitcher')} {open ? '▴' : '▾'}</span>
    </button>
    {open && <section id="batter-pitcher-history" aria-label={es ? 'Historial contra el lanzador' : 'History against pitcher'} className="max-h-[40dvh] overflow-y-auto overscroll-contain rounded-xl bg-white p-3 text-slate-900">
      <p className="mb-2 text-sm font-bold">vs {pitcherName || '—'}</p>
      <div className="flex gap-2">
        {(['game', 'all'] as const).map(value => <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)} className={'rounded-lg px-3 py-2 text-xs font-bold ' + (scope === value ? 'bg-emerald-800 text-white' : 'bg-slate-100')}>{value === 'game' ? (es ? 'Juego actual' : 'Current game') : (es ? 'Todos los juegos' : 'All games')}</button>)}
      </div>
      {!pitcherId ? <p className="py-3 text-sm">{es ? 'Selecciona un lanzador para ver el historial.' : 'Select a pitcher to see history.'}</p>
        : !ready ? <p role="status" className="py-3">{es ? 'Cargando…' : 'Loading…'}</p>
        : state.error ? <p role="alert" className="py-3">{es ? 'No se pudo cargar el historial.' : 'Could not load history.'} <button type="button" className="underline" onClick={() => setRetry(v => v + 1)}>{es ? 'Reintentar' : 'Retry'}</button></p>
        : <><p className="mt-3 text-sm font-bold">{battingLine(state.rows).label} H-AB · {state.rows.length} PA</p>
          {!state.rows.length ? <p className="py-3 text-sm">{es ? 'Sin turnos registrados contra este lanzador.' : 'No recorded appearances against this pitcher.'}</p>
            : <SprayChart atBats={state.rows} lang={lang} className="mx-auto max-w-xs" />}</>}
    </section>}
  </div>
}
