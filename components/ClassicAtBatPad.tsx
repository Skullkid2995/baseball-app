'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Eraser, PenTool, RotateCcw, Save, Undo2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { Badge, Button } from '@/components/ui'
import ScorecardBox from '@/components/ScorecardBox'
import { TOKENS, describeToken } from '@/lib/handwriting/vocabulary'
import { normalize, type Stroke, type Template } from '@/lib/handwriting/recognizer'
import { NO_BASES, OUT_TOKENS, basesForToken, interpretBox, type BaseRunners, type BoxAction } from '@/lib/scorecard/interpret'
import { landingData, type Pt } from '@/lib/scorecard/geometry'
import { cn } from '@/lib/utils'
import { matchupLine, type MatchupSummary } from '@/lib/matchup'
import RunnerPlayModal, { type RunnerOption } from './RunnerPlayModal'
import { RUNNER_TOKENS, runnerBaseOf, type RunnerEventInput, type RunnerEventType, type ToBase } from '@/lib/runnerEvents'
import { FIRST, SECOND, THIRD } from '@/lib/scorecard/geometry'

/**
 * Classic (paper) scoring dialog for one plate appearance. The box itself and
 * the interpretation of what was drawn live in ScorecardBox + lib/scorecard,
 * shared with the scorecard lab so tuning there applies here.
 */
export interface ClassicAtBatPadProps {
  playerName: string
  /** This batter's history against the pitcher on the mound */
  matchup?: MatchupSummary | null
  /** Runners on base from other boxes (for stolen bases, pickoffs...) */
  activeRunners?: RunnerOption[]
  onRunnerEvent?: (ev: RunnerEventInput) => Promise<void> | void
  inning: number
  existingAtBat?: Record<string, unknown>
  isLocked?: boolean
  onSave: (
    notation: string,
    baseRunners?: BaseRunners,
    fieldLocationData?: Record<string, unknown>,
    baseRunnerOuts?: BaseRunners,
    baseRunnerOutTypes?: { first: string; second: string; third: string; home: string },
    rbi?: number
  ) => void
  onClose: () => void
  onSwitchMode: () => void
}

/** Notation the scorebook already understands (see interpretHandwriting) */
function toScorebookNotation(token: string): string {
  if (token === 'Kc') return 'KC'
  const m = token.match(/^([FLP])([1-9])$/)
  if (m) return `${m[1]}-${m[2]}`
  return token
}

export default function ClassicAtBatPad({ playerName, inning, existingAtBat, isLocked = false, onSave, onClose, onSwitchMode, matchup = null, activeRunners = [], onRunnerEvent }: ClassicAtBatPadProps) {
  const { language } = useLanguage()
  const [actions, setActions] = useState<BoxAction[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [digitTemplates, setDigitTemplates] = useState<Template[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [fixing, setFixing] = useState(false)
  const [rbi, setRbi] = useState(0)
  const [outOverride, setOutOverride] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [runnerPlay, setRunnerPlay] = useState<{ type: RunnerEventType | null; toBase: ToBase | null } | null>(null)
  const [runnerDone, setRunnerDone] = useState<string | null>(null)

  const L = language === 'es'
    ? {
        title: 'Anotar turno', classic: 'Clásico', digital: 'Digital',
        hint: 'Escribe la jugada en la casilla. Marca las bases con una línea o un toque, el out con un círculo abajo a la derecha, marca las cajitas de bolas (B) y strikes (S) con un toque o una raya encima, y traza el batazo desde home.',
        recognized: 'Reconocido', nothing: 'Escribe la jugada…', noSamples: 'Sin muestras: elige la jugada de la lista.',
        correct: 'Correcto', fix: 'Corregir', redo: 'Repetir', pick: 'Elige la jugada', out: 'Out', run: 'Carrera',
        landing: 'Batazo', noLanding: 'sin trazo', rbiLabel: 'Carreras impulsadas', save: 'Guardar turno', close: 'Cerrar', undo: 'Deshacer', clear: 'Borrar',
        locked: 'Juego cerrado: solo lectura.', savedOk: 'Turno guardado',
        runnerPlay: 'Corredores', runnerRecognized: 'Jugada de corredor reconocida', confirmRunner: 'Confirmar', notThat: 'No', runnerSaved: 'Jugada de corredor guardada',
      }
    : {
        title: 'Score at-bat', classic: 'Classic', digital: 'Digital',
        hint: 'Write the play in the box. Mark bases with a line or a tap, the out with a circle in the lower right, mark the ball (B) and strike (S) boxes with a tap or a line over them, and draw the batted ball from home.',
        recognized: 'Recognized', nothing: 'Write the play…', noSamples: 'No samples yet: pick the play from the list.',
        correct: 'Correct', fix: 'Fix', redo: 'Redo', pick: 'Pick the play', out: 'Out', run: 'Run',
        landing: 'Batted ball', noLanding: 'no line', rbiLabel: 'Runs batted in', save: 'Save at-bat', close: 'Close', undo: 'Undo', clear: 'Clear',
        locked: 'Game locked: read only.', savedOk: 'At-bat saved',
        runnerPlay: 'Runners', runnerRecognized: 'Runner play recognized', confirmRunner: 'Confirm', notThat: 'No', runnerSaved: 'Runner play saved',
      }

  // Templates from the handwriting lab (notation set only)
  useEffect(() => {
    const allowed = new Set(TOKENS.map((t) => t.value))
    supabase
      .from('handwriting_samples')
      .select('symbol, strokes')
      .limit(5000)
      .then(({ data }) => {
        const rows = (data || []) as { symbol: string; strokes: Stroke[] }[]
        setTemplates(rows.filter((r) => allowed.has(r.symbol)).map((r) => ({ symbol: r.symbol, cloud: normalize(r.strokes) })))
        setDigitTemplates(rows.filter((r) => ['1', '2', '3'].includes(r.symbol)).map((r) => ({ symbol: r.symbol, cloud: normalize(r.strokes) })))
      })
  }, [])

  // Prefill when editing an existing at-bat
  useEffect(() => {
    if (!existingAtBat) return
    const notation = String(existingAtBat.notation || existingAtBat.result || '')
    if (notation && notation !== 'DRAWING_SAVED') setToken(notation)
    if (typeof existingAtBat.rbi === 'number') setRbi(existingAtBat.rbi)
  }, [existingAtBat])

  const interpretation = useMemo(() => interpretBox(actions, templates, digitTemplates), [actions, templates, digitTemplates])
  const { marks, tokenMatches } = interpretation
  const top = tokenMatches[0]
  const hasInk = marks.ink.length > 0

  // Ink changed after a confirmation: ask again
  const inkCount = marks.ink.length
  useEffect(() => {
    setToken((t) => (t && !existingAtBat ? null : t))
    setFixing(false)
  }, [inkCount, existingAtBat])

  const effectiveBases = token ? basesForToken(token, marks.bases) : marks.bases
  const effectiveOut = outOverride ?? (marks.outNumber || (token && OUT_TOKENS.has(token) ? 1 : 0))
  const landing = marks.hitLine ? landingData(marks.hitLine[marks.hitLine.length - 1] as Pt) : undefined
  const canSave = !!token && !isLocked && !saved

  // Runner plays: this box's own runner (when editing a box whose batter is on base) plus the other runners
  const selfBase = existingAtBat ? runnerBaseOf(existingAtBat as { base_runners?: BaseRunners | null; base_runner_outs?: BaseRunners | null }) : null
  const runnerOptions: RunnerOption[] = [
    ...(existingAtBat && selfBase ? [{ atBatId: String(existingAtBat.id), playerId: (existingAtBat.player_id as string) ?? null, playerName, base: selfBase }] : []),
    ...activeRunners,
  ]
  const canRunnerPlay = !!onRunnerEvent && !isLocked && runnerOptions.length > 0
  // "SB" (or CS / PK / WP / PB / BK) written in the box: offer it as a runner play instead of a batting result
  const inkRunnerToken = canRunnerPlay && hasInk && top && RUNNER_TOKENS.has(top.symbol) ? (top.symbol as RunnerEventType) : null
  // The drawn base path says where the runner ended up
  const drawnTo: ToBase | null = marks.bases.home ? 'home' : marks.bases.third ? 'third' : marks.bases.second ? 'second' : null

  function save() {
    if (!token) return
    const runners: BaseRunners = effectiveBases.home ? { first: false, second: false, third: false, home: true } : effectiveBases
    onSave(toScorebookNotation(token), runners, landing ? { ...landing } : undefined, { ...NO_BASES }, { first: '', second: '', third: '', home: '' }, rbi)
    setSaved(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:p-6">
      {runnerPlay && (
        <RunnerPlayModal
          runners={runnerOptions}
          initialRunnerId={existingAtBat && selfBase ? String(existingAtBat.id) : null}
          initialType={runnerPlay.type}
          initialToBase={runnerPlay.toBase}
          enteredVia="classic"
          onConfirm={async (ev) => {
            await onRunnerEvent?.(ev)
            setRunnerDone(`${ev.runnerName} · ${ev.type}`)
            setRunnerPlay(null)
            setActions(actions.filter((a) => a.type === 'tap'))
          }}
          onClose={() => setRunnerPlay(null)}
        />
      )}
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-tight">{L.title} · {playerName} <span className="text-muted-foreground">({language === 'es' ? 'Entrada' : 'Inning'} {inning})</span></h3>
            {matchup && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">vs {matchup.pitcherName}</span> · {matchupLine(matchup, language === 'es' ? 'es' : 'en')}
              </p>
            )}
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{L.hint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="inline-flex items-center rounded-lg bg-secondary p-0.5">
              <button type="button" aria-pressed className="rounded-md bg-card px-3 py-1 text-xs font-semibold shadow-sm">{L.classic}</button>
              <button type="button" onClick={onSwitchMode} className="rounded-md px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">{L.digital}</button>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={L.close}><X /></Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-6">
          <div className="space-y-2">
            <div className="relative">
              <ScorecardBox actions={actions} onChange={setActions} marks={marks} disabled={isLocked || saved} />
              {/* Runners on base from the other boxes: who is where */}
              {activeRunners.length > 0 && (
                <div className="pointer-events-none absolute inset-0">
                  {activeRunners.map((r) => {
                    const at = r.base === 'first' ? FIRST : r.base === 'second' ? SECOND : THIRD
                    const parts = r.playerName.trim().split(/\s+/)
                    const short = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
                    return (
                      <div key={r.atBatId} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${at[0]}%`, top: `${at[1]}%` }}>
                        <span className="size-4 rounded-full border-2 border-white bg-blue-800 shadow" />
                        <span className="mt-0.5 whitespace-nowrap rounded bg-blue-800/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow">{short}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={actions.length === 0} onClick={() => setActions(actions.slice(0, -1))}><Undo2 />{L.undo}</Button>
                <Button variant="outline" size="sm" onClick={() => { setActions([]); setToken(null); setOutOverride(null) }}><Eraser />{L.clear}</Button>
                {canRunnerPlay && (
                  <Button variant="warning" size="sm" onClick={() => setRunnerPlay({ type: null, toBase: null })}>{L.runnerPlay}</Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant={effectiveBases.home ? 'success' : 'outline'}>{L.run}{effectiveBases.home ? ' ✓' : ''}</Badge>
                <button type="button" onClick={() => setOutOverride((effectiveOut + 1) % 4)} title={L.out}>
                  <Badge variant={effectiveOut ? 'danger' : 'outline'}>{L.out} {effectiveOut || '–'}</Badge>
                </button>
                <Badge variant={marks.hitLine ? 'warning' : 'outline'}>{L.landing}: {landing ? landing.fieldZone.toLowerCase().replace(/_/g, ' ') : L.noLanding}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {isLocked && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{L.locked}</div>}
            <div className="rounded-xl border border-border bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.recognized}</p>
              {token ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold tabular-nums">{token}</span>
                  <span className="text-sm text-muted-foreground">{describeToken(token, language)}</span>
                  <Check className="size-5 text-emerald-600" />
                </div>
              ) : !hasInk ? (
                <p className="text-sm text-muted-foreground">{L.nothing}</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{L.noSamples}</p>
              ) : tokenMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold tabular-nums">{top.symbol}</span>
                    <span className="text-sm text-muted-foreground">{describeToken(top.symbol, language)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tokenMatches.map((m, i) => (
                      <Badge key={m.symbol} variant={i === 0 ? (m.score > 0.7 ? 'success' : 'warning') : 'outline'}>{m.symbol} · {Math.round(m.score * 100)}%</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {inkRunnerToken && !runnerDone && (
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{L.runnerRecognized}</p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-4xl font-bold">{inkRunnerToken}</span>
                  <span className="text-sm text-amber-900">{describeToken(inkRunnerToken, language)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="success" onClick={() => setRunnerPlay({ type: inkRunnerToken, toBase: drawnTo })}><Check />{L.confirmRunner}</Button>
                  <Button variant="ghost" onClick={() => setActions(actions.filter((a) => a.type === 'tap'))}>{L.notThat}</Button>
                </div>
              </div>
            )}
            {runnerDone && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{L.runnerSaved}: {runnerDone}</div>}

            {!token && hasInk && !fixing && (
              <div className="flex flex-wrap gap-2">
                <Button variant="success" size="lg" disabled={!top} onClick={() => top && setToken(top.symbol)}><Check />{L.correct}</Button>
                <Button variant="outline" size="lg" onClick={() => setFixing(true)}><PenTool />{L.fix}</Button>
                <Button variant="ghost" size="lg" onClick={() => setActions(actions.filter((a) => a.type === 'tap'))}><RotateCcw />{L.redo}</Button>
              </div>
            )}

            {(fixing || (!token && (!hasInk || templates.length === 0))) && (
              <div>
                <p className="mb-2 text-sm font-medium">{L.pick}</p>
                <div className="flex flex-wrap gap-1.5">
                  {TOKENS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      title={t[language]}
                      onClick={() => { setToken(t.value); setFixing(false) }}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:border-primary hover:bg-accent"
                    >
                      {t.value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {token && (
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.rbiLabel}</p>
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" onClick={() => setRbi(n)} aria-pressed={rbi === n}
                        className={cn('size-9 rounded-lg border text-sm font-semibold', rbi === n ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-slate-50')}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setToken(null); setFixing(true) }}><PenTool />{L.fix}</Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-slate-50/80 px-4 py-3 sm:px-6">
          {saved ? <Badge variant="success"><Check /> {L.savedOk}</Badge> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{L.close}</Button>
            <Button variant="success" size="lg" onClick={save} disabled={!canSave}><Save />{L.save}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
