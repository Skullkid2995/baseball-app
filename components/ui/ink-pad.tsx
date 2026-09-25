'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Stroke } from '@/lib/handwriting/recognizer'

export interface InkPadProps {
  strokes: Stroke[]
  onChange: (strokes: Stroke[]) => void
  /** Called when a stroke ends, with the pointer type used (pen, touch, mouse). */
  onDrawingChange?: (drawing: boolean) => void
  onStrokeEnd?: (pointerType: string) => void
  className?: string
  /** Faint guide text drawn in the middle of the pad. */
  hint?: string
  disabled?: boolean
  /** Pen color and width in CSS pixels at 100-unit box scale. */
  color?: string
  width?: number
}

/**
 * A square drawing surface that records strokes in 0-100 box units.
 * Pointer Events so pen, finger and mouse all work; when a pen is in use,
 * touch input is ignored so the palm can rest on the screen.
 */
export function InkPad({ strokes, onChange, onStrokeEnd, onDrawingChange, className, hint, disabled, color = '#1f2937', width = 3 }: InkPadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const drawing = React.useRef<Stroke | null>(null)
  const activePointerId = React.useRef<number | null>(null)
  const penActive = React.useRef(false)
  const lastPointerType = React.useRef('mouse')

  const toUnits = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect()
    return [
      Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
    ]
  }

  // Redraw everything whenever strokes change (or on resize)
  const draw = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const size = canvas.clientWidth
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr
      canvas.height = size * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    // paper guides
    ctx.strokeStyle = 'rgba(148,163,184,0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2)
    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size)
    ctx.stroke()
    ctx.setLineDash([])
    if (hint && strokes.length === 0) {
      ctx.fillStyle = 'rgba(148,163,184,0.5)'
      ctx.font = `600 ${Math.round(size * 0.28)}px ui-sans-serif, system-ui`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(hint, size / 2, size / 2)
    }
    // ink
    ctx.strokeStyle = color
    ctx.lineWidth = (width * size) / 100
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const all = drawing.current ? [...strokes, drawing.current] : strokes
    for (const s of all) {
      if (s.length === 0) continue
      ctx.beginPath()
      ctx.moveTo((s[0][0] * size) / 100, (s[0][1] * size) / 100)
      for (let i = 1; i < s.length; i++) ctx.lineTo((s[i][0] * size) / 100, (s[i][1] * size) / 100)
      if (s.length === 1) ctx.lineTo((s[0][0] * size) / 100 + 0.1, (s[0][1] * size) / 100)
      ctx.stroke()
    }
  }, [strokes, hint, color, width])

  React.useEffect(() => {
    draw()
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || drawing.current) return
    if (e.pointerType === 'pen') penActive.current = true
    if (penActive.current && e.pointerType === 'touch') return // palm rejection
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
    const last = drawing.current[drawing.current.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.6) return // skip jitter
    drawing.current.push(p)
    draw()
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || e.pointerId !== activePointerId.current) return
    const stroke = drawing.current
    drawing.current = null
    activePointerId.current = null
    if (stroke.length >= 1) onChange([...strokes, stroke])
    onStrokeEnd?.(lastPointerType.current)
    onDrawingChange?.(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'aspect-square w-full touch-none rounded-2xl border-2 border-slate-300 bg-[#fffdf7] shadow-inner',
        disabled && 'opacity-60',
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onPointerLeave={endStroke}
      aria-label="Ink pad"
    />
  )
}
