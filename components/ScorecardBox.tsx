'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Stroke } from '@/lib/handwriting/recognizer'
import type { BoxAction, BoxMarks } from '@/lib/scorecard/interpret'
import {
  BALL_BOXES, FENCE_RADIUS, FIELDERS, FIRST, HOME, LEFT_POLE, MOUND, OUT_MARK, RIGHT_POLE, SECOND, STRIKE_BOXES, TALLY,
  TAP_LENGTH, THIRD, dist, strokeLength, type Pt,
} from '@/lib/scorecard/geometry'
import { cn } from '@/lib/utils'
import { notationInk } from '@/lib/scorecard/notationInk'

export interface ScorecardBoxProps {
  actions: BoxAction[]
  onChange: (actions: BoxAction[]) => void
  /** interpretation of the actions (from interpretBox) */
  marks: BoxMarks
  /** Selected result, rendered as pencil strokes when the scorer used the buttons. */
  notation?: string
  disabled?: boolean
  className?: string
  onPointerType?: (pointerType: string) => void
  onDrawingChange?: (drawing: boolean) => void
}

const PENCIL = '#1f2937'

/**
 * The classic scorecard box: a square canvas showing a proportioned field
 * (foul lines, outfield to the fence, infield diamond). It records strokes and
 * taps in 0-100 units and paints the marks the interpreter derived from them.
 * Pen input gets palm rejection (touch is ignored while a pen is in use).
 */
export default function ScorecardBox({ actions, onChange, marks, notation, disabled = false, className, onPointerType, onDrawingChange }: ScorecardBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)
  const penActive = useRef(false)
  const lastPointerType = useRef('mouse')
  const activePointerId = useRef<number | null>(null)

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
    const P = (p: Pt): [number, number] => [u(p[0]), u(p[1])]
    ctx.clearRect(0, 0, size, size)

    // ---- field ----
    const fenceStart = Math.atan2(LEFT_POLE[1] - HOME[1], LEFT_POLE[0] - HOME[0])
    const fenceEnd = Math.atan2(RIGHT_POLE[1] - HOME[1], RIGHT_POLE[0] - HOME[0])
    // fair territory
    ctx.beginPath()
    ctx.moveTo(...P(HOME))
    ctx.lineTo(...P(LEFT_POLE))
    ctx.arc(u(HOME[0]), u(HOME[1]), u(FENCE_RADIUS), fenceStart, fenceEnd, false)
    ctx.closePath()
    ctx.fillStyle = '#e6f0e2'
    ctx.fill()
    // infield dirt
    ctx.beginPath()
    ctx.moveTo(...P(HOME))
    ctx.lineTo(u(FIRST[0] + 8), u(FIRST[1] - 8))
    ctx.arc(u(HOME[0]), u(HOME[1]), u(dist(HOME, [FIRST[0] + 8, FIRST[1] - 8])), Math.atan2(FIRST[1] - 8 - HOME[1], FIRST[0] + 8 - HOME[0]), Math.atan2(THIRD[1] - 8 - HOME[1], THIRD[0] - 8 - HOME[0]), true)
    ctx.closePath()
    ctx.fillStyle = '#eee3cf'
    ctx.fill()
    // infield grass
    ctx.beginPath()
    ctx.moveTo(u(HOME[0]), u(HOME[1] - 3)); ctx.lineTo(u(FIRST[0] - 3), u(FIRST[1])); ctx.lineTo(u(SECOND[0]), u(SECOND[1] + 3)); ctx.lineTo(u(THIRD[0] + 3), u(THIRD[1])); ctx.closePath()
    ctx.fillStyle = '#d9e9d2'
    ctx.fill()
    // fence + foul lines + base paths
    ctx.strokeStyle = 'rgba(71,85,105,0.8)'
    ctx.lineWidth = Math.max(1, u(0.7))
    ctx.beginPath(); ctx.arc(u(HOME[0]), u(HOME[1]), u(FENCE_RADIUS), fenceStart, fenceEnd, false); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(...P(HOME)); ctx.lineTo(...P(LEFT_POLE)); ctx.moveTo(...P(HOME)); ctx.lineTo(...P(RIGHT_POLE)); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(...P(HOME)); ctx.lineTo(...P(FIRST)); ctx.lineTo(...P(SECOND)); ctx.lineTo(...P(THIRD)); ctx.closePath(); ctx.stroke()
    // fielder numbers
    ctx.fillStyle = 'rgba(100,116,139,0.6)'
    ctx.font = `600 ${Math.round(u(3.6))}px ui-sans-serif, system-ui`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (const f of FIELDERS) ctx.fillText(String(f.n), u(f.at[0]), u(f.at[1]))

    // ---- marks: base paths reached ----
    const { bases } = marks
    ctx.strokeStyle = PENCIL
    ctx.lineWidth = u(2)
    ctx.lineCap = 'round'
    const seg = (a: Pt, b: Pt) => { ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke() }
    if (bases.first || bases.second || bases.third || bases.home) seg(HOME, FIRST)
    if (bases.second || bases.third || bases.home) seg(FIRST, SECOND)
    if (bases.third || bases.home) seg(SECOND, THIRD)
    if (bases.home) {
      seg(THIRD, HOME)
      ctx.fillStyle = 'rgba(31,41,55,0.85)'
      ctx.beginPath()
      ctx.moveTo(u(50), u(80)); ctx.lineTo(u(56), u(74)); ctx.lineTo(u(50), u(68)); ctx.lineTo(u(44), u(74)); ctx.closePath()
      ctx.fill()
    }

    // mound, bases and home plate on top of the marks
    ctx.fillStyle = '#eee3cf'; ctx.strokeStyle = 'rgba(148,163,184,0.9)'; ctx.lineWidth = Math.max(1, u(0.4))
    ctx.beginPath(); ctx.arc(u(MOUND[0]), u(MOUND[1]), u(2.2), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(71,85,105,0.9)'; ctx.lineWidth = Math.max(1, u(0.5))
    for (const b of [FIRST, SECOND, THIRD]) {
      ctx.save(); ctx.translate(u(b[0]), u(b[1])); ctx.rotate(Math.PI / 4)
      ctx.beginPath(); ctx.rect(-u(2.2), -u(2.2), u(4.4), u(4.4)); ctx.fill(); ctx.stroke(); ctx.restore()
    }
    ctx.beginPath()
    ctx.moveTo(u(HOME[0] - 2.5), u(HOME[1] - 2)); ctx.lineTo(u(HOME[0] + 2.5), u(HOME[1] - 2)); ctx.lineTo(u(HOME[0] + 2.5), u(HOME[1])); ctx.lineTo(u(HOME[0]), u(HOME[1] + 2.5)); ctx.lineTo(u(HOME[0] - 2.5), u(HOME[1])); ctx.closePath()
    ctx.fill(); ctx.stroke()

    // ---- out marker ----
    const { outNumber } = marks
    ctx.strokeStyle = outNumber ? PENCIL : 'rgba(148,163,184,0.6)'
    ctx.lineWidth = outNumber ? u(1.2) : Math.max(1, u(0.5))
    ctx.setLineDash(outNumber ? [] : [3, 3])
    ctx.beginPath(); ctx.arc(u(OUT_MARK[0]), u(OUT_MARK[1]), u(6), 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = outNumber ? PENCIL : 'rgba(148,163,184,0.9)'
    ctx.font = `700 ${Math.round(u(7))}px ui-sans-serif, system-ui`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(outNumber ? String(outNumber) : 'O', u(OUT_MARK[0]), u(OUT_MARK[1]) + u(0.4))

    // ---- tally boxes: never filled; a marked box carries a pencil mark, as on paper ----
    const inkOver = (b: Pt) => marks.tallyStrokes.some((s) => s.some((p) => p[0] >= b[0] - 1 && p[0] <= b[0] + TALLY + 1 && p[1] <= b[1] + TALLY + 1))
    const boxes = (list: Pt[], marked: boolean[]) => {
      list.forEach((b, i) => {
        ctx.beginPath()
        ctx.rect(u(b[0]), u(b[1]), u(TALLY), u(TALLY))
        ctx.fillStyle = marked[i] ? 'rgba(191,219,254,0.45)' : '#fffdf7'
        ctx.fill()
        ctx.strokeStyle = marked[i] ? 'rgba(31,41,55,0.9)' : 'rgba(100,116,139,0.8)'
        ctx.lineWidth = Math.max(1, u(marked[i] ? 0.7 : 0.5))
        ctx.stroke()
        // tapped (no ink of its own): a pencil slash so it reads as marked, not filled
        if (marked[i] && !inkOver(b)) {
          ctx.strokeStyle = PENCIL
          ctx.lineWidth = u(1.4)
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(u(b[0] + 1.5), u(b[1] + TALLY - 1.5))
          ctx.lineTo(u(b[0] + TALLY - 1.5), u(b[1] + 1.5))
          ctx.stroke()
        }
      })
    }
    boxes(BALL_BOXES, marks.ballMarks)
    boxes(STRIKE_BOXES, marks.strikeMarks)
    ctx.fillStyle = 'rgba(100,116,139,0.9)'
    ctx.font = `600 ${Math.round(u(3.5))}px ui-sans-serif, system-ui`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'; ctx.fillText('B', u(BALL_BOXES[0][0]), u(BALL_BOXES[0][1] + TALLY + 3.5))
    ctx.textAlign = 'right'; ctx.fillText('S', u(STRIKE_BOXES[0][0] + TALLY), u(STRIKE_BOXES[0][1] + TALLY + 3.5))

    // ---- strokes ----
    const strokePath = (s: Stroke, color: string, width: number) => {
      if (!s.length) return
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(u(s[0][0]), u(s[0][1]))
      for (let i = 1; i < s.length; i++) ctx.lineTo(u(s[i][0]), u(s[i][1]))
      if (s.length === 1) ctx.lineTo(u(s[0][0]) + 0.1, u(s[0][1]))
      ctx.stroke()
    }
    if (marks.hitLine) {
      strokePath(marks.hitLine, '#b45309', u(1.5))
      const end = marks.hitLine[marks.hitLine.length - 1]
      ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.arc(u(end[0]), u(end[1]), u(2), 0, Math.PI * 2); ctx.fill()
    }
    for (const s of marks.outCircles) strokePath(s, 'rgba(31,41,55,0.6)', u(1.2))
    for (const s of marks.outDigitStrokes) strokePath(s, 'rgba(31,41,55,0.6)', u(1.2))
    for (const s of marks.tallyStrokes) strokePath(s, PENCIL, u(1.6))
    // Keep generated pencil notation separate from user input and calibration samples.
    if (notation && !marks.ink.length) for (const s of notationInk(notation)) strokePath(s, PENCIL, u(1.1))
    for (const s of marks.ink) strokePath(s, PENCIL, u(2.2))
    if (drawing.current) strokePath(drawing.current, PENCIL, u(2.2))
  }, [marks, notation])

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
    if (disabled || drawing.current) return
    if (e.pointerType === 'pen') penActive.current = true
    if (penActive.current && e.pointerType === 'touch') return
    lastPointerType.current = e.pointerType
    activePointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = [toUnits(e)]
    onDrawingChange?.(true)
    draw()
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || e.pointerId !== activePointerId.current) return
    if (penActive.current && e.pointerType === 'touch') return
    const p = toUnits(e)
    const last = drawing.current[drawing.current.length - 1] as Pt
    if (dist(p, last) < 0.6) return
    drawing.current.push(p)
    draw()
  }
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== activePointerId.current) return
    const stroke = drawing.current
    drawing.current = null
    activePointerId.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* released */ }
    if (!stroke) return
    onPointerType?.(lastPointerType.current)
    if (strokeLength(stroke) < TAP_LENGTH) onChange([...actions, { type: 'tap', point: stroke[0] as Pt }])
    else onChange([...actions, { type: 'stroke', points: stroke }])
    onDrawingChange?.(false)
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn('aspect-square w-full touch-none rounded-2xl border-2 border-slate-400 bg-[#fffdf7] shadow-inner', disabled && 'opacity-70', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      aria-label="Scorecard box"
    />
  )
}
