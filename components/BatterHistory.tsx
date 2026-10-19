'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { battingLine, loadBatterHistory, loadBatterSeason } from '@/lib/batterStats'
import { averageFromLine, historyDrag, mlbPlayer, type BattingStats, type MlbMatchup, type PitchingStats } from '@/lib/mlb/stats'
import { scoringPlay } from '@/lib/scorecard/plays'
import SprayChart, { type SprayAtBat } from './SprayChart'
import MlbDirectionChart from './MlbDirectionChart'

export interface BatterHistoryContext {
  gameId: string; batterId: string; pitcherId: string | null; pitcherName: string; gameLine: string
  batterName?: string; teamName?: string; pitcherTeamName?: string; gameDate?: string
  recordedRows?: SprayAtBat[]
}
const cache = new Map<string, { time: number; data: MlbMatchup }>()
export default function BatterHistory({ context, lang, light = false }: { context: BatterHistoryContext; lang: 'en' | 'es'; light?: boolean }) {
  const es = lang === 'es', t = (a: string, b: string) => es ? a : b
  const id = useId()
  const panelRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false), [scope, setScope] = useState<'game' | 'all'>('game')
  const [tab, setTab] = useState<'mlb' | 'recorded'>('mlb'), [retry, setRetry] = useState(0)
  const [remote, setRemote] = useState<{ key: string; data?: MlbMatchup; error?: boolean } | null>(null)
  const [seasonLine, setSeasonLine] = useState<{ key: string; avg: string | null; label: string } | null>(null)
  const [history, setHistory] = useState<{ key: string; rows: SprayAtBat[]; error?: boolean } | null>(null)
  const gesture = useRef<{ x: number; y: number; dragged: boolean } | null>(null), suppress = useRef(false)
  const { gameId, batterId, pitcherId, pitcherName, gameLine, recordedRows } = context
  const season = Number(context.gameDate?.slice(0, 4)) || new Date().getFullYear()
  const batter = mlbPlayer(context.batterName, context.teamName), pitcher = mlbPlayer(pitcherName, context.pitcherTeamName)
  const mlbKey = `${batter?.id}:${pitcher?.id}:${season}:${retry}`
  const localKey = `${gameId}:${batterId}:${pitcherId}:${scope}:${retry}`
  const seasonKey = `${batterId}:${season}:${retry}`
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => { panelRef.current?.focus({ preventScroll: true }); panelRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) })
    return () => cancelAnimationFrame(frame)
  }, [open])
  useEffect(() => {
    if (!batter) return
    const controller = new AbortController(), saved = cache.get(mlbKey)
    if (saved && Date.now() - saved.time < 900000) { setRemote({ key: mlbKey, data: saved.data }); return }
    const q = new URLSearchParams({ batter: String(batter.id), season: String(season) })
    if (pitcher) q.set('pitcher', String(pitcher.id))
    fetch(`/api/mlb/matchup?${q}`, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('Stats unavailable')
      const data: MlbMatchup = await res.json()
      if (controller.signal.aborted) return
      cache.set(mlbKey, { time: Date.now(), data }); setRemote({ key: mlbKey, data })
    }).catch(() => { if (!controller.signal.aborted) setRemote({ key: mlbKey, error: true }) })
    return () => controller.abort()
  }, [mlbKey, batter, pitcher, season])
  useEffect(() => {
    if (batter || recordedRows) return
    let cancelled = false
    loadBatterSeason(supabase, batterId, season).then(rows => { if (!cancelled) setSeasonLine({ key: seasonKey, ...battingLine(rows) }) }).catch(() => { if (!cancelled) setSeasonLine(null) })
    return () => { cancelled = true }
  }, [batter, batterId, season, seasonKey, recordedRows])
  useEffect(() => {
    if (!open || !pitcherId || recordedRows || (batter && tab !== 'recorded')) return
    let cancelled = false
    loadBatterHistory(supabase, batterId, pitcherId, scope === 'game' ? gameId : undefined)
      .then(rows => { if (!cancelled) setHistory({ key: localKey, rows }) })
      .catch(() => { if (!cancelled) setHistory({ key: localKey, rows: [], error: true }) })
    return () => { cancelled = true }
  }, [open, gameId, batterId, pitcherId, scope, localKey, recordedRows, tab, batter])
  const data = remote?.key === mlbKey ? remote.data : undefined
  const rows = recordedRows ?? (history?.key === localKey ? history.rows : null)
  const hits = rows?.filter(row => scoringPlay(row.result)?.group === 'hit') ?? []
  const seasonAvg = batter ? data?.regular?.avg : seasonLine?.key === seasonKey ? seasonLine.avg : null
  const button = 'min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold'
  function batting(title: string, s: BattingStats | null | undefined) {
    return <div className="rounded-lg border border-slate-200 p-3"><h4 className="font-bold">{title}</h4>{s ? <>
      <p className="mt-1 text-sm">AVG <strong>{s.avg ?? '—'}</strong> · {s.hits}/{s.atBats} H/AB · {s.pa} PA · {s.homeRuns} HR</p>
      <p className="text-sm">OBP {s.obp ?? '—'} · OPS {s.ops ?? '—'} · BB {s.walks} · K {s.strikeouts}</p>
      <p className="mt-1 text-sm">{t('Hit por turno oficial', 'Hit per official at-bat')}: {s.hitPercent === null ? '—' : `${s.hitPercent}%`} · BB/PA {s.walkPercent === null ? '—' : `${s.walkPercent}%`} · K/PA {s.strikeoutPercent === null ? '—' : `${s.strikeoutPercent}%`}</p>
      {s.pa < 20 && <p className="mt-1 text-xs text-amber-800">{t('Muestra pequeña: menos de 20 apariciones.', 'Small sample: fewer than 20 plate appearances.')}</p>}
    </> : <p className="text-sm">{t('Sin datos disponibles.', 'No data available.')}</p>}</div>
  }
  function pitching(title: string, s: PitchingStats | null | undefined) {
    return <div className="rounded-lg border border-slate-200 p-3"><h4 className="font-bold">{title}</h4><p className="text-sm">{s ? `ERA ${s.era ?? '—'} · WHIP ${s.whip ?? '—'} · IP ${s.innings ?? '—'} · K ${s.strikeouts} · BB ${s.walks} · BF ${s.battersFaced}` : t('Sin datos disponibles.', 'No data available.')}</p></div>
  }
  return <div className="mt-2 min-w-0">
    <button type="button" aria-expanded={open} aria-controls={id} className={'min-h-14 w-full touch-pan-x rounded-lg border px-3 py-2 text-left text-sm ' + (light ? 'border-stone-400 bg-white text-slate-900' : 'border-slate-600 bg-slate-800 text-white')}
      onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; suppress.current = false; gesture.current = { x: e.clientX, y: e.clientY, dragged: false }; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerMove={e => { const g = gesture.current; if (!g) return; const action = historyDrag(e.clientY - g.y, e.clientX - g.x); if (action) { g.dragged = true; setOpen(action === 'open') } }}
      onPointerUp={e => { suppress.current = !!gesture.current?.dragged; gesture.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }}
      onPointerCancel={() => { gesture.current = null; suppress.current = false }} onLostPointerCapture={() => { gesture.current = null }}
      onClick={e => { if (!suppress.current || e.detail === 0) setOpen(v => !v); suppress.current = false }}>
      <span className="block font-bold tabular-nums">{batter ? 'MLB' : t('Registrado', 'Recorded')} {season} AVG {seasonAvg ?? '—'} · {t('Juego', 'Game')} AVG {averageFromLine(gameLine)} · {gameLine} H-AB</span>
      <span className="block text-xs">{t('Arrastra abajo o toca para ver estadísticas', 'Pull down or tap for statistics')} · vs {pitcherName || '—'} {open ? '▴' : '▾'}</span>
    </button>
    {open && <section ref={panelRef} tabIndex={-1} id={id} aria-label={t('Estadísticas del bateador y lanzador', 'Batter and pitcher statistics')} className="batter-history-panel mt-2 max-h-[55dvh] scroll-mt-24 space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none">
      <div className="flex flex-wrap gap-2">{batter && <button type="button" className={button} aria-pressed={tab === 'mlb'} onClick={() => setTab('mlb')}>MLB</button>}<button type="button" className={button} aria-pressed={!batter || tab === 'recorded'} onClick={() => setTab('recorded')}>{t('Hits registrados', 'Recorded hits')}</button><button type="button" className={button} onClick={() => setOpen(false)}>{t('Cerrar estadísticas', 'Close statistics')}</button></div>
      {batter && tab === 'mlb' ? !data ? <p role="status">{remote?.key === mlbKey && remote.error ? t('No se pudieron consultar los datos MLB.', 'MLB data could not be loaded.') : t('Consultando MLB…', 'Loading MLB…')} <button type="button" className={button} onClick={() => setRetry(v => v + 1)}>{t('Reintentar', 'Retry')}</button></p> : <>
        {batting(`${season} · ${t('Temporada regular', 'Regular season')}`, data.regular)}
        {batting(`${season} · ${t('Postemporada', 'Postseason')}`, data.postseason)}
        {batting(t('Carrera · temporada regular', 'Career · regular season'), data.career)}
        <h4 className="font-bold">{t('Enfrentamientos de carrera contra', 'Career matchups against')} {pitcherName || '—'}</h4>
        {!pitcher ? <p>{t('El lanzador aún no está vinculado a MLB.', 'The pitcher is not linked to MLB yet.')}</p> : <>
          {batting(t('Bateador vs lanzador · temporada regular', 'Batter vs pitcher · regular season'), data.versus)}
          {batting(t('Bateador vs lanzador · postemporada', 'Batter vs pitcher · postseason'), data.versusPostseason)}
          {pitching(`${pitcherName} · ${season}`, data.pitching)}{pitching(`${pitcherName} · ${t('Carrera regular', 'Regular-season career')}`, data.pitchingCareer)}
          <h4 className="font-bold">{t('Dirección de batazos contra este lanzador', 'Batted-ball directions against this pitcher')} · {season}</h4>
          {data.versusDirections.length ? <MlbDirectionChart shares={data.versusDirections} lang={lang} /> : <p className="text-sm">{t('MLB no publica direcciones para este enfrentamiento y temporada.', 'No MLB direction data for this matchup and season.')}</p>}
        </>}
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">{t('Dirección contra todos los lanzadores', 'Directions against all pitchers')} · {season}</summary>{data.directions.length ? <MlbDirectionChart shares={data.directions} lang={lang} /> : <p>{t('Sin datos de dirección.', 'No direction data.')}</p>}</details>
        <p className="text-xs">{t('Frecuencias históricas, no probabilidades garantizadas. AVG = hits / turnos oficiales; PA = apariciones; OBP = porcentaje en base; OPS = OBP + slugging. ERA = carreras limpias por 9 entradas; WHIP = hits y bases por bola por entrada; BF = bateadores enfrentados. IP = entradas (el decimal indica outs).', 'Historical frequencies, not guaranteed odds. AVG = hits / official at-bats; PA = plate appearances; OBP = on-base percentage; OPS = OBP + slugging. ERA = earned runs per 9 innings; WHIP = hits and walks per inning; BF = batters faced. IP = innings (decimal indicates outs).')}</p>
        <p className="text-xs">{t('Fuente: MLB · consultado', 'Source: MLB · retrieved')} {new Date(data.fetchedAt).toLocaleString(es ? 'es-MX' : 'en-US')} · {t('caché de hasta 15 min', 'cached up to 15 min')}. {data.errors.length > 0 && t('Algunos datos no estuvieron disponibles.', 'Some data was unavailable.')} <a className="underline" href={`https://www.mlb.com/player/${batter.id}`} target="_blank" rel="noreferrer">MLB: {batter.name}</a></p>
        <button type="button" className={button} onClick={() => setRetry(v => v + 1)}>{t('Consultar de nuevo', 'Refresh stats')}</button>
      </> : <>
        <p className="font-bold">vs {pitcherName || '—'}</p>
        {!recordedRows && <div className="flex flex-wrap gap-2">{(['game', 'all'] as const).map(v => <button key={v} type="button" className={button} aria-pressed={scope === v} onClick={() => setScope(v)}>{v === 'game' ? t('Este juego', 'This game') : t('Todos los juegos', 'All games')}</button>)}</div>}
        {!pitcherId ? <p>{t('Selecciona un lanzador.', 'Select a pitcher.')}</p> : !rows ? <p role="status">{t('Cargando…', 'Loading…')}</p> : !recordedRows && history?.key === localKey && history.error ? <p role="alert">{t('No se pudo cargar el historial.', 'Could not load history.')} <button type="button" className={button} onClick={() => setRetry(v => v + 1)}>{t('Reintentar', 'Retry')}</button></p> : <>
          <p className="text-sm">AVG {battingLine(rows).avg ?? '—'} · {battingLine(rows).label} H-AB · {rows.length} PA</p>
          {hits.length ? <SprayChart atBats={hits} lang={lang} className="mx-auto max-w-sm" /> : <p>{t('Sin hits confirmados contra este lanzador.', 'No confirmed hits against this pitcher.')}</p>}
          <p className="text-xs">{t('Solo jugadas guardadas en esta app. Los puntos con ubicación exacta vienen del trazo registrado; los puntos por zona son aproximados.', 'Only plays saved in this app. Exact locations come from recorded trajectories; zone-based points are approximate.')}</p>
        </>}
      </>}
    </section>}
  </div>
}
