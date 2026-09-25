'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Eraser, Save, Undo2, X, Swords } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { Button } from '@/components/ui'
import ScorecardField from './ScorecardField'
import { usePaperDraft } from '@/lib/scorecard/usePaperDraft'
import type { PaperBox } from '@/lib/scorecard/paperDraft'
import { confidentNotation } from '@/lib/scorecard/paperRecognition'
import BatterHistory, { type BatterHistoryContext } from './BatterHistory'
import RunnerScorecardBox from './RunnerScorecardBox'
import { runnerDrawing, drawnRunnerUpdate } from '@/lib/scorecard/runnerDrawing'
import PlayPicker from './PlayPicker'
import HandwritingConfirmation from './HandwritingConfirmation'
import NotationGuide from './NotationGuide'
import { useTrainingSamples } from '@/lib/handwriting/useTrainingSamples'
import { interpretBox, type BaseRunners, type BoxAction } from '@/lib/scorecard/interpret'
import { useScorecardInterpretation } from '@/lib/scorecard/useScorecardInterpretation'
import { landingData, type Pt } from '@/lib/scorecard/geometry'
import { emptyBases, playBases, scoringPlay } from '@/lib/scorecard/plays'
import { inningEndsOnPlay, runnerUpdateFor, thirdOutCancelsRuns, type RunnerUpdate } from '@/lib/scorecard/runners'
import { matchupLine, type MatchupSummary } from '@/lib/matchup'
import RunnerPlayModal, { type RunnerOption } from './RunnerPlayModal'
import { RUNNER_TOKENS, runnerBaseOf, type RunnerEventInput, type RunnerEventType } from '@/lib/runnerEvents'

export interface ClassicAtBatPadProps {
  embedded?: boolean; paperBox?: PaperBox
  batterHistory?: BatterHistoryContext
  playerName: string; matchup?: MatchupSummary | null; activeRunners?: RunnerOption[]
  onRunnerEvent?: (ev: RunnerEventInput) => Promise<void> | void
  inning: number; outsBefore?: number; existingAtBat?: Record<string, unknown>; isLocked?: boolean
  onSave: (notation: string, bases?: BaseRunners, location?: Record<string, unknown>, outs?: BaseRunners,
    outTypes?: { first: string; second: string; third: string; home: string }, rbi?: number, runnerUpdates?: RunnerUpdate[]) => Promise<void> | void
  onChangePlayer?: (kind: 'pinch_hitter' | 'pinch_runner' | 'defensive' | 'position') => void
  onClose: () => void
}

export default function ClassicAtBatPad({ embedded = false, paperBox, batterHistory, playerName, inning, outsBefore = 0, existingAtBat, isLocked = false, onSave, onClose, matchup = null, activeRunners = [], onRunnerEvent, onChangePlayer }: ClassicAtBatPadProps) {
  const { language } = useLanguage()
  const es = language === 'es'
  const t = (spanish: string, english: string) => es ? spanish : english
  const runnerPanel = useRef<HTMLDivElement>(null)
  const [showChoices, setShowChoices] = useState(false)
  const [actions, setActions] = useState<BoxAction[]>([])
  const { templates, error: trainingError } = useTrainingSamples()
  const [token, setToken] = useState(String(existingAtBat?.notation || existingAtBat?.result || ''))
  const [rbi, setRbi] = useState(Number(existingAtBat?.rbi || 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editedResult, setEditedResult] = useState(false)
  const [runnerOut, setRunnerOut] = useState(Object.values((existingAtBat?.base_runner_outs || {}) as object).some(Boolean))
  const [runnerActions, setRunnerActions] = useState<Record<string, BoxAction[]>>({})
  const [reviewed, setReviewed] = useState<Record<string, string>>({})
  const [drawingRunners, setDrawingRunners] = useState<Record<string, boolean>>({})
  const [reviewRunners, setReviewRunners] = useState(false)
  const [batterEnabled, setBatterEnabled] = useState(embedded)
  const [runnerPlay, setRunnerPlay] = useState<{ type: RunnerEventType | null } | null>(null)
  const [runnerDone, setRunnerDone] = useState('')
  const inkDraft = usePaperDraft(paperBox, {actions,token,rbi,runnerOut,runnerActions,reviewed}, draft => {
    setActions(draft.actions); setToken(draft.token); setRbi(draft.rbi); setRunnerOut(draft.runnerOut)
    setRunnerActions(draft.runnerActions); setReviewed(draft.reviewed); setEditedResult(true)
  })
  const play = scoringPlay(token)
  const locked = isLocked || saving || !inkDraft.ready
  const { marks, tokenMatches, waiting, onDrawingChange } = useScorecardInterpretation(actions, templates)
  const choicesCollapsed = !showChoices && (!!play || (!waiting && tokenMatches.some(m => scoringPlay(m.symbol))))
  useEffect(() => {
    if (!embedded && token && !showChoices) runnerPanel.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [token, showChoices, embedded])
  const anyRunnerDrawing = activeRunners.some(r => drawingRunners[r.atBatId + ':' + r.base])
  const drawnBases = Object.values(marks.bases).some(Boolean)
  const previousBases = existingAtBat?.base_runners as BaseRunners | undefined
  const bases = play?.outs ? emptyBases() : drawnBases ? marks.bases : !editedResult && previousBases ? previousBases : play ? playBases(play) : emptyBases()
  const isOut = !!play?.outs || runnerOut || marks.outNumber > 0
  const runnerUpdates = activeRunners.map(r => drawnRunnerUpdate(r, runnerActions[r.atBatId + ':' + r.base] || [], play?.code || ''))
  const inningEnded = inningEndsOnPlay(outsBefore, isOut, runnerUpdates)
  const runnersReady = embedded || inningEnded || activeRunners.every(r => reviewed[r.atBatId] === r.base)
  const readyToSave = !!play && !waiting && runnersReady && !anyRunnerDrawing
  const cancelRuns = thirdOutCancelsRuns(outsBefore, isOut, !!play?.outs, runnerUpdates)
  const outNumber = isOut ? Math.min(3, outsBefore + 1) : 0
  const landing = marks.hitLine ? landingData(marks.hitLine[marks.hitLine.length - 1] as Pt) : undefined
  const selfBase = existingAtBat ? runnerBaseOf(existingAtBat as { base_runners?: BaseRunners; base_runner_outs?: BaseRunners }) : null
  const runnerOptions: RunnerOption[] = [
    ...(existingAtBat && selfBase ? [{ atBatId: String(existingAtBat.id), playerId: String(existingAtBat.player_id), playerName, base: selfBase }] : []), ...activeRunners,
  ]


  const clearReading = !waiting && !token ? confidentNotation(tokenMatches) : null
  useEffect(() => { if (embedded && clearReading) { setToken(clearReading); setEditedResult(true); setError('') } }, [embedded,clearReading])

  function choose(code: string) {
    setShowChoices(false); setToken(code); setEditedResult(true); setRunnerOut(false); setError('')
    setRunnerActions({}); setReviewed({}); setDrawingRunners({}); setBatterEnabled(embedded)
    setReviewRunners(!embedded && activeRunners.length > 0)
    setRbi(scoringPlay(code)?.base === 4 ? 1 : 0)
  }

  function editActions(next: BoxAction[]) {
    if (JSON.stringify(interpretBox(next, []).marks.ink) !== JSON.stringify(interpretBox(actions, []).marks.ink)) {
      setToken(''); setEditedResult(true)
    }
    setActions(next); setError('')
  }

  function updateRunner(r: RunnerOption, next: BoxAction[], hold = false) {
    const updated = { ...runnerActions, [r.atBatId + ':' + r.base]: next }
    setRunnerActions(updated)
    const move = runnerDrawing(r, next).move
    setReviewed(prev => ({ ...prev, [r.atBatId]: hold || move !== 'stay' ? r.base : '' }))
    setRbi(play?.result === 'error' || (play?.outs || 0) > 1 ? 0 : activeRunners.filter(runner => runnerDrawing(runner, updated[runner.atBatId + ':' + runner.base] || []).scored).length + (!isOut && bases.home ? 1 : 0))
    setError('')
  }

  async function save() {
    if (!play || locked || !readyToSave) return
    setSaving(true); setError('')
    try {
      // A force/batter third out nullifies runs without asking for runner holds.
      const updates = runnerUpdates.map((update, index) => cancelRuns && update.move === 'home'
        ? runnerUpdateFor(activeRunners[index], 'stay', play.code) : update)
      const finalRbi = cancelRuns ? 0 : rbi
      const outsOnPlay = (isOut ? 1 : 0) + updates.filter(u => u.move === 'out').length
      if (outsBefore + outsOnPlay > 3) throw new Error(t('La jugada supera los tres outs.', 'This play exceeds three outs.'))
      if (play.outs > 1 && outsOnPlay !== play.outs) throw new Error(t('Selecciona los corredores que quedaron out.', 'Select the runners retired on this play.'))
      const destinations = updates.filter(u => !['out', 'home'].includes(u.move)).map(u => u.move === 'stay' ? activeRunners.find(r => r.atBatId === u.atBatId)!.base : u.move)
      if (!isOut && !bases.home) destinations.push(bases.third ? 'third' : bases.second ? 'second' : 'first')
      if (!inningEnded && new Set(destinations).size !== destinations.length) throw new Error(t('Dos corredores no pueden ocupar la misma base.', 'Two runners cannot occupy the same base.'))
      const outs = emptyBases()
      if (isOut) outs[bases.third ? 'third' : bases.second ? 'second' : 'first'] = true
      const scoringRunners = updates.filter(u => u.move === 'home').length + (!isOut && bases.home ? 1 : 0)
      if (finalRbi > scoringRunners && (!existingAtBat || editedResult)) throw new Error(t('Las impulsadas no pueden superar las carreras de la jugada.', 'RBI cannot exceed the runs scored on this play.'))
      const finalBases = isOut || cancelRuns ? { ...bases, home: false } : bases
      await inkDraft.flush()
      await onSave(token, finalBases, landing ? { ...landing } : undefined, outs, { first: isOut ? 'OUT' : '', second: '', third: '', home: '' }, finalRbi, updates)
    } catch (e) { setError(e instanceof Error ? e.message : t('No se pudo guardar.', 'Could not save.')) }
    finally { setSaving(false) }
  }

  return <div className={embedded ? "paper-editor" : "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-5"} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="at-bat-title">
    {runnerPlay && <RunnerPlayModal runners={runnerOptions} initialType={runnerPlay.type} enteredVia="classic" onConfirm={async ev => {
      await onRunnerEvent?.(ev); setRunnerDone(ev.runnerName + ' · ' + ev.type); setRunnerPlay(null)
    }} onClose={() => setRunnerPlay(null)} />}
    <div className={embedded ? "flex w-full flex-col bg-[#fffdf5]" : "flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"}>
      <header className={"relative shrink-0 overflow-hidden bg-slate-950 px-4 text-white sm:px-6 " + (reviewRunners ? "py-2" : "py-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400"><Swords className="size-4" />{t('Duelo en el plato', 'At the plate')} · {t('Entrada', 'Inning')} {inning}</p>
            <h3 id="at-bat-title" className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{playerName}</h3>
            {!embedded && batterHistory && <BatterHistory key={batterHistory.batterId + batterHistory.pitcherId} context={batterHistory} lang={language} />}
            {!embedded && !batterHistory && matchup && <p className="mt-1 text-xs text-slate-300">vs {matchup.pitcherName} · {matchupLine(matchup, language)}</p>}
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label={t('Cerrar', 'Close')} className="rounded-lg bg-white/10 p-2 hover:bg-white/20"><X className="size-5" /></button>
        </div>
        <div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold"><span className="text-slate-400">OUTS</span>{[1,2,3].map(n => <span key={n} className={'size-2.5 rounded-full ' + (n <= outsBefore + Number(isOut) + runnerUpdates.filter(u => u.move === 'out').length ? 'bg-rose-400' : 'bg-slate-700')} />)}</div><span className="text-xs font-semibold text-slate-300">{t('Escribe o toca una opción', 'Write or tap a result')}</span></div>
      </header>
      {!embedded && onChangePlayer && !reviewRunners && <div className="flex shrink-0 flex-wrap gap-2 border-b p-2">
        <Button size="sm" variant="outline" disabled={locked} onClick={() => onChangePlayer('pinch_hitter')}>{t('Cambiar bateador / emergente', 'Change batter / pinch hitter')}</Button>
        <Button size="sm" variant="outline" disabled={locked || !activeRunners.length} onClick={() => onChangePlayer('pinch_runner')}>{t('Corredor emergente', 'Pinch runner')}</Button>
        <Button size="sm" variant="outline" disabled={locked} onClick={() => onChangePlayer('defensive')}>{t('Cambio defensivo', 'Defensive change')}</Button>
        <Button size="sm" variant="outline" disabled={locked} onClick={() => onChangePlayer('position')}>{t('Cambiar posición', 'Change position')}</Button>
      </div>}
      <div className={"grid min-h-0 flex-1 overscroll-contain gap-4 overflow-y-auto p-3 sm:p-4 " + (reviewRunners ? "grid-cols-1" : "md:grid-cols-2")}>
        <div className={reviewRunners ? "hidden" : "space-y-3"}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{!embedded && '01 · '}{t('Traza la jugada', 'Draw the play')}</p>
          <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><ScorecardField actions={actions} onChange={editActions} onDrawingChange={onDrawingChange} marks={{ ...marks, bases, outNumber }} notation={play ? token : undefined} disabled={locked || !batterEnabled} runners={runnerOptions} language={language} />{!batterEnabled && !locked && <button type="button" onClick={() => setBatterEnabled(true)} className="absolute inset-0 flex touch-pan-y items-center justify-center rounded-2xl bg-white/25"><span className="rounded-xl bg-slate-950/90 px-4 py-3 text-sm font-bold text-white">{t('Toca para escribir', 'Tap to enable drawing')}</span></button>}</div>
          {!embedded && play && <NotationGuide notation={token} language={language} />}
          {!embedded && <HandwritingConfirmation matches={tokenMatches} ink={marks.ink} value={token} onConfirm={choose} waiting={waiting} language={language} disabled={locked} />}
          {embedded && !play && !waiting && tokenMatches.length > 0 && <div className="border-b border-dashed border-amber-700 pb-2"><p className="text-sm">{t("¿Qué anotaste?", "What did you write?")}</p><div className="flex flex-wrap gap-2">{tokenMatches.filter(m => scoringPlay(m.symbol)).slice(0,3).map(m => <button type="button" disabled={locked} key={m.symbol} onClick={()=>choose(m.symbol)} className="min-h-11 border-b border-stone-400 px-4 font-serif text-xl">{m.symbol}</button>)}</div></div>}
          <div className="flex flex-wrap gap-2">{!embedded && batterEnabled && <Button variant="outline" size="sm" onClick={() => setBatterEnabled(embedded)}>{t('Terminar de dibujar', 'Done drawing')}</Button>}<Button variant="outline" size="sm" disabled={locked || !actions.length} onClick={() => editActions(actions.slice(0,-1))}><Undo2 />{t('Deshacer', 'Undo')}</Button><Button variant="outline" size="sm" disabled={locked} onClick={() => { setActions([]); setToken(''); setRunnerOut(false); setEditedResult(true); setRunnerActions({}); setReviewed({}); setBatterEnabled(embedded); setReviewRunners(false); setRbi(0) }}><Eraser />{t('Borrar', 'Clear')}</Button></div>
          <p className="text-xs leading-relaxed text-slate-500">{t('Bolas, strikes, bases y dirección del batazo se marcan al instante.', 'Balls, strikes, bases and hit direction update immediately.')}</p>
          {runnerOptions.length > 0 && onRunnerEvent && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950"><p className="mb-2 text-xs font-bold">{t('Jugada entre lanzamientos', 'Between pitches')}</p><div className="flex flex-wrap gap-2">{[...RUNNER_TOKENS].map(code => <button key={code} disabled={locked} type="button" onClick={() => setRunnerPlay({ type: code as RunnerEventType })} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold">{code}</button>)}</div><p className="mt-2 text-xs">{t('Robo, out robando, pickoff, wild pitch, passed ball y balk.', 'Steal, caught stealing, pickoff, wild pitch, passed ball and balk.')}</p></div>}
          {runnerDone && <p role="status" className="text-sm font-semibold text-emerald-700">✓ {runnerDone}</p>}
        </div>
        <div ref={runnerPanel} className="scroll-m-3 space-y-4">{embedded && <button type="button" onClick={()=>setShowChoices(!showChoices)} className="min-h-11 border-b border-stone-400 font-serif">{t("Abreviaturas / elegir resultado", "Notation reference / choose result")}</button>}{(!embedded || showChoices) && <>{choicesCollapsed ? <Button variant="outline" size="sm" disabled={locked} onClick={() => { setShowChoices(true); setReviewRunners(false) }}>{t('Cambiar resultado', 'Change result')}</Button> : <><p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('O elige el resultado aquí', 'Or choose your result here')}</p>
          <PlayPicker value={token} onChange={choose} language={language} disabled={locked} outs={outsBefore} runners={activeRunners.length} /></>}</>}
          {play && <div className={'rounded-xl border-l-4 p-4 ' + (isOut ? 'border-rose-500 bg-rose-50 text-rose-950' : 'border-emerald-500 bg-emerald-50 text-emerald-950')} role="status"><span className="text-2xl font-black">{token.toUpperCase()}</span><span className="ml-3 text-sm font-semibold">{play[language]}</span><p className="mt-1 text-xs font-bold uppercase tracking-wider">{isOut ? t('Bateador out', 'Batter out') : t('Bateador a salvo', 'Batter safe')}</p></div>}
          {play && play.outs === 0 && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={runnerOut} disabled={locked} onChange={e => setRunnerOut(e.target.checked)} />{t('Out intentando avanzar después de llegar a base', 'Out advancing after reaching base')}</label>}
          {play && inningEnded && <p role="status" className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">{t('Tres outs. Guarda la jugada para terminar la entrada; no necesitas confirmar a los demás corredores.', 'Three outs. Save the play to end the inning; no other runner confirmations are needed.')}</p>}
          {play && activeRunners.length > 0 && !inningEnded && <section className="space-y-2">
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{t('Completa las casillas de los corredores', 'Complete the runners’ scorecards')}</h3><button type="button" disabled={locked} onClick={() => { setReviewRunners(!embedded && !reviewRunners); setBatterEnabled(embedded) }} className="min-h-9 rounded border px-3 text-xs">{reviewRunners ? t('Ver bateador', 'View batter') : t('Ver corredores', 'Focus runners')}</button></div>
            {!embedded && <p className="text-xs text-slate-600">{t('Las casillas están listas para dibujar. Traza el avance, rellena el diamante para anotar o marca OUT. Si no avanza, confirma «Se queda».', 'Runner boxes are ready to draw. Draw the advance, shade the diamond to score, or mark OUT. If the runner does not advance, confirm “Holds”.')}</p>}
            <div className={'grid gap-2 ' + (activeRunners.length === 1 ? 'mx-auto w-full max-w-sm grid-cols-1' : activeRunners.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
              {activeRunners.map(r => <RunnerScorecardBox key={r.atBatId + r.base} runner={r} actions={runnerActions[r.atBatId + ':' + r.base] || []} onChange={next => updateRunner(r,next)}
                onHold={() => updateRunner(r,[],true)} reviewed={reviewed[r.atBatId] === r.base} requireHoldConfirmation={!embedded} disabled={locked} language={language}
                onDrawingChange={active => setDrawingRunners(prev => ({ ...prev, [r.atBatId + ':' + r.base]: active }))} />)}
            </div>
          </section>}
          {play && <label className="flex items-center justify-between text-sm font-semibold text-slate-700">{t('Carreras impulsadas', 'Runs batted in')}<select aria-label="RBI" disabled={locked || cancelRuns} value={cancelRuns ? 0 : rbi} onChange={e => setRbi(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white p-2">{[0,1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label>}
        </div>
      </div>
      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {embedded && <p role="status" className="mb-2 text-xs text-stone-600">{!inkDraft.ready ? t('Cargando trazos…','Loading ink…') : inkDraft.status === 'saved' ? t('Trazos guardados · termina la jugada para actualizar el juego.','Ink saved · finish the play to update the game.') : inkDraft.status === 'saving' ? t('Guardando trazos…','Saving ink…') : t('Trazos pendientes de sincronizar.','Ink is waiting to sync.')} {inkDraft.status === 'local' && <button type="button" onClick={()=>void inkDraft.flush().catch(()=>{})} className="underline">{t('Reintentar','Retry')}</button>}</p>}
        {trainingError && <p role="alert" className="text-sm text-amber-800">{t('No se pudieron actualizar las muestras: ', 'Could not refresh training samples: ')}{trainingError}</p>}
        {error && <p role="alert" className="mb-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 text-sm text-slate-700" aria-live="polite">{isLocked ? t('Juego cerrado · Solo lectura', 'Game locked · Read only')
            : waiting ? (embedded ? t('Escribe a tu ritmo…', 'Write at your own pace…') : t('Termina el trazo y confirma el resultado bajo el campo.', 'Finish writing, then confirm the result below the field.'))
            : play ? <><span className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 className="size-4 shrink-0" />{token.toUpperCase()} · {t('Confirmado', 'Confirmed')}</span><span className="text-xs">{runnersReady ? t('Listo para guardar.', 'Ready to save.') : t('Actualiza o confirma que se queda cada corredor.', 'Update or confirm Holds for every runner.')}</span></>
            : embedded ? t('Escribe la jugada con el lápiz o el dedo.', 'Write the play with your pencil or finger.') : t('Primero, toca «Confirmar» bajo el campo o elige un resultado.', 'First, tap “Confirm” below the field or choose a result.')}</div>
          {readyToSave && <Button variant="success" size="lg" className="min-h-14 w-full shrink-0 whitespace-normal text-lg font-black shadow-lg sm:w-auto sm:min-w-60 [&_svg]:size-5" onClick={() => void save()} disabled={locked || !play || waiting}><Save />{saving ? t('Guardando…', 'Saving…') : embedded ? t('Terminar jugada', 'Finish play') : t('Guardar jugada', 'Save play')}</Button>}
        </div>
      </footer>
    </div>
  </div>
}
