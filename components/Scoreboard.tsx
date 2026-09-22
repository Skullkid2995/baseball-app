import type { ActiveRunner } from '@/lib/scorecard/runners'

const BASES = [
  { base: 'first', label: '1B', number: '1', x: 76, y: 50 },
  { base: 'second', label: '2B', number: '2', x: 48, y: 22 },
  { base: 'third', label: '3B', number: '3', x: 20, y: 50 },
] as const

export default function Scoreboard({ home, away, homeScore, awayScore, inning, half, outs, batter, language = 'en', status, runners = [], battingTeam }: {
  home: string; away: string; homeScore: number; awayScore: number; inning: number; outs: number; batter?: string; language?: 'es' | 'en'; status?: string
  runners?: Pick<ActiveRunner, 'playerName' | 'base'>[]; battingTeam?: string; half?: 'top' | 'bottom'
}) {
  const es = language === 'es'
  const bases = BASES.map(base => ({ ...base, runners: runners.filter(r => r.base === base.base) }))
  const empty = es ? 'Vacía' : 'Empty'
  return <section className="overflow-hidden rounded-2xl border border-zinc-600 bg-[#111216] text-white shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 bg-gradient-to-r from-zinc-800 to-zinc-900 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300 sm:px-8">
      <span className="flex items-center gap-2"><span className="h-3 w-1 bg-red-500" aria-hidden="true" />{status || (es ? 'En juego' : 'Live scorebook')}</span>
      <div className="flex flex-col items-end gap-0.5">
        <span>{es ? 'Entrada' : 'Inning'} <strong className="ml-1 text-sm tabular-nums text-white">{inning}</strong></span>
        {half && <span className="flex items-center gap-1 text-[9px] tracking-widest text-amber-300"><span aria-hidden="true">{half === 'top' ? '▲' : '▼'}</span>{half === 'top' ? (es ? 'Parte alta' : 'Top') : (es ? 'Parte baja' : 'Bottom')}</span>}
      </div>
    </div>
    <div className="px-4 pb-4 pt-3 sm:px-8">
      <div data-keep-grid className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-6">
        <div className="min-w-0 overflow-hidden rounded-md border border-white/20">
          {[{ name: home, score: homeScore, side: 'home' }, { name: away, score: awayScore, side: 'away' }].map(team => <div key={team.side} className="flex min-w-0 items-stretch border-b border-white/20 bg-gradient-to-r from-zinc-800 to-zinc-900 last:border-b-0">
            <span aria-hidden="true" className={`flex w-9 shrink-0 items-center justify-center border-r border-white/15 text-xl font-black italic sm:w-14 sm:text-2xl ${team.side === 'home' ? 'bg-blue-900' : 'bg-red-950'}`}>{team.name.trim().slice(0, 1).toUpperCase()}</span>
            <p className="min-w-0 flex-1 self-center truncate px-2 py-3 text-sm font-black uppercase tracking-wide sm:px-4 sm:text-xl" title={team.name}>{team.name}</p>
            <p className="flex min-w-10 shrink-0 items-center justify-center bg-zinc-100 px-2 font-mono text-3xl font-black leading-none tabular-nums text-zinc-950 sm:min-w-16 sm:text-4xl">{team.score}</p>
          </div>)}
        </div>
        <div className="flex w-20 flex-col items-center sm:w-28">
          <svg viewBox="0 0 96 90" className="w-full" role="img" aria-label={`Bases: ${bases.map(b => `${b.label}: ${b.runners.map(r => r.playerName).join(', ') || empty}`).join('; ')}`}>
            <path d="M48 78 76 50 48 22 20 50Z" fill="none" stroke="#52525b" strokeWidth="1" />
            {bases.map(({ base, number, x, y, runners: onBase }) => <g key={base}>
              <path d={`M${x} ${y - 11} ${x + 11} ${y} ${x} ${y + 11} ${x - 11} ${y}Z`} fill={onBase.length ? '#ef233c' : '#18181b'} stroke={onBase.length ? '#fb7185' : '#a1a1aa'} strokeWidth="1.5" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="800" fill={onBase.length ? '#ffffff' : '#a1a1aa'}>{number}</text>
            </g>)}
            <path d="M43 73H53V78L48 83 43 78Z" fill="#d4d4d8" />
          </svg>
          <div className="flex items-center gap-1.5" aria-label={`${outs} outs`}>
            {[1, 2, 3].map(n => <span key={n} className={`size-2.5 rounded-full border ${n <= outs ? 'border-amber-300 bg-amber-300' : 'border-zinc-600 bg-zinc-800'}`} />)}
            <span className="ml-0.5 text-[9px] font-bold uppercase text-zinc-400">Outs</span>
          </div>
        </div>
      </div>
      <div className="my-3 border-y border-white/15 py-3">
        <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-widest"><span className="text-zinc-200">{es ? 'En base' : 'On base'}</span>{battingTeam && <span className="min-w-0 break-words text-zinc-400">· {battingTeam}</span>}</p>
        <dl className="grid gap-2 sm:grid-cols-3" aria-label={es ? 'Corredores activos' : 'Active runners'}>
          {bases.map(({ base, label, runners: onBase }) => <div key={base} className={`flex min-w-0 items-start gap-2 rounded border px-2 py-1.5 ${onBase.length ? 'border-red-500/35 bg-red-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
            <dt className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-black ${onBase.length ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{label}</dt>
            <dd className={`min-w-0 break-words text-xs leading-5 ${onBase.length ? 'font-semibold text-white' : 'text-zinc-400'}`}>{onBase.map(r => r.playerName).join(', ') || empty}</dd>
          </div>)}
        </dl>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">{es ? 'Al bate' : 'At bat'}</span>
        <span className="min-w-0 break-words text-sm font-bold text-zinc-100">{batter || '—'}</span>
      </div>
    </div>
  </section>
}
