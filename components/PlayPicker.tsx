'use client'

import { useState } from 'react'
import { Crosshair, Shield, Zap } from 'lucide-react'
import { SCORING_PLAYS, scoringPlay, type PlayGroup } from '@/lib/scorecard/plays'
import { cn } from '@/lib/utils'

export default function PlayPicker({ value, onChange, language, disabled = false, shared = false, outs = 0, runners = 0 }: {
  value: string; onChange: (value: string) => void; language: 'es' | 'en'; disabled?: boolean; shared?: boolean; outs?: number; runners?: number
}) {
  const [group, setGroup] = useState<PlayGroup>(scoringPlay(value)?.group || 'hit')
  const es = language === 'es'
  const current = scoringPlay(value)
  const groups = [
    { id: 'hit' as const, label: es ? 'Hit' : 'Hit', Icon: Zap },
    { id: 'out' as const, label: 'Out', Icon: Shield },
    { id: 'reach' as const, label: es ? 'Llega a base' : 'Reach base', Icon: Crosshair },
  ]
  return <div className="space-y-3">
    <div data-keep-grid className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1" role="group" aria-label={es ? 'Tipo de jugada' : 'Play category'}>
      {groups.map(({ id, label, Icon }) => <button key={id} type="button" disabled={disabled} aria-pressed={group === id} onClick={() => setGroup(id)} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500', group === id ? 'bg-white text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800', 'disabled:opacity-50')}><Icon className="size-4" />{label}</button>)}
    </div>
    <div data-keep-grid className="grid grid-cols-2 gap-2">
      {SCORING_PLAYS.filter(p => p.group === group && (shared || !p.sharedOnly)).map(p => {
        const unavailable = (p.outs > 1 && (runners < p.outs - 1 || outs + p.outs > 3)) || (['SF', 'SAC'].includes(p.code) && (outs >= 2 || runners === 0))
        return <button type="button" key={p.code} disabled={disabled || unavailable} aria-pressed={current?.code === p.code} onClick={() => onChange(p.code)} title={unavailable ? (es ? 'Requiere corredores y outs disponibles' : 'Requires enough runners and outs remaining') : p[language]} className={cn('min-h-16 rounded-xl border px-3 py-2 text-left transition motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40', current?.code === p.code ? group === 'out' ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500 text-rose-950' : 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 text-emerald-950' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50')}>
          <span className="flex flex-wrap items-center justify-between gap-1"><span className="break-all text-base font-black tracking-tight">{p.code}</span>{p.outs > 0 && <span className="text-[10px] font-bold uppercase text-rose-700">{p.outs} {p.outs > 1 ? 'outs' : 'out'}</span>}</span>
          <span className="block text-xs font-medium">{p[language]}</span>
        </button>
      })}
    </div>
    <details className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700">
      <summary className="cursor-pointer font-semibold">{es ? 'Notación con fildeadores' : 'Fielder notation'}</summary>
      <label className="mt-2 block text-xs">{es ? 'Ej. 6-3, F8, L5, E6, 3U' : 'e.g. 6-3, F8, L5, E6, 3U'}
        <input aria-label={es ? 'Notación de jugada' : 'Play notation'} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-mono text-base uppercase" maxLength={20} />
      </label>
    </details>
  </div>
}
