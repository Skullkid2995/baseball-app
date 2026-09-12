'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Stroke } from '@/lib/handwriting/recognizer'
import type { BoxAction, BoxMarks } from '@/lib/scorecard/interpret'
import {
  BALL_BOXES, FENCE_RADIUS, FIELDERS, FIRST, HOME, LEFT_POLE, MOUND, OUT_MARK, RIGHT_POLE, SECOND, STRIKE_BOXES, TALLY,
  TAP_LENGTH, THIRD, dist, strokeLength, type Pt,
} from '@/lib/scorecard/geometry'
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
 * The classic scorecard box: a square canvas showing a proportioned field
 * (foul lines, outfield to the fence, infield diamond). It records strokes and
 * taps in 0-100 units and paints the marks the interpreter derived from them.
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

    // ---- tally boxes ----
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
    for (const s of marks.ink) strokePath(s, PENCIL, u(2.2))
    if (drawing.current) strokePath(drawing.current, PENCIL, u(2.2))
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
