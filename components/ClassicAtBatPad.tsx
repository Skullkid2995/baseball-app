'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Eraser, Save, Undo2, X, Swords } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { Button } from '@/components/ui'
import ScorecardField from './ScorecardField'
import PlayPicker from './PlayPicker'
import HandwritingConfirmation from './HandwritingConfirmation'
import NotationGuide from './NotationGuide'
import { normalize, type Stroke, type Template } from '@/lib/handwriting/recognizer'
import { interpretBox, type BaseRunners, type BoxAction } from '@/lib/scorecard/interpret'
import { useScorecardInterpretation } from '@/lib/scorecard/useScorecardInterpretation'
import { landingData, type Pt } from '@/lib/scorecard/geometry'
import { emptyBases, playBases, scoringPlay } from '@/lib/scorecard/plays'
import { BASE_SHORT, defaultRunnerMoves, runnerUpdateFor, thirdOutCancelsRuns, type RunnerMove, type RunnerUpdate } from '@/lib/scorecard/runners'
import { matchupLine, type MatchupSummary } from '@/lib/matchup'
import RunnerPlayModal, { type RunnerOption } from './RunnerPlayModal'
import { RUNNER_TOKENS, runnerBaseOf, type RunnerEventInput, type RunnerEventType } from '@/lib/runnerEvents'

export interface ClassicAtBatPadProps {
  playerName: string; matchup?: MatchupSummary | null; activeRunners?: RunnerOption[]
  onRunnerEvent?: (ev: RunnerEventInput) => Promise<void> | void
  inning: number; outsBefore?: number; existingAtBat?: Record<string, unknown>; isLocked?: boolean
  onSave: (notation: string, bases?: BaseRunners, location?: Record<string, unknown>, outs?: BaseRunners,
    outTypes?: { first: string; second: string; third: string; home: string }, rbi?: number, runnerUpdates?: RunnerUpdate[]) => Promise<void> | void
  onClose: () => void
}

export default function ClassicAtBatPad({ playerName, inning, outsBefore = 0, existingAtBat, isLocked = false, onSave, onClose, matchup = null, activeRunners = [], onRunnerEvent }: ClassicAtBatPadProps) {
  const { language } = useLanguage()
  const es = language === 'es'
  const t = (spanish: string, english: string) => es ? spanish : english
  const [actions, setActions] = useState<BoxAction[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [token, setToken] = useState(String(existingAtBat?.notation || existingAtBat?.result || ''))
  const [rbi, setRbi] = useState(Number(existingAtBat?.rbi || 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editedResult, setEditedResult] = useState(false)
  const [runnerOut, setRunnerOut] = useState(Object.values((existingAtBat?.base_runner_outs || {}) as object).some(Boolean))
  const [moves, setMoves] = useState<Record<string, RunnerMove>>({})
  const [runnerPlay, setRunnerPlay] = useState<{ type: RunnerEventType | null } | null>(null)
  const [runnerDone, setRunnerDone] = useState('')
  const play = scoringPlay(token)
  const locked = isLocked || saving
  const { marks, tokenMatches, waiting, onDrawingChange } = useScorecardInterpretation(actions, templates)
  const drawnBases = Object.values(marks.bases).some(Boolean)
  const previousBases = existingAtBat?.base_runners as BaseRunners | undefined
  const bases = play?.outs ? emptyBases() : drawnBases ? marks.bases : !editedResult && previousBases ? previousBases : play ? playBases(play) : emptyBases()
  const isOut = !!play?.outs || runnerOut || marks.outNumber > 0
  const outNumber = isOut ? Math.min(3, outsBefore + 1) : 0
  const landing = marks.hitLine ? landingData(marks.hitLine[marks.hitLine.length - 1] as Pt) : undefined
  const selfBase = existingAtBat ? runnerBaseOf(existingAtBat as { base_runners?: BaseRunners; base_runner_outs?: BaseRunners }) : null
  const runnerOptions: RunnerOption[] = [
    ...(existingAtBat && selfBase ? [{ atBatId: String(existingAtBat.id), playerId: String(existingAtBat.player_id), playerName, base: selfBase }] : []), ...activeRunners,
  ]

  useEffect(() => {
    let live = true
    supabase.from('handwriting_samples').select('symbol, strokes').limit(5000).then(({ data }) => {
      if (live) setTemplates((data || []).map((r: { symbol: string; strokes: Stroke[] }) => ({ symbol: r.symbol, cloud: normalize(r.strokes) })))
    })
    return () => { live = false }
  }, [])

  function choose(code: string) {
    setToken(code); setEditedResult(true); setRunnerOut(false); setError('')
    const next = defaultRunnerMoves(code, activeRunners)
    const p = scoringPlay(code)
    if (p?.outs && outsBefore + p.outs >= 3) for (const r of activeRunners) if (next[r.atBatId] === 'home') next[r.atBatId] = 'stay'
    setMoves(next)
    setRbi(p?.result === 'error' || (p?.outs || 0) > 1 ? 0 : Object.values(next).filter(m => m === 'home').length + (p?.base === 4 ? 1 : 0))
  }

  function editActions(next: BoxAction[]) {
    if (JSON.stringify(interpretBox(next, []).marks.ink) !== JSON.stringify(interpretBox(actions, []).marks.ink)) {
      setToken(''); setEditedResult(true)
    }
    setActions(next); setError('')
  }

  async function save() {
    if (!play || locked || waiting) return
    setSaving(true); setError('')
    try {
      const updates = activeRunners.map(r => runnerUpdateFor(r, moves[r.atBatId] || 'stay', play.code))
      const outsOnPlay = (isOut ? 1 : 0) + updates.filter(u => u.move === 'out').length
      if (outsBefore + outsOnPlay > 3) throw new Error(t('La jugada supera los tres outs.', 'This play exceeds three outs.'))
      if (play.outs > 1 && outsOnPlay !== play.outs) throw new Error(t('Selecciona los corredores que quedaron out.', 'Select the runners retired on this play.'))
      const destinations = updates.filter(u => !['out', 'home'].includes(u.move)).map(u => u.move === 'stay' ? activeRunners.find(r => r.atBatId === u.atBatId)!.base : u.move)
      if (!isOut && !bases.home) destinations.push(bases.third ? 'third' : bases.second ? 'second' : 'first')
      if (new Set(destinations).size !== destinations.length) throw new Error(t('Dos corredores no pueden ocupar la misma base.', 'Two runners cannot occupy the same base.'))
      const outs = emptyBases()
      if (isOut) outs[bases.third ? 'third' : bases.second ? 'second' : 'first'] = true
      if (thirdOutCancelsRuns(outsBefore, isOut, play.outs > 0, updates) && (updates.some(u => u.move === 'home') || (!isOut && bases.home))) throw new Error(t('No anota carrera cuando el tercer out es forzado o del bateador antes de primera. Corrige los corredores.', 'No run scores on a third force out or a third out on the batter before first. Correct the runners.'))
      const scoringRunners = updates.filter(u => u.move === 'home').length + (!isOut && bases.home ? 1 : 0)
      if (rbi > scoringRunners && (!existingAtBat || editedResult)) throw new Error(t('Las impulsadas no pueden superar las carreras de la jugada.', 'RBI cannot exceed the runs scored on this play.'))
      const finalBases = isOut ? { ...bases, home: false } : bases
      await onSave(token, finalBases, landing ? { ...landing } : undefined, outs, { first: isOut ? 'OUT' : '', second: '', third: '', home: '' }, rbi, updates)
    } catch (e) { setError(e instanceof Error ? e.message : t('No se pudo guardar.', 'Could not save.')) }
    finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="at-bat-title">
    {runnerPlay && <RunnerPlayModal runners={runnerOptions} initialType={runnerPlay.type} enteredVia="classic" onConfirm={async ev => {
      await onRunnerEvent?.(ev); setRunnerDone(ev.runnerName + ' · ' + ev.type); setRunnerPlay(null)
    }} onClose={() => setRunnerPlay(null)} />}
    <div className="flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
      <header className="relative shrink-0 overflow-hidden bg-slate-950 px-4 py-4 text-white sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400"><Swords className="size-4" />{t('Duelo en el plato', 'At the plate')} · {t('Entrada', 'Inning')} {inning}</p>
            <h3 id="at-bat-title" className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{playerName}</h3>
            {matchup && <p className="mt-1 text-xs text-slate-300">vs {matchup.pitcherName} · {matchupLine(matchup, language)}</p>}
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label={t('Cerrar', 'Close')} className="rounded-lg bg-white/10 p-2 hover:bg-white/20"><X className="size-5" /></button>
        </div>
        <div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold"><span className="text-slate-400">OUTS</span>{[1,2,3].map(n => <span key={n} className={'size-2.5 rounded-full ' + (n <= outsBefore ? 'bg-rose-400' : 'bg-slate-700')} />)}</div><span className="text-xs font-semibold text-slate-300">{t('Escribe o toca una opción', 'Write or tap a result')}</span></div>
      </header>
      <div className="grid min-h-0 flex-1 overscroll-contain gap-5 overflow-y-auto p-4 md:grid-cols-2 sm:p-6">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">01 · {t('Traza la jugada', 'Draw the play')}</p>
          <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><ScorecardField actions={actions} onChange={editActions} onDrawingChange={onDrawingChange} marks={{ ...marks, bases, outNumber }} notation={play ? token : undefined} disabled={locked} runners={runnerOptions} language={language} /></div>
          {play && <NotationGuide notation={token} language={language} />}
          <HandwritingConfirmation matches={tokenMatches} ink={marks.ink} value={token} onConfirm={choose} waiting={waiting} language={language} disabled={locked} />
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={locked || !actions.length} onClick={() => editActions(actions.slice(0,-1))}><Undo2 />{t('Deshacer', 'Undo')}</Button><Button variant="outline" size="sm" disabled={locked} onClick={() => { setActions([]); setToken(''); setRunnerOut(false); setEditedResult(true); setMoves({}); setRbi(0) }}><Eraser />{t('Borrar', 'Clear')}</Button></div>
          <p className="text-xs leading-relaxed text-slate-500">{t('Bolas, strikes, bases y dirección del batazo se marcan al instante.', 'Balls, strikes, bases and hit direction update immediately.')}</p>
          {runnerOptions.length > 0 && onRunnerEvent && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950"><p className="mb-2 text-xs font-bold">{t('Jugada entre lanzamientos', 'Between pitches')}</p><div className="flex flex-wrap gap-2">{[...RUNNER_TOKENS].map(code => <button key={code} disabled={locked} type="button" onClick={() => setRunnerPlay({ type: code as RunnerEventType })} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold">{code}</button>)}</div><p className="mt-2 text-xs">{t('Robo, out robando, pickoff, wild pitch, passed ball y balk.', 'Steal, caught stealing, pickoff, wild pitch, passed ball and balk.')}</p></div>}
          {runnerDone && <p role="status" className="text-sm font-semibold text-emerald-700">✓ {runnerDone}</p>}
        </div>
        <div className="space-y-4"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('O elige el resultado aquí', 'Or choose your result here')}</p>
          <PlayPicker value={token} onChange={choose} language={language} disabled={locked} outs={outsBefore} runners={activeRunners.length} />
          {play && <div className={'rounded-xl border-l-4 p-4 ' + (isOut ? 'border-rose-500 bg-rose-50 text-rose-950' : 'border-emerald-500 bg-emerald-50 text-emerald-950')} role="status"><span className="text-2xl font-black">{token.toUpperCase()}</span><span className="ml-3 text-sm font-semibold">{play[language]}</span><p className="mt-1 text-xs font-bold uppercase tracking-wider">{isOut ? t('Bateador out', 'Batter out') : t('Bateador a salvo', 'Batter safe')}</p></div>}
          {play && play.outs === 0 && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={runnerOut} disabled={locked} onChange={e => setRunnerOut(e.target.checked)} />{t('Out intentando avanzar después de llegar a base', 'Out advancing after reaching base')}</label>}
          {play && activeRunners.length > 0 && <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-bold uppercase text-slate-500">03 · {t('Corredores en esta jugada', 'Runners on this play')}</p>{activeRunners.map(r => <label key={r.atBatId} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{r.playerName} <span className="text-slate-400">{BASE_SHORT[r.base]}</span></span><select aria-label={r.playerName + ' ' + t('destino', 'destination')} disabled={locked} value={moves[r.atBatId] || 'stay'} onChange={e => { const next = { ...moves, [r.atBatId]: e.target.value as RunnerMove }; setMoves(next); setRbi(play.result === 'error' || play.outs > 1 ? 0 : Object.values(next).filter(m => m === 'home').length + (!isOut && bases.home ? 1 : 0)) }} className="min-h-10 rounded-lg border border-slate-300 px-2"><option value="stay">{t('Se queda', 'Holds')}</option>{r.base === 'first' && <option value="second">2B</option>}{r.base !== 'third' && <option value="third">3B</option>}<option value="home">{t('Anota', 'Scores')}</option><option value="out">OUT</option></select></label>)}</div>}
          {play && <label className="flex items-center justify-between text-sm font-semibold text-slate-700">{t('Carreras impulsadas', 'Runs batted in')}<select aria-label="RBI" disabled={locked} value={rbi} onChange={e => setRbi(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white p-2">{[0,1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label>}
        </div>
      </div>
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {error && <p role="alert" className="mb-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 text-sm text-slate-700" aria-live="polite">{isLocked ? t('Juego cerrado · Solo lectura', 'Game locked · Read only')
            : waiting ? t('Termina el trazo y confirma el resultado bajo el campo.', 'Finish writing, then confirm the result below the field.')
            : play ? <><span className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 className="size-4 shrink-0" />{token.toUpperCase()} · {t('Confirmado', 'Confirmed')}</span><span className="text-xs">{t('Revisa los corredores e impulsadas. Luego guarda.', 'Review runners and RBI. Then save.')}</span></>
            : t('Primero, toca «Confirmar» bajo el campo o elige un resultado.', 'First, tap “Confirm” below the field or choose a result.')}</div>
          <Button variant="success" size="lg" className="min-h-14 w-full shrink-0 whitespace-normal text-lg font-black shadow-lg sm:w-auto sm:min-w-60 [&_svg]:size-5" onClick={() => void save()} disabled={locked || !play || waiting}><Save />{saving ? t('Guardando…', 'Saving…') : t('2 · Guardar jugada', '2 · Save play')}</Button>
        </div>
      </footer>
    </div>
  </div>
}
