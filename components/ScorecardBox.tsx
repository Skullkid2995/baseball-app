'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Stroke } from '@/lib/handwriting/recognizer'
import type { BoxAction, BoxMarks } from '@/lib/scorecard/interpret'
import { BALL_BOXES, FIRST, HOME, OUT_MARK, SECOND, STRIKE_BOXES, TALLY, TAP_LENGTH, THIRD, dist, strokeLength, type Pt } from '@/lib/scorecard/geometry'
import { cn } from '@/lib/utils'

export interface ScorecardBoxProps {
  actions: BoxAction[]
  onChange: (actions: BoxAction[]) => void
  /** interpretation of the actions (from interpretBox) */
  marks: BoxMarks
  disabled?: boolean
  className?: string
  onPointerType?: (pointerType: string) => void
}

const PENCIL = '#1f2937'

/**
 * The classic scorecard box: a square canvas that records strokes and taps in
 * 0-100 units and paints the marks the interpreter derived from them.
 * Pen input gets palm rejection (touch is ignored while a pen is in use).
 */
export default function ScorecardBox({ actions, onChange, marks, disabled = false, className, onPointerType }: ScorecardBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)
  const penActive = useRef(false)
  const lastPointerType = useRef('mouse')

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const size = canvas.clientWidth
    if (!size) return
    const target = Math.round(size * dpr)
    if (canvas.width !== target) { canvas.width = target; canvas.height = target }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const u = (v: number) => (v * size) / 100
    ctx.clearRect(0, 0, size, size)

    // diamond guide
    ctx.strokeStyle = 'rgba(100,116,139,0.55)'
    ctx.lineWidth = Math.max(1, u(0.6))
    ctx.beginPath()
    ctx.moveTo(u(HOME[0]), u(HOME[1])); ctx.lineTo(u(FIRST[0]), u(FIRST[1])); ctx.lineTo(u(SECOND[0]), u(SECOND[1])); ctx.lineTo(u(THIRD[0]), u(THIRD[1])); ctx.closePath()
    ctx.stroke()

    // base paths reached (pencil)
    const { bases } = marks
    ctx.strokeStyle = PENCIL
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

    // base squares and home plate
    ctx.fillStyle = '#fffdf7'
    ctx.strokeStyle = 'rgba(100,116,139,0.7)'
    ctx.lineWidth = Math.max(1, u(0.5))
    for (const b of [FIRST, SECOND, THIRD]) { ctx.beginPath(); ctx.rect(u(b[0]) - u(3), u(b[1]) - u(3), u(6), u(6)); ctx.fill(); ctx.stroke() }
    ctx.beginPath()
    ctx.moveTo(u(46), u(81)); ctx.lineTo(u(54), u(81)); ctx.lineTo(u(54), u(85)); ctx.lineTo(u(50), u(89)); ctx.lineTo(u(46), u(85)); ctx.closePath()
    ctx.fill(); ctx.stroke()

    // out marker
    const { outNumber } = marks
    ctx.strokeStyle = outNumber ? PENCIL : 'rgba(148,163,184,0.5)'
    ctx.lineWidth = outNumber ? u(1.4) : Math.max(1, u(0.5))
    ctx.setLineDash(outNumber ? [] : [3, 3])
    ctx.beginPath(); ctx.arc(u(OUT_MARK[0]), u(OUT_MARK[1]), u(6.5), 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = outNumber ? PENCIL : 'rgba(148,163,184,0.8)'
    ctx.font = `700 ${Math.round(u(8))}px ui-sans-serif, system-ui`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(outNumber ? String(outNumber) : 'O', u(OUT_MARK[0]), u(OUT_MARK[1]) + u(0.5))

    // tally boxes
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
    boxes(BALL_BOXES, marks.balls)
    boxes(STRIKE_BOXES, marks.strikes)
    ctx.fillStyle = 'rgba(100,116,139,0.9)'
    ctx.font = `600 ${Math.round(u(3.5))}px ui-sans-serif, system-ui`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'; ctx.fillText('B', u(BALL_BOXES[0][0]), u(BALL_BOXES[0][1] + TALLY + 3.5))
    ctx.textAlign = 'right'; ctx.fillText('S', u(STRIKE_BOXES[0][0] + TALLY), u(STRIKE_BOXES[0][1] + TALLY + 3.5))

    // strokes
    const strokePath = (s: Stroke, color: string, width: number) => {
      if (!s.length) return
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(u(s[0][0]), u(s[0][1]))
      for (let i = 1; i < s.length; i++) ctx.lineTo(u(s[i][0]), u(s[i][1]))
      if (s.length === 1) ctx.lineTo(u(s[0][0]) + 0.1, u(s[0][1]))
      ctx.stroke()
    }
    if (marks.hitLine) {
      strokePath(marks.hitLine, '#b45309', u(1.6))
      const end = marks.hitLine[marks.hitLine.length - 1]
      ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(u(end[0]), u(end[1]), u(2.2), 0, Math.PI * 2); ctx.fill()
    }
    for (const s of marks.outCircles) strokePath(s, 'rgba(31,41,55,0.6)', u(1.2))
    for (const s of marks.ink) strokePath(s, PENCIL, u(2.4))
    if (drawing.current) strokePath(drawing.current, PENCIL, u(2.4))
  }, [marks])

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
    if (disabled) return
    if (e.pointerType === 'pen') penActive.current = true
    if (penActive.current && e.pointerType === 'touch') return
    lastPointerType.current = e.pointerType
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
    onPointerType?.(lastPointerType.current)
    if (strokeLength(stroke) < TAP_LENGTH) onChange([...actions, { type: 'tap', point: stroke[0] as Pt }])
    else onChange([...actions, { type: 'stroke', points: stroke }])
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn('aspect-square w-full touch-none rounded-2xl border-2 border-slate-400 bg-[#fffdf7] shadow-inner', disabled && 'opacity-70', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      aria-label="Scorecard box"
    />
  )
}
