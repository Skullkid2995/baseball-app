import type { ScorebookPlay } from '@/lib/scorecard/basePath'
import { playHistory, stepLabel, type SavedRunnerEvent } from '@/lib/scorecard/playHistory'
import { notationInk } from '@/lib/scorecard/notationInk'

const P = [[50,84],[84,50],[50,16],[16,50],[50,84]]
export default function ScorecardPlayHistory({ play, events, large = false }: { play: ScorebookPlay; events: SavedRunnerEvent[]; large?: boolean }) {
  const steps = playHistory(play, events)
  const scored = steps.some(s => s.to === 4 && !s.out)
  return <div className={large ? 'mx-auto w-full max-w-72' : 'w-24 shrink-0'}>
    <svg viewBox="0 0 100 100" role="img" aria-label={steps.map(stepLabel).join('; ')} className="w-full rounded bg-[#fffdf7]">
      <path d="M50 84 84 50 50 16 16 50Z" fill={scored ? '#d1fae5' : 'none'} stroke="#cbd5e1" />
      {steps.map((s,i) => {
        const end = s.to ?? s.from
        const ink = notationInk(s.code, { centerX: 50, top: 44, width: 38, height: 10 })
        return <g key={i}>
          {end > s.from && <polyline points={P.slice(s.from,end+1).map(p=>p.join(',')).join(' ')} fill="none" stroke={s.out ? '#be123c' : '#1e293b'} strokeWidth="2" strokeDasharray={s.out ? '3 2' : undefined} />}
          {s.out && <g stroke="#be123c" strokeWidth="2">{s.to !== null && s.to > 0 && <path d={`M${P[end][0]-4} ${P[end][1]-4}l8 8m-8 0l8 -8`} />}<text x="78" y="95" stroke="none" fill="#be123c" fontSize="8">OUT</text></g>}
          {i === 0 && ink.map((line,n)=><polyline key={n} points={line.map(p=>p.join(',')).join(' ')} fill="none" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round" />)}
          {i > 0 && s.to && !s.inferred && <text x={s.to===2 ? 76 : s.to===3 ? 24 : 24} y={s.to===2 || s.to===3 ? 22 : 79} textAnchor="middle" fontSize="7" fill={s.out ? '#be123c' : '#334155'}>{s.code}</text>}
        </g>
      })}
      {P.slice(0,4).map(([x,y],i)=><text key={i} x={x} y={i===2?y-6:y+11} textAnchor="middle" fontSize="6" fill="#64748b">{['H','1B','2B','3B'][i]}</text>)}
    </svg>
    <ol className={`space-y-0.5 px-1 pb-1 text-left leading-tight text-slate-700 ${large ? 'text-sm' : 'text-[10px]'}`}>
      {steps.map((s,i)=><li key={i} className={s.out ? 'font-semibold text-rose-800' : ''}>{stepLabel(s)}</li>)}
    </ol>
  </div>
}
