'use client'

import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import type { ChangeKind, LineupPlayer } from '@/lib/scorecard/substitutions'

export default function PlayerChangeModal({ kind, lineup, roster, initialOutId, language, onSave, onClose }: {
  kind: ChangeKind; lineup: LineupPlayer[]; roster: LineupPlayer[]; initialOutId?: string
  language: 'en' | 'es'; onSave: (outId: string, inId: string, position: string) => Promise<void>; onClose: () => void
}) {
  const es = language === 'es'
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
  const name = (p: LineupPlayer) => `#${p.jersey_number ?? '–'} ${p.first_name} ${p.last_name}`
  return <Modal title={title} onClose={() => { if (!busy) onClose() }} locked={busy} size="sm">
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); if (busy) return
      setBusy(true); setError('')
      try { await onSave(outId, kind === 'position' ? outId : inId, selectedPosition); onClose() }
      catch (e) { setError(e instanceof Error ? e.message : t('No se pudo guardar.', 'Could not save.')) }
      finally { setBusy(false) }
    }}>
      {kind !== 'position' && <label className="block text-sm font-semibold">{t('Jugador que entra', 'Incoming player')}
        <select required disabled={busy} value={inId} onChange={e => setInId(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border p-2">
          <option value="">{t('Seleccionar jugador', 'Select player')}</option>{roster.map(p => <option key={p.id} value={p.id}>{name(p)}</option>)}
        </select>
        {!roster.length && <p className="mt-2 text-sm">{t('No hay suplentes disponibles en la plantilla.', 'No available substitutes on this roster.')}</p>}
      </label>}
      <label className="block text-sm font-semibold">{kind === 'position' ? t('Jugador', 'Player') : t('Jugador que sale', 'Player being replaced')}
        <select required disabled={busy} value={outId} onChange={e => { setOutId(e.target.value); setPosition('') }} className="mt-1 min-h-12 w-full rounded-lg border p-2">
          {lineup.map(p => <option key={p.id} value={p.id}>{name(p)} · {p.positions?.[0]}</option>)}
        </select>
      </label>
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
