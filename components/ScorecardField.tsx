'use client'

import ScorecardBox, { type ScorecardBoxProps } from './ScorecardBox'
import { FIRST, SECOND, THIRD } from '@/lib/scorecard/geometry'
import type { RunnerBase } from '@/lib/runnerEvents'

interface FieldRunner { playerName: string; base: RunnerBase }
const BASES = [
  { base: 'first', label: '1B', point: FIRST, left: '71%', top: '69%', width: '27%' },
  { base: 'second', label: '2B', point: SECOND, left: '33%', top: '44%', width: '34%' },
  { base: 'third', label: '3B', point: THIRD, left: '2%', top: '69%', width: '27%' },
] as const

/** Labels sit beside the bases without intercepting finger or pen strokes. */
export default function ScorecardField({ runners, language, ...props }: ScorecardBoxProps & { runners: FieldRunner[]; language: 'en' | 'es' }) {
  return <div className="space-y-2">
    <div className="relative">
      <ScorecardBox {...props} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {BASES.map(({ base, label, point, left, top, width }) => {
          const runner = runners.find(r => r.base === base)
          if (!runner) return null
          const names = runner.playerName.trim().split(/\s+/)
          const shortName = names.length > 2 ? `${names[0]} ${names[names.length - 1]}` : runner.playerName
          return <div key={base}>
            <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-white bg-emerald-600 shadow-sm" style={{ left: `${point[0]}%`, top: `${point[1]}%` }} />
            <span className="absolute rounded-md border border-emerald-200 bg-emerald-950/95 px-1 py-1 text-center text-[10px] font-semibold leading-tight text-white shadow-sm sm:text-xs" style={{ left, top, width }}>
              <span className="block text-[9px] font-black text-emerald-300">{label}</span>
              <span className="block break-words">{shortName}</span>
            </span>
          </div>
        })}
      </div>
    </div>
    {runners.length > 0 && <ul aria-label={language === 'es' ? 'Corredores en base' : 'Runners on base'} className="space-y-1 text-xs text-slate-700">
      {BASES.flatMap(({ base, label }) => runners.filter(r => r.base === base).map((runner, i) => <li key={`${base}-${i}`} className="flex items-start gap-2">
        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 font-black text-emerald-900">{label}</span>
        <span className="min-w-0 break-words py-0.5 font-medium">{runner.playerName}</span>
      </li>))}
    </ul>}
  </div>
}
