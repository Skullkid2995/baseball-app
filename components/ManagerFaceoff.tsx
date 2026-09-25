'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { useTrainingSamples } from '@/lib/handwriting/useTrainingSamples'
import { interpretBox, type BoxAction, type BoxMarks } from '@/lib/scorecard/interpret'
import { useScorecardInterpretation } from '@/lib/scorecard/useScorecardInterpretation'
import { emptyBases, playBases, scoringPlay } from '@/lib/scorecard/plays'
import PlayPicker from './PlayPicker'
import Scoreboard from './Scoreboard'
import { applyEvent, type Side } from '@/lib/rules/engine'
import { notationEvent, type Room } from '@/lib/faceoff/workflow'
import ScorecardBox from './ScorecardBox'
import ScorecardField from './ScorecardField'
import HandwritingConfirmation from './HandwritingConfirmation'
import NotationGuide from './NotationGuide'
import { Button } from '@/components/ui'

interface Snapshot { room: Room | null; side: Side | null; canStart: boolean; isSuperAdmin: boolean }
function withBasePath(marks: BoxMarks, notation: string): BoxMarks {
  const play = scoringPlay(notation)
  if (play?.outs) return { ...marks, bases: emptyBases() }
  return play && !Object.values(marks.bases).some(Boolean) ? { ...marks, bases: playBases(play) } : marks
}
export default function ManagerFaceoff({ gameId }: { gameId: string }) {
  const { language } = useLanguage()
  const lang = language === 'es' ? 'es' : 'en'
  const t = (es: string, en: string) => lang === 'es' ? es : en
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [actions, setActions] = useState<BoxAction[]>([])
  const [notation, setNotation] = useState('')
  const { templates, error: trainingError } = useTrainingSamples()
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [testSide, setTestSide] = useState<Side | ''>('')
  const [lastSync, setLastSync] = useState<string>('')
  const [draftReady, setDraftReady] = useState(false)
  const [, refreshDraft] = useState(0)
  const alive = useRef(true)
  const inFlight = useRef(false)
  const draftVersion = useRef<number | null>(null)
  const submissionId = useRef<string | null>(null)
  const endpoint = `/api/faceoff/${gameId}`
  const draftKey = `faceoff-draft:${gameId}`
  const room = snapshot?.room
  const side = snapshot?.isSuperAdmin && testSide ? testSide : snapshot?.side
  const canWrite = !!room && side === room.state.battingSide && !room.pending && room.state.status !== 'final'
  const marks = useScorecardInterpretation(actions, templates, 'shared')
  const pendingMarks = useMemo(() => interpretBox(room?.pending?.ink || [], []), [room?.pending?.ink])
  const pendingPreview = useMemo(() => room?.pending ? applyEvent(room.state, room.pending.event) : null, [room])

  let localPreview = null
  try { if (room && notation) localPreview = applyEvent(room.state, notationEvent(notation)) } catch { /* explicit correction required */ }

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('Sign in again to reconnect / Inicia sesión para reconectar')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (!alive.current) return
      setSnapshot(old => old?.room && data.room && old.room.version > data.room.version ? old : data)
      setSyncError('')
      setLastSync(new Date().toLocaleTimeString())
    } catch (e) { if (alive.current) setSyncError(e instanceof Error ? e.message : 'Connection failed') }
    finally { inFlight.current = false }
  }, [endpoint])

  useEffect(() => {
    alive.current = true
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 2000)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    return () => { alive.current = false; clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh) }
  }, [refresh])
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey)
      if (saved) {
        const draft = JSON.parse(saved)
        setActions(draft.actions || []); setNotation(draft.notation || '')
        draftVersion.current = draft.version ?? null; submissionId.current = draft.id ?? null
      }
    } catch { /* Storage may be disabled on shared tablets. */ }
    setDraftReady(true)
  }, [draftKey])
  useEffect(() => {
    if (!draftReady) return
    try { sessionStorage.setItem(draftKey, JSON.stringify({ actions, notation, version: draftVersion.current, id: submissionId.current })) } catch { /* Keep the draft in memory. */ }
  }, [actions, notation, draftKey, draftReady])

  function editInk(next: BoxAction[]) {
    if (!actions.length && !notation) draftVersion.current = room?.version ?? null
    submissionId.current = null
    setActions(next)
    if (JSON.stringify(interpretBox(next, []).marks.ink) !== JSON.stringify(interpretBox(actions, []).marks.ink)) setNotation('')
  }
  function choose(value: string) {
    if (!actions.length && !notation) draftVersion.current = room?.version ?? null
    submissionId.current = null
    setNotation(value)
  }
  function clearDraft() {
    setActions([]); setNotation(''); draftVersion.current = null; submissionId.current = null
    try { sessionStorage.removeItem(draftKey) } catch { /* no storage */ }
  }
  async function mutate(action: string) {
    if (busy || (action === 'submit' && marks.waiting)) return
    setBusy(true); setError('')
    try {
      if (action === 'submit' && draftVersion.current !== null && room?.version !== draftVersion.current) throw new Error(t('El juego cambió. Revisa el borrador antes de enviarlo.', 'The game changed. Review your draft before submitting.'))
      if (action === 'submit') submissionId.current ||= crypto.randomUUID()
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, version: room?.version, id: action === 'submit' ? submissionId.current : room?.pending?.id, notation, ink: actions, note, testSide: snapshot?.isSuperAdmin ? testSide : undefined }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (action === 'submit') clearDraft()
      setNote('')
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); await refresh() }
    finally { setBusy(false) }
  }
  const panel = 'rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm'
  const selectedPlay = scoringPlay(notation)
  const batterName = room?.state.currentBatter ? room.state.batterLines[room.state.currentBatter.playerId]?.name : undefined
  return <div className="space-y-5">
    <Link href="/live" className="text-sm underline">← {t('Juego actual', 'Current game')}</Link>
    <h1 className="text-2xl font-bold">{t('Scorecard compartido', 'Shared scorecard')}</h1>
    <p className="text-sm text-muted-foreground">{t('El mánager al bat escribe. El rival valida. Solo las jugadas aceptadas cuentan.', 'The batting manager writes. The opponent validates. Only accepted plays count.')}</p>
    {(error || syncError) && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900">{error || syncError}<button className="ml-3 underline" onClick={() => void refresh()}>{t('Reconectar', 'Reconnect')}</button></div>}
    {snapshot?.isSuperAdmin && <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950 space-y-2">
      <strong>{t('Pruebas de super admin', 'Super-admin testing')}</strong>
      <p className="text-sm">{t('Cambia de equipo para escribir y validar con la misma cuenta. Las acciones se marcan como prueba.', 'Switch teams to score and validate with the same account. Actions are marked as tests.')}</p>
      <select aria-label={t('Equipo de prueba', 'Test team')} className="rounded border p-2" value={testSide} onChange={e => setTestSide(e.target.value as Side | '')}>
        <option value="">{t('Sin simulación', 'No test override')}</option>
        <option value="home">{room?.names.home || 'Home'}</option><option value="opponent">{room?.names.opponent || 'Opponent'}</option>
      </select>
    </div>}
    {trainingError && <p role="alert" className="text-sm text-amber-800">{t('No se pudieron actualizar las muestras: ', 'Could not refresh training samples: ')}{trainingError}</p>}
    {!snapshot ? <p>{t('Cargando…', 'Loading…')}</p> : !room ? <section className={panel}>
      <p>{t('Prepara ambas alineaciones y lanzadores. Este modo comienza en la primera entrada con las reglas predeterminadas; guarda sus propias estadísticas.', 'Prepare both lineups and pitchers. This mode starts in the first inning with default rules and keeps its own statistics.')}</p>
      {snapshot.canStart ? <Button disabled={busy || !!syncError} onClick={() => void mutate('start')}>{t('Iniciar scorecard compartido', 'Start shared scorecard')}</Button> : <p>{t('Espera a que un administrador inicie el scorecard.', 'Wait for an administrator to start the scorecard.')}</p>}
    </section> : <>
      <Scoreboard home={room.names.home} away={room.names.opponent} homeScore={room.state.score.home} awayScore={room.state.score.opponent}
        inning={room.state.inning} half={room.state.half} outs={room.state.outs} batter={batterName} language={lang}
        battingTeam={room.names[room.state.battingSide]}
        runners={room.state.status === 'final' ? [] : room.state.runners.map(r => ({ playerName: r.name, base: (['first', 'second', 'third'] as const)[r.base - 1] }))}
        status={room.state.status === 'final' ? t('Final', 'Final') : t('En juego', 'Live')} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{t('Corredores', 'Runners')}: {room.state.runners.map(r => r.name + ' (' + r.base + 'B)').join(', ') || '—'}</span><span>{syncError ? t('Sin conexión', 'Disconnected') : t('Sincronizado', 'Synced') + ' ' + lastSync}</span></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="font-semibold">{t('Escribir jugada', 'Write a play')} · {room.state.currentBatter ? room.state.batterLines[room.state.currentBatter.playerId]?.name : '—'}</h2>
          {!canWrite && <p>{room.pending ? t('Esperando validación.', 'Waiting for validation.') : t('Es el turno del otro equipo.', 'The other team is scoring.')}</p>}
          <div className="max-w-md"><ScorecardField actions={actions} onChange={editInk} onDrawingChange={marks.onDrawingChange} marks={{ ...withBasePath(marks.marks, notation), outNumber: selectedPlay?.outs ? Math.min(3, room.state.outs + selectedPlay.outs) : marks.marks.outNumber }} notation={selectedPlay ? notation : undefined} disabled={!canWrite || busy || !!syncError} language={lang}
            runners={room.state.runners.filter(r => r.base < 4).map(r => ({ playerName: r.name, base: (['first', 'second', 'third'] as const)[r.base - 1] }))} /></div>
          <HandwritingConfirmation matches={marks.tokenMatches} ink={marks.marks.ink} value={notation} onConfirm={choose} waiting={marks.waiting} language={lang} shared disabled={!canWrite || busy || !!syncError} />
          {selectedPlay && <NotationGuide notation={notation} language={lang} />}
          <div className="flex gap-2"><Button variant="outline" disabled={busy || !actions.length} onClick={() => editInk(actions.slice(0, -1))}>{t('Deshacer', 'Undo')}</Button><Button variant="outline" disabled={busy} onClick={clearDraft}>{t('Borrar', 'Clear')}</Button></div>
          <PlayPicker value={notation} onChange={choose} language={lang} shared disabled={!canWrite || busy || !!syncError} outs={room.state.outs} runners={room.state.runners.length} />
          {selectedPlay && <div role="status" className={'rounded-xl p-3 font-bold ' + (selectedPlay.outs ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800')}>{selectedPlay[lang]} · {selectedPlay.outs ? selectedPlay.outs + ' OUT' + (selectedPlay.outs > 1 ? 'S' : '') : t('A salvo', 'Safe')}</div>}
          {localPreview && <p className="text-sm">{t('Resultado propuesto', 'Proposed result')}: {localPreview.score.home}–{localPreview.score.opponent} · {t('Entrada', 'Inning')} {localPreview.inning} {localPreview.half} · {localPreview.outs} outs<br />{t('Corredores', 'Runners')}: {localPreview.runners.map(r => `${r.name} (${r.base})`).join(', ') || '—'}</p>}
          <p className="text-xs text-muted-foreground">{t('Revisa el avance automático de corredores. Los trazos son el registro visual; esta primera versión usa el avance predeterminado del motor.', 'Review automatic runner advancement. Ink is the visual record; this first version uses the engine’s default advancement.')}</p>
          {draftVersion.current !== null && draftVersion.current !== room.version && (actions.length > 0 || notation) && <Button variant="outline" onClick={() => { draftVersion.current = room.version; setError(''); refreshDraft(v => v + 1); }}>{t('Revisé el borrador para este turno', 'I reviewed this draft for the current turn')}</Button>}
          <Button className="min-h-14 w-full whitespace-normal text-lg font-black" disabled={!canWrite || busy || !localPreview || !!syncError || marks.waiting} onClick={() => void mutate('submit')}>{t('2 · Enviar a validar', '2 · Submit for validation')}</Button>
        </section>
        <section className={panel}>
          <h2 className="font-semibold">{t('Validación del rival', 'Opponent validation')}</h2>
          {room.pending ? <>
            <p>{room.pending.batter} · {room.pending.notation} · {t('Entrada', 'Inning')} {room.pending.inning}</p>
            {room.pending.adminTest && <p className="text-amber-700">{t('Acción de prueba', 'Test action')}</p>}
            <div className="max-w-md"><ScorecardBox actions={room.pending.ink} onChange={() => {}} marks={{ ...withBasePath(pendingMarks.marks, room.pending.notation), outNumber: room.pending.outNumber || 0 }} notation={room.pending.notation} disabled /></div>
            {pendingPreview && <p>{t('Al aceptar', 'On acceptance')}: {pendingPreview.score.home}–{pendingPreview.score.opponent} · {t('Entrada', 'Inning')} {pendingPreview.inning} {pendingPreview.half} · {pendingPreview.outs} outs<br />{t('Corredores', 'Runners')}: {pendingPreview.runners.map(r => `${r.name} (${r.base})`).join(', ') || '—'}</p>}
            {side && side !== room.pending.side ? <>
              <label className="block text-sm">{t('Nota de corrección', 'Correction note')}<textarea className="mt-1 w-full rounded border border-border bg-background p-3" value={note} maxLength={1000} onChange={e => setNote(e.target.value)} /></label>
              <div className="flex flex-wrap gap-2"><Button disabled={busy || !!syncError} onClick={() => void mutate('accept')}>{t('Aceptar jugada', 'Accept play')}</Button><Button variant="outline" disabled={busy || !note.trim() || !!syncError} onClick={() => void mutate('correct')}>{t('Solicitar corrección', 'Request correction')}</Button></div>
            </> : <p>{t('El otro mánager debe validar.', 'The other manager must validate.')}</p>}
          </> : <p>{t('Las jugadas enviadas aparecerán aquí automáticamente.', 'Submitted plays appear here automatically.')}</p>}
        </section>
      </div>
      <section className={panel}><h2 className="font-semibold">{t('Scorecards e historial', 'Scorecards and history')}</h2>
        {(['home', 'opponent'] as Side[]).map(team => <div key={team}><h3 className="font-semibold">{room.names[team]}</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {room.history.filter(p => p.side === team).map(p => <details key={p.id} className="rounded border border-border p-2 text-sm"><summary><span className={scoringPlay(p.notation)?.outs ? 'font-bold text-rose-700' : 'font-bold text-emerald-700'}>{p.notation}{scoringPlay(p.notation)?.outs ? ' · OUT' : ''}</span><br />{p.inning} · {p.batter}<br />{p.status === 'accepted' ? t('Aceptada', 'Accepted') : t('Corregir', 'Correction requested')}{p.adminTest ? ' · TEST' : ''}</summary>
            <ScorecardBox actions={p.ink} onChange={() => {}} marks={{ ...withBasePath(interpretBox(p.ink, []).marks, p.notation), outNumber: p.outNumber || (scoringPlay(p.notation)?.outs ? 1 : 0) }} notation={p.notation} disabled />
            {p.note && <p>{p.note}</p>}
            {p.status === 'correction_requested' && canWrite && p.side === side && <Button variant="outline" disabled={busy || !!actions.length || !!notation} onClick={() => { draftVersion.current = room.version; submissionId.current = null; setActions(p.ink); setNotation(p.notation); }}>{t('Corregir copia', 'Correct a copy')}</Button>}
          </details>)}
        </div></div>)}
      </section>
      <section className={panel}><h2 className="font-semibold">{t('Estadísticas confirmadas de este juego', 'Confirmed stats for this game')}</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>{t('Bateador', 'Batter')}</th><th>AB</th><th>H</th><th>R</th><th>RBI</th><th>BB</th><th>K</th></tr></thead><tbody>{Object.values(room.state.batterLines).map(b => <tr key={b.playerId}><td className="py-1">{b.name}</td><td>{b.atBats}</td><td>{b.hits}</td><td>{b.runs}</td><td>{b.rbi}</td><td>{b.walks}</td><td>{b.strikeouts}</td></tr>)}</tbody></table></div></section>
    </>}
  </div>
}
