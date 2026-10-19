'use client'
import { useId, useRef } from 'react'
import { HOME, type Pt } from '@/lib/scorecard/geometry'
import { validHitLocation } from '@/lib/scorecard/hitLocation'
import FieldSvg from './FieldSvg'

export default function HitLocationPicker({ value, onChange, onConfirm, disabled, language }: {
  value: Pt | null; onChange: (point: Pt | null) => void; onConfirm: () => void; disabled?: boolean; language: 'en' | 'es'
}) {
  const es = language === 'es', id = useId(), dragging = useRef(false)
  const valid = validHitLocation(value)
  function mark(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const point: Pt = [Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100)), Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100))]
    onChange(validHitLocation(point) ? point : null)
  }
  return <section aria-labelledby={id} className="rounded-xl border-2 border-blue-600 bg-blue-50 p-3 text-slate-900">
    <h3 id={id} className="text-lg font-bold">{es ? '2 · ¿Hacia dónde fue el batazo?' : '2 · Where was the ball hit?'}</h3>
    <p className="my-2 text-sm">{es ? 'Toca donde cayó o terminó la pelota, o traza desde home. La línea guardará su dirección antes de revisar corredores.' : 'Tap where the ball landed or ended, or drag from home. Save its direction before reviewing runners.'}</p>
    <div className="relative mx-auto aspect-square w-full max-w-sm rounded-lg border border-slate-300 bg-white">
      <FieldSvg className="absolute inset-0 size-full" view="full" />
      <svg role="application" aria-label={es ? 'Marcar dirección del batazo. Usa las flechas y Enter, o toca el campo.' : 'Mark ball direction. Use arrow keys and Enter, or tap the field.'} tabIndex={disabled ? -1 : 0} viewBox="0 0 100 100" className="relative size-full touch-none cursor-crosshair rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
        onPointerDown={e => { if (disabled || !e.isPrimary || e.button !== 0) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); mark(e) }}
        onPointerMove={e => { if (dragging.current && !disabled) mark(e) }}
        onPointerUp={e => { if (!dragging.current) return; mark(e); dragging.current = false; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }}
        onPointerCancel={() => { dragging.current = false }} onLostPointerCapture={() => { dragging.current = false }}
        onKeyDown={e => { if (disabled) return; if (e.key === 'Enter' && valid) { e.preventDefault(); onConfirm(); return } const delta: Record<string, Pt> = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }; const d = delta[e.key]; if (d) { e.preventDefault(); const p = value ?? [50, 50]; onChange([Math.max(0, Math.min(100, p[0] + d[0])), Math.max(0, Math.min(100, p[1] + d[1]))]) } }}>
        {valid && <><line x1={HOME[0]} y1={HOME[1]} x2={value[0]} y2={value[1]} stroke="#1d4ed8" strokeWidth="1.6" /><circle cx={value[0]} cy={value[1]} r="2" fill="#1d4ed8" /></>}
      </svg>
    </div>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={disabled || !valid} onClick={onConfirm} className="min-h-12 rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-40">{es ? 'Confirmar trayectoria · continuar' : 'Confirm trajectory · continue'}</button><button type="button" disabled={disabled || !value} onClick={() => onChange(null)} className="min-h-12 rounded-lg border border-slate-400 bg-white px-3">{es ? 'Borrar dirección' : 'Clear direction'}</button></div>
  </section>
}
