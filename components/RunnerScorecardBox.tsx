'use client'
import { useRef, useState } from 'react'
import type { BoxAction } from '@/lib/scorecard/interpret'
import type { Pt } from '@/lib/scorecard/geometry'
import type { ActiveRunner } from '@/lib/scorecard/runners'
import { RUNNER_DIAMOND, RUNNER_OUT, runnerDrawing } from '@/lib/scorecard/runnerDrawing'

export default function RunnerScorecardBox({ runner, actions, onChange, disabled, language, onDrawingChange, onHold, reviewed, requireHoldConfirmation = true }: {
  runner: ActiveRunner; actions: BoxAction[]; onChange: (actions: BoxAction[]) => void
  requireHoldConfirmation?: boolean
  onHold: () => void; reviewed: boolean
  disabled: boolean; language: 'en' | 'es'; onDrawingChange: (active: boolean) => void
}) {
  const [ink, setInk] = useState<Pt[]>([])
  const current = useRef<{ id: number; points: Pt[] } | null>(null)
  const drawing = runnerDrawing(runner, actions)
  const es = language === 'es'
  const point = (e: React.PointerEvent<SVGSVGElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect()
    return [(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100]
  }
  const finish = (e: React.PointerEvent<SVGSVGElement>, cancel = false) => {
    if (e.pointerId !== current.current?.id) return
    const points = current.current.points
    current.current = null; setInk([]); onDrawingChange(false)
    if (!cancel) onChange([...actions, points.length < 2 ? { type:'tap', point:points[0] } : { type:'stroke', points }])
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const status = drawing.out ? 'OUT' : drawing.scored ? (es ? 'Anota' : 'Scores') : drawing.move === 'stay' ? (es ? 'Se queda' : 'Holds') : drawing.move === 'second' ? '2B ✓' : '3B ✓'
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
    <h4 className="min-h-8 break-words text-sm font-bold leading-tight" title={runner.playerName}>{runner.playerName}</h4>
    <p className="text-xs text-slate-500">{runner.base === 'first' ? '1B' : runner.base === 'second' ? '2B' : '3B'} → <span aria-live="polite" className={drawing.out ? 'font-bold text-rose-700' : 'font-bold text-emerald-800'}>{status}</span></p>
    <div className="relative">
    <svg viewBox="0 0 100 100" role="img" aria-label={runner.playerName + (es ? ': dibuja el avance; círculo OUT para marcar out' : ': draw the advance; mark the OUT circle for an out')}
      className="mx-auto aspect-square w-full max-w-[min(320px,32dvh)] touch-none select-none rounded-lg bg-[#fffdf7]"
      onPointerDown={e => { if (disabled || current.current) return; e.currentTarget.setPointerCapture(e.pointerId); const points = [point(e)]; current.current = { id:e.pointerId, points }; setInk(points); onDrawingChange(true) }}
      onPointerMove={e => { if (e.pointerId !== current.current?.id) return; const p = point(e); const prev = current.current.points.at(-1)!; if (Math.hypot(p[0]-prev[0],p[1]-prev[1]) < 0.7) return; current.current.points.push(p); setInk([...current.current.points]) }}
      onPointerUp={e => finish(e)} onPointerCancel={e => finish(e,true)} onLostPointerCapture={e => finish(e,true)}>
      <polygon points="50,88 88,50 50,12 12,50" fill={drawing.scored ? '#334155' : 'none'} stroke="#cbd5e1" strokeWidth="1" />
      <polyline points={RUNNER_DIAMOND.slice(0,drawing.reached+1).map(p=>p.join(',')).join(' ')} fill="none" stroke={drawing.scored ? 'white' : '#1e293b'} strokeWidth="2.5" strokeLinejoin="round" />
      {RUNNER_DIAMOND.slice(0,4).map(([x,y],i)=><g key={i}><rect x={x-2} y={y-2} width="4" height="4" fill="white" stroke="#64748b" transform={'rotate(45 '+x+' '+y+')'} /><text x={x} y={i===0 ? y+9 : i===2 ? y-6 : y+11} textAnchor="middle" fontSize="6" fill="#64748b">{['H','1B','2B','3B'][i]}</text></g>)}
      {!drawing.scored && <text x="50" y="52" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#475569">{runner.notation || ""}</text>}
      <circle cx={RUNNER_OUT[0]} cy={RUNNER_OUT[1]} r="8" fill={drawing.out ? '#ffe4e6' : 'none'} stroke={drawing.out ? '#be123c' : '#94a3b8'} />
      <text x="88" y="90" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#9f1239">OUT</text>
      {actions.filter(a=>a.type==='stroke').map((a,i)=><polyline key={i} points={a.points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />)}
      {ink.length>0 && <polyline points={ink.map(p=>p.join(',')).join(' ')} fill="none" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
    </div>
    {requireHoldConfirmation && <button type="button" disabled={disabled} onClick={onHold} className="mb-1 min-h-9 w-full rounded border border-emerald-200 text-xs font-semibold text-emerald-800">{drawing.move === 'stay' && reviewed ? (es ? '✓ Se queda' : '✓ Holds') : (es ? 'Confirmar: se queda' : 'Confirm Holds')}</button>}
    <div className="flex gap-2 text-xs"><button type="button" disabled={disabled || !actions.length} onClick={()=>onChange(actions.slice(0,-1))} className="min-h-9 flex-1 rounded border disabled:opacity-40">{es ? 'Deshacer' : 'Undo'}</button><button type="button" disabled={disabled || !actions.length} onClick={()=>onChange([])} className="min-h-9 flex-1 rounded border disabled:opacity-40">{es ? 'Restablecer' : 'Reset'}</button></div>
  </section>
}
