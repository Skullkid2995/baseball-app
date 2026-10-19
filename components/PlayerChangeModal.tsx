'use client'

import { useId, useState } from 'react'
import { Button, Modal } from '@/components/ui'
import type { ChangeKind, LineupPlayer } from '@/lib/scorecard/substitutions'
import { jerseyLabel, MlbPortrait } from './MlbIdentity'

export default function PlayerChangeModal({ kind, lineup, roster, initialOutId, language, onSave, onClose, teamName }: {
  kind: ChangeKind; lineup: LineupPlayer[]; roster: LineupPlayer[]; initialOutId?: string
  language: 'en' | 'es'; onSave: (outId: string, inId: string, position: string) => Promise<void>; onClose: () => void
  teamName: string
}) {
  const es = language === 'es'
  const groupId = useId()
  const t = (a: string, b: string) => es ? a : b
  const [outId, setOutId] = useState(initialOutId || lineup[0]?.id || '')
  const [inId, setInId] = useState('')
  const [position, setPosition] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const outgoing = lineup.find(p => p.id === outId)
  const selectedPosition = position || outgoing?.positions?.[0] || 'DH'
  const title = kind === 'pinch_hitter' ? t('Cambiar bateador / emergente', 'Change batter / pinch hitter')
    : kind === 'pinch_runner' ? t('Corredor emergente', 'Pinch runner')
    : kind === 'position' ? t('Cambiar posición', 'Change fielding position') : t('Cambio defensivo', 'Defensive replacement')
  const name = (p: LineupPlayer) => `${jerseyLabel(p.jersey_number, teamName) === null ? '' : `#${p.jersey_number} `}${p.first_name} ${p.last_name}`
  function choices(label: string, people: LineupPlayer[], selected: string, onChange: (id: string) => void, group: string) {
    return <fieldset disabled={busy} className="space-y-2"><legend className="text-sm font-semibold">{label}</legend><div className="max-h-[32dvh] overflow-y-auto rounded-lg border border-slate-200">
      {people.map(p => <label key={p.id} className={'flex min-h-16 cursor-pointer items-center gap-3 border-b border-slate-200 p-3 last:border-0 ' + (selected === p.id ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50')}>
        <input type="radio" required name={`${groupId}-${group}`} value={p.id} checked={selected === p.id} onChange={() => onChange(p.id)} className="size-4 shrink-0 accent-emerald-700" />
        <MlbPortrait name={`${p.first_name} ${p.last_name}`} team={teamName} className="size-12" />
        <span className="min-w-0 text-sm"><span className="block font-semibold">{name(p)}</span><span className="block text-xs text-slate-500">{p.positions?.join(', ') || '—'}</span></span>
      </label>)}
    </div></fieldset>
  }
  return <Modal title={title} onClose={() => { if (!busy) onClose() }} locked={busy} size="sm">
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); if (busy) return
      setBusy(true); setError('')
      try { await onSave(outId, kind === 'position' ? outId : inId, selectedPosition); onClose() }
      catch (e) { setError(e instanceof Error ? e.message : t('No se pudo guardar.', 'Could not save.')) }
      finally { setBusy(false) }
    }}>
      {kind !== 'position' && <div>
        {choices(t('Jugador que entra', 'Incoming player'), roster, inId, setInId, 'in')}
        {!roster.length && <p className="mt-2 text-sm">{t('No hay suplentes disponibles en la plantilla.', 'No available substitutes on this roster.')}</p>}
      </div>}
      {choices(kind === 'position' ? t('Jugador', 'Player') : t('Jugador que sale', 'Player being replaced'), lineup, outId, id => { setOutId(id); setPosition('') }, 'out')}
      {(kind === 'position' || kind === 'defensive') && <label className="block text-sm font-semibold">{t('Posición defensiva', 'Fielding position')}
        <select value={selectedPosition} disabled={busy} onChange={e => setPosition(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border p-2">
          {['P','C','1B','2B','3B','SS','LF','CF','RF','DH'].map(p => <option key={p}>{p}</option>)}
        </select>
        {kind === 'position' && <p className="mt-2 text-xs font-normal">{t('Si la posición está ocupada, los jugadores intercambian posiciones.', 'If the position is occupied, the two players swap positions.')}</p>}
      </label>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || !outId || (kind !== 'position' && !inId)}>{busy ? t('Guardando…', 'Saving…') : t('Confirmar cambio', 'Confirm change')}</Button>
    </form>
  </Modal>
}
