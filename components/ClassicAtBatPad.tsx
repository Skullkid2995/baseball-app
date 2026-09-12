'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eraser, PenTool, RotateCcw, Save, Undo2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { Badge, Button } from '@/components/ui'
import { TOKENS, describeToken } from '@/lib/handwriting/vocabulary'
import { normalize, recognize, type Match, type Stroke, type Template } from '@/lib/handwriting/recognizer'
import { cn } from '@/lib/utils'

/**
 * Classic (paper) scoring box for one plate appearance.
 *
 * The scorer writes on the box like on a scorecard. Marks that feed statistics are taps:
 *   - tap a base path to darken it (runner reached that base); tap home = run scored
 *   - tap the lower-right corner to circle the out number (1, 2, 3)
 *   - tap the upper-left / upper-right corner to add a ball / strike dot
 * Ink is free: notation such as "6-3" or "K" is recognized against the lab samples and
 * always confirmed with Correcto / Corregir / Repetir. A stroke drawn from home plate
 * across the diamond is the batted ball: its end point is stored as the landing spot.
 */

export interface BaseRunners { first: boolean; second: boolean; third: boolean; home: boolean }

export interface ClassicAtBatPadProps {
  playerName: string
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

type Pt = [number, number]
const HOME: Pt = [50, 84]
const FIRST: Pt = [82, 52]
const SECOND: Pt = [50, 20]
const THIRD: Pt = [18, 52]
const OUT_MARK: Pt = [88, 89]
const TALLY = 5.5 // tally box size in units
const TALLY_GAP = 1.5
const BALL_BOXES: Pt[] = [0, 1, 2].map((i) => [5 + i * (TALLY + TALLY_GAP), 5])
const STRIKE_BOXES: Pt[] = [0, 1].map((i) => [95 - TALLY - i * (TALLY + TALLY_GAP), 5])
const inBox = (p: Pt, b: Pt) => p[0] >= b[0] - 1 && p[0] <= b[0] + TALLY + 1 && p[1] >= b[1] - 1 && p[1] <= b[1] + TALLY + 1
const TAP_LENGTH = 3 // units: shorter strokes are taps
const HIT_START_RADIUS = 13
const HIT_MIN_LENGTH = 18

const NONE: BaseRunners = { first: false, second: false, third: false, home: false }

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])
const strokeLength = (s: Stroke) => s.reduce((acc, p, i) => (i ? acc + dist(p as Pt, s[i - 1] as Pt) : 0), 0)

/** Tokens that put the batter on a base by themselves */
const TOKEN_BASE: Record<string, keyof BaseRunners> = {
  '1B': 'first', BB: 'first', HBP: 'first', E: 'first', FC: 'first', '2B': 'second', '3B': 'third', HR: 'home',
}
const OUT_TOKENS = new Set(['K', 'Kc', 'F', 'L', 'P', 'SF', 'SAC', 'DP', '6-3', '4-3', '5-3', '1-3', '3-1', '6-4-3', '4-6-3'])

/** Notation the scorebook already understands (see interpretHandwriting) */
function toScorebookNotation(token: string): string {
  if (token === 'Kc') return 'KC'
  const m = token.match(/^([FLP])([1-9])$/)
  if (m) return `${m[1]}-${m[2]}`
  return token
}

function landingData(p: Pt) {
  // Angle relative to home plate: left third = pull side for a right-handed hitter
  const dx = p[0] - HOME[0]
  const dy = HOME[1] - p[1]
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI // -90 (left line) .. +90 (right line)
  const d = dist(p, HOME)
  const side = angle < -20 ? 'LEFT' : angle > 20 ? 'RIGHT' : 'CENTER'
  const depth = d < 30 ? 'INFIELD' : d < 48 ? 'SHALLOW' : d < 62 ? 'MEDIUM' : 'DEEP'
  const fieldZone = depth === 'INFIELD' ? `INFIELD_${side}` : `${side}_FIELD_${depth}`
  return {
    fieldArea: depth === 'INFIELD' ? 'INFIELD' : `${side}_FIELD`,
    fieldZone,
    hitDistance: depth === 'INFIELD' ? 'SHORT' : depth === 'DEEP' ? 'DEEP' : 'MEDIUM',
    hitAngle: side === 'LEFT' ? 'PULL' : side === 'RIGHT' ? 'OPPO' : 'CENTER',
    xCoordinate: p[0],
    yCoordinate: p[1],
  }
}

export default function ClassicAtBatPad({ playerName, inning, existingAtBat, isLocked = false, onSave, onClose, onSwitchMode }: ClassicAtBatPadProps) {
  const { language } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)
  const penActive = useRef(false)

  const [ink, setInk] = useState<Stroke[]>([])
  const [hitLine, setHitLine] = useState<Stroke | null>(null)
  const [bases, setBases] = useState<BaseRunners>(NONE)
  const [outNumber, setOutNumber] = useState(0)
  const [balls, setBalls] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [rbi, setRbi] = useState(0)
  const [templates, setTemplates] = useState<Template[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [fixing, setFixing] = useState(false)
  const [saved, setSaved] = useState(false)

  const L = language === 'es'
    ? {
        title: 'Anotar turno', classic: 'Clásico', digital: 'Digital',
        hint: 'Escribe la jugada en la casilla. Toca una base para marcarla, el círculo para el out, y rellena las cajitas de bolas (B) y strikes (S). Traza la línea del batazo desde home.',
        recognized: 'Reconocido', nothing: 'Escribe la jugada…', noSamples: 'Sin muestras: elige la jugada de la lista.',
        correct: 'Correcto', fix: 'Corregir', redo: 'Repetir', pick: 'Elige la jugada', bases: 'Bases', out: 'Out', run: 'Carrera',
        landing: 'Batazo', noLanding: 'sin trazo', rbiLabel: 'Carreras impulsadas', save: 'Guardar turno', close: 'Cerrar', undo: 'Deshacer', clear: 'Borrar',
        locked: 'Juego cerrado: solo lectura.', savedOk: 'Turno guardado',
      }
    : {
        title: 'Score at-bat', classic: 'Classic', digital: 'Digital',
        hint: 'Write the play in the box. Tap a base to mark it, the circle for the out, and fill the small ball (B) and strike (S) boxes. Draw the batted-ball line from home.',
        recognized: 'Recognized', nothing: 'Write the play…', noSamples: 'No samples yet: pick the play from the list.',
        correct: 'Correct', fix: 'Fix', redo: 'Redo', pick: 'Pick the play', bases: 'Bases', out: 'Out', run: 'Run',
        landing: 'Batted ball', noLanding: 'no line', rbiLabel: 'Runs batted in', save: 'Save at-bat', close: 'Close', undo: 'Undo', clear: 'Clear',
        locked: 'Game locked: read only.', savedOk: 'At-bat saved',
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
      })
  }, [])

  // Prefill when editing an existing at-bat
  useEffect(() => {
    if (!existingAtBat) return
    const notation = String(existingAtBat.notation || existingAtBat.result || '')
    if (notation && notation !== 'DRAWING_SAVED') setToken(notation)
    const br = existingAtBat.base_runners as BaseRunners | undefined
    if (br) setBases({ ...NONE, ...br })
    if (typeof existingAtBat.rbi === 'number') setRbi(existingAtBat.rbi)
  }, [existingAtBat])

  // Recognize whenever the notation ink changes
  useEffect(() => {
    if (ink.length === 0) { setMatches([]); return }
    setMatches(recognize(ink, templates).slice(0, 3))
  }, [ink, templates])

  const top = matches[0]
  const description = useMemo(() => (token ? describeToken(token, language) : ''), [token, language])

  // ---- drawing ----------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const size = canvas.clientWidth
    if (canvas.width !== size * dpr) { canvas.width = size * dpr; canvas.height = size * dpr }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const u = (v: number) => (v * size) / 100
    ctx.clearRect(0, 0, size, size)

    // diamond
    const pencil = '#1f2937'
    ctx.strokeStyle = 'rgba(100,116,139,0.55)'
    ctx.lineWidth = Math.max(1, u(0.6))
    ctx.beginPath()
    ctx.moveTo(u(HOME[0]), u(HOME[1])); ctx.lineTo(u(FIRST[0]), u(FIRST[1])); ctx.lineTo(u(SECOND[0]), u(SECOND[1])); ctx.lineTo(u(THIRD[0]), u(THIRD[1])); ctx.closePath()
    ctx.stroke()
    // filled base paths
    ctx.strokeStyle = pencil
    ctx.lineWidth = u(2.2)
    ctx.lineCap = 'round'
    const seg = (a: Pt, b: Pt) => { ctx.beginPath(); ctx.moveTo(u(a[0]), u(a[1])); ctx.lineTo(u(b[0]), u(b[1])); ctx.stroke() }
    if (bases.first || bases.second || bases.third || bases.home) seg(HOME, FIRST)
    if (bases.second || bases.third || bases.home) seg(FIRST, SECOND)
    if (bases.third || bases.home) seg(SECOND, THIRD)
    if (bases.home) {
      seg(THIRD, HOME)
      ctx.fillStyle = 'rgba(31,41,55,0.85)'
      ctx.beginPath()
      ctx.moveTo(u(50), u(60)); ctx.lineTo(u(58), u(52)); ctx.lineTo(u(50), u(44)); ctx.lineTo(u(42), u(52)); ctx.closePath()
      ctx.fill()
    }
    // base squares
    ctx.fillStyle = '#fffdf7'
    ctx.strokeStyle = 'rgba(100,116,139,0.7)'
    ctx.lineWidth = Math.max(1, u(0.5))
    for (const b of [FIRST, SECOND, THIRD]) { ctx.beginPath(); ctx.rect(u(b[0]) - u(3), u(b[1]) - u(3), u(6), u(6)); ctx.fill(); ctx.stroke() }
    // home plate
    ctx.beginPath()
    ctx.moveTo(u(46), u(81)); ctx.lineTo(u(54), u(81)); ctx.lineTo(u(54), u(85)); ctx.lineTo(u(50), u(89)); ctx.lineTo(u(46), u(85)); ctx.closePath()
    ctx.fill(); ctx.stroke()
    // out marker
    ctx.strokeStyle = outNumber ? pencil : 'rgba(148,163,184,0.5)'
    ctx.lineWidth = outNumber ? u(1.4) : Math.max(1, u(0.5))
    ctx.setLineDash(outNumber ? [] : [3, 3])
    ctx.beginPath(); ctx.arc(u(OUT_MARK[0]), u(OUT_MARK[1]), u(6.5), 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = outNumber ? pencil : 'rgba(148,163,184,0.8)'
    ctx.font = `700 ${Math.round(u(8))}px ui-sans-serif, system-ui`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(outNumber ? String(outNumber) : 'O', u(OUT_MARK[0]), u(OUT_MARK[1]) + u(0.5))
    // ball / strike tally boxes, filled with pencil like on paper
    const boxes = (list: Pt[], n: number) => {
      list.forEach((b, i) => {
        ctx.beginPath()
        ctx.rect(u(b[0]), u(b[1]), u(TALLY), u(TALLY))
        ctx.fillStyle = i < n ? 'rgba(31,41,55,0.85)' : '#fffdf7'
        ctx.fill()
        ctx.strokeStyle = 'rgba(100,116,139,0.8)'
        ctx.lineWidth = Math.max(1, u(0.5))
        ctx.stroke()
      })
    }
    boxes(BALL_BOXES, balls)
    boxes(STRIKE_BOXES, strikes)
    ctx.fillStyle = 'rgba(100,116,139,0.9)'
    ctx.font = `600 ${Math.round(u(3.5))}px ui-sans-serif, system-ui`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'; ctx.fillText('B', u(BALL_BOXES[0][0]), u(BALL_BOXES[0][1] + TALLY + 3.5))
    ctx.textAlign = 'right'; ctx.fillText('S', u(STRIKE_BOXES[0][0] + TALLY), u(STRIKE_BOXES[0][1] + TALLY + 3.5))
    // hit line
    const strokePath = (s: Stroke, color: string, width: number) => {
      if (!s.length) return
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(u(s[0][0]), u(s[0][1]))
      for (let i = 1; i < s.length; i++) ctx.lineTo(u(s[i][0]), u(s[i][1]))
      if (s.length === 1) ctx.lineTo(u(s[0][0]) + 0.1, u(s[0][1]))
      ctx.stroke()
    }
    if (hitLine) {
      strokePath(hitLine, '#b45309', u(1.6))
      const end = hitLine[hitLine.length - 1]
      ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(u(end[0]), u(end[1]), u(2.2), 0, Math.PI * 2); ctx.fill()
    }
    // notation ink
    for (const s of ink) strokePath(s, pencil, u(2.4))
    if (drawing.current) strokePath(drawing.current, pencil, u(2.4))
  }, [ink, hitLine, bases, outNumber, balls, strikes])

  useEffect(() => {
    draw()
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  const toUnits = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, Math.round(((e.clientY - r.top) / r.height) * 1000) / 10]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isLocked || saved) return
    if (e.pointerType === 'pen') penActive.current = true
    if (penActive.current && e.pointerType === 'touch') return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = [toUnits(e)]
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    if (penActive.current && e.pointerType === 'touch') return
    const p = toUnits(e)
    const last = drawing.current[drawing.current.length - 1] as Pt
    if (dist(p, last) < 0.6) return
    drawing.current.push(p)
    draw()
  }
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = drawing.current
    drawing.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* released */ }
    if (!stroke) return
    const start = stroke[0] as Pt
    const end = stroke[stroke.length - 1] as Pt
    const length = strokeLength(stroke)
    if (length < TAP_LENGTH) {
      handleTap(start)
      draw()
      return
    }
    if (dist(start, HOME) < HIT_START_RADIUS && length >= HIT_MIN_LENGTH && dist(end, HOME) > HIT_MIN_LENGTH) {
      setHitLine(stroke)
      return
    }
    setInk((prev) => [...prev, stroke])
    setToken(null)
    setFixing(false)
  }

  function handleTap(p: Pt) {
    const r = 9
    if (dist(p, FIRST) < r) return setBases((b) => ({ ...b, first: !b.first, home: false }))
    if (dist(p, SECOND) < r) return setBases((b) => ({ ...b, second: !b.second, home: false }))
    if (dist(p, THIRD) < r) return setBases((b) => ({ ...b, third: !b.third, home: false }))
    if (dist(p, HOME) < r || dist(p, [50, 52]) < 9) return setBases((b) => (b.home ? NONE : { first: true, second: true, third: true, home: true }))
    if (dist(p, OUT_MARK) < r) return setOutNumber((n) => (n + 1) % 4)
    const bi = BALL_BOXES.findIndex((b) => inBox(p, b))
    if (bi >= 0) return setBalls((n) => (n >= bi + 1 ? bi : bi + 1))
    const si = STRIKE_BOXES.findIndex((b) => inBox(p, b))
    if (si >= 0) return setStrikes((n) => (n >= si + 1 ? si : si + 1))
  }

  // Bases implied by the confirmed token (unless the scorer already tapped bases)
  useEffect(() => {
    if (!token) return
    const base = TOKEN_BASE[token]
    setBases((b) => {
      if (b.first || b.second || b.third || b.home) return b
      if (!base) return b
      if (base === 'home') return { first: true, second: true, third: true, home: true }
      return { ...NONE, [base]: true }
    })
    if (OUT_TOKENS.has(token)) setOutNumber((n) => (n === 0 ? 1 : n))
    if (token === 'HR') setRbi((r) => (r === 0 ? 1 : r))
  }, [token])

  const canSave = !!token && !isLocked && !saved

  function save() {
    if (!token) return
    const runners: BaseRunners = bases.home ? { first: false, second: false, third: false, home: true } : bases
    const location = hitLine ? landingData(hitLine[hitLine.length - 1] as Pt) : undefined
    onSave(toScorebookNotation(token), runners, location, NONE, { first: '', second: '', third: '', home: '' }, rbi)
    setSaved(true)
  }

  const modeSwitch = (
    <div className="inline-flex items-center rounded-lg bg-secondary p-0.5">
      <button type="button" aria-pressed className="rounded-md bg-card px-3 py-1 text-xs font-semibold shadow-sm">{L.classic}</button>
      <button type="button" onClick={onSwitchMode} className="rounded-md px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">{L.digital}</button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-tight">{L.title} · {playerName} <span className="text-muted-foreground">({language === 'es' ? 'Entrada' : 'Inning'} {inning})</span></h3>
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{L.hint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {modeSwitch}
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={L.close}><X /></Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-6">
          {/* The box */}
          <div className="space-y-2">
            <canvas
              ref={canvasRef}
              className={cn('aspect-square w-full touch-none rounded-2xl border-2 border-slate-400 bg-[#fffdf7] shadow-inner', (isLocked || saved) && 'opacity-70')}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerUp}
              aria-label="Scorecard box"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={ink.length === 0} onClick={() => { setInk(ink.slice(0, -1)); setToken(null) }}><Undo2 />{L.undo}</Button>
                <Button variant="outline" size="sm" onClick={() => { setInk([]); setHitLine(null); setToken(null); setMatches([]); setFixing(false) }}><Eraser />{L.clear}</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant={bases.home ? 'success' : 'outline'}>{L.run}{bases.home ? ' ✓' : ''}</Badge>
                <Badge variant={outNumber ? 'danger' : 'outline'}>{L.out} {outNumber || '–'}</Badge>
                <Badge variant={hitLine ? 'warning' : 'outline'}>{L.landing}: {hitLine ? `${Math.round(hitLine[hitLine.length - 1][0])},${Math.round(hitLine[hitLine.length - 1][1])}` : L.noLanding}</Badge>
              </div>
            </div>
          </div>

          {/* Recognition + confirmation */}
          <div className="space-y-4">
            {isLocked && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{L.locked}</div>}
            <div className="rounded-xl border border-border bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.recognized}</p>
              {token ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold tabular-nums">{token}</span>
                  <span className="text-sm text-muted-foreground">{description}</span>
                  <Check className="size-5 text-emerald-600" />
                </div>
              ) : ink.length === 0 ? (
                <p className="text-sm text-muted-foreground">{L.nothing}</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{L.noSamples}</p>
              ) : matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold tabular-nums">{top.symbol}</span>
                    <span className="text-sm text-muted-foreground">{describeToken(top.symbol, language)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matches.map((m, i) => (
                      <Badge key={m.symbol} variant={i === 0 ? (m.score > 0.7 ? 'success' : 'warning') : 'outline'}>{m.symbol} · {Math.round(m.score * 100)}%</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!token && ink.length > 0 && !fixing && (
              <div className="flex flex-wrap gap-2">
                <Button variant="success" size="lg" disabled={!top} onClick={() => top && setToken(top.symbol)}><Check />{L.correct}</Button>
                <Button variant="outline" size="lg" onClick={() => setFixing(true)}><PenTool />{L.fix}</Button>
                <Button variant="ghost" size="lg" onClick={() => { setInk([]); setMatches([]) }}><RotateCcw />{L.redo}</Button>
              </div>
            )}

            {(fixing || (!token && (ink.length === 0 || templates.length === 0))) && (
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
