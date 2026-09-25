'use client'

import { useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { BASE_SHORT, EVENT_LABELS, eventIsOut, nextBase, type RunnerBase, type RunnerEventInput, type RunnerEventType, type ToBase } from '@/lib/runnerEvents'
import { Button, Modal } from '@/components/ui'

export interface RunnerOption {
  atBatId: string
  playerId?: string | null
  playerName: string
  notation?: string
  base: RunnerBase
}

interface RunnerPlayModalProps {
  runners: RunnerOption[]
  /** Preselect a runner (e.g. the box being edited) */
  initialRunnerId?: string | null
  /** Preselect the play (e.g. the recognized SB token) */
  initialType?: RunnerEventType | null
  /** Preselect where the runner ended (e.g. from a drawn base path) */
  initialToBase?: ToBase | null
  enteredVia: 'classic' | 'digital'
  onConfirm: (ev: RunnerEventInput) => void | Promise<void>
  onClose: () => void
}

const PLAYS: RunnerEventType[] = ['SB', 'CS', 'PK', 'WP', 'PB', 'BK']

/**
 * What happened to a runner during the at-bat: stolen base (with or without a
 * throw), caught stealing or pickoff (with the fielders involved), wild pitch,
 * passed ball or balk. One confirmation before anything is written.
 */
export default function RunnerPlayModal({ runners, initialRunnerId = null, initialType = null, initialToBase = null, enteredVia, onConfirm, onClose }: RunnerPlayModalProps) {
  const { language } = useLanguage()
  const es = language === 'es'
  const L = es
    ? {
        title: 'Jugada de corredor',
        who: '¿Qué corredor?',
        what: '¿Qué pasó?',
        where: 'Llega a',
        throwQ: '¿Hubo tiro?',
        withThrow: 'Con tiro',
        noThrow: 'Sin tiro',
        fielders: 'Posiciones que participaron (en orden)',
        clear: 'Borrar',
        confirm: 'Confirmar',
        cancel: 'Cancelar',
        summary: 'Resumen',
        out: 'OUT',
        safe: 'quieto en',
        on: 'en',
      }
    : {
        title: 'Runner play',
        who: 'Which runner?',
        what: 'What happened?',
        where: 'Reaches',
        throwQ: 'Was there a throw?',
        withThrow: 'With throw',
        noThrow: 'No throw',
        fielders: 'Positions involved (in order)',
        clear: 'Clear',
        confirm: 'Confirm',
        cancel: 'Cancel',
        summary: 'Summary',
        out: 'OUT',
        safe: 'stays at',
        on: 'on',
      }

  const [runnerId, setRunnerId] = useState<string | null>(initialRunnerId ?? (runners.length === 1 ? runners[0].atBatId : null))
  const [type, setType] = useState<RunnerEventType | null>(initialType)
  const [toBase, setToBase] = useState<ToBase | null>(initialToBase)
  const [throwFlag, setThrowFlag] = useState<boolean | null>(null)
  const [fielders, setFielders] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  const runner = runners.find((r) => r.atBatId === runnerId) ?? null
  const isOut = type ? eventIsOut(type) : false
  const destination: ToBase | null = runner ? (isOut ? null : toBase ?? nextBase(runner.base)) : null
  const advanceOptions: ToBase[] = runner ? (['second', 'third', 'home'] as ToBase[]).filter((b) => ['first', 'second', 'third', 'home'].indexOf(b) > ['first', 'second', 'third'].indexOf(runner.base)) : []
  const needsThrow = type === 'SB'
  const needsFielders = type === 'CS' || type === 'PK'
  const ready = !!runner && !!type && (!needsThrow || throwFlag !== null) && (!needsFielders || fielders.length > 0)

  const confirm = async () => {
    if (!runner || !type) return
    setSaving(true)
    await onConfirm({
      runnerAtBatId: runner.atBatId,
      runnerPlayerId: runner.playerId ?? null,
      runnerName: runner.playerName,
      type,
      fromBase: runner.base,
      toBase: isOut ? nextBase(runner.base) : destination ?? nextBase(runner.base),
      isOut,
      throw: needsThrow ? throwFlag : null,
      fielders: needsFielders && fielders.length ? fielders.join('-') : null,
      enteredVia,
    })
    setSaving(false)
  }

  const chip = (active: boolean, extra = '') =>
    'rounded-lg border px-3 py-2 text-sm font-bold transition-colors ' + (active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-slate-700 hover:bg-slate-100') + extra

  return (
    <Modal
      onClose={onClose}
      title={L.title}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {L.cancel}
          </Button>
          <Button onClick={confirm} loading={saving} disabled={!ready}>
            {L.confirm}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {runners.length > 1 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.who}</p>
            <div className="flex flex-wrap gap-2">
              {runners.map((r) => (
                <button key={r.atBatId} type="button" onClick={() => { setRunnerId(r.atBatId); setToBase(null) }} className={chip(r.atBatId === runnerId)}>
                  {r.playerName} · {BASE_SHORT[r.base]}
                </button>
              ))}
            </div>
          </div>
        )}
        {runner && (
          <>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.what}</p>
              <div className="flex flex-wrap gap-2">
                {PLAYS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setType(p); setThrowFlag(null); setFielders([]) }}
                    className={chip(type === p, eventIsOut(p) && type === p ? ' !border-red-600 !bg-red-600' : '')}
                  >
                    {p} · {EVENT_LABELS[p][es ? 'es' : 'en']}
                  </button>
                ))}
              </div>
            </div>

            {type && !isOut && advanceOptions.length > 1 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.where}</p>
                <div className="flex flex-wrap gap-2">
                  {advanceOptions.map((b) => (
                    <button key={b} type="button" onClick={() => setToBase(b)} className={chip(destination === b)}>
                      {BASE_SHORT[b]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {needsThrow && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.throwQ}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setThrowFlag(true)} className={chip(throwFlag === true)}>
                    {L.withThrow}
                  </button>
                  <button type="button" onClick={() => setThrowFlag(false)} className={chip(throwFlag === false)}>
                    {L.noThrow}
                  </button>
                </div>
              </div>
            )}

            {needsFielders && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.fielders}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button key={n} type="button" onClick={() => setFielders((f) => [...f, n])} className="size-10 rounded-lg border border-border bg-card text-sm font-bold hover:bg-slate-100">
                      {n}
                    </button>
                  ))}
                  <span className="min-w-[4rem] rounded-lg bg-slate-100 px-3 py-2 font-mono text-lg font-bold tabular-nums">{fielders.join('-') || '—'}</span>
                  <Button variant="ghost" size="sm" onClick={() => setFielders([])} disabled={fielders.length === 0}>
                    {L.clear}
                  </Button>
                </div>
              </div>
            )}

            {type && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <span className="font-semibold">{L.summary}: </span>
                {runner.playerName} · {EVENT_LABELS[type][es ? 'es' : 'en']}
                {type === 'SB' && throwFlag !== null ? ` (${throwFlag ? L.withThrow : L.noThrow})` : ''}
                {needsFielders && fielders.length ? ` ${fielders.join('-')}` : ''}
                {' · '}
                {isOut ? `${L.out} ${L.on} ${BASE_SHORT[runner.base]}` : `${BASE_SHORT[runner.base]} → ${BASE_SHORT[destination ?? nextBase(runner.base)]}`}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
