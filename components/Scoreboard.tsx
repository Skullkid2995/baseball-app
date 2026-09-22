import { Activity } from 'lucide-react'

export default function Scoreboard({ home, away, homeScore, awayScore, inning, outs, batter, language = 'en', status }: {
  home: string; away: string; homeScore: number; awayScore: number; inning: number; outs: number; batter?: string; language?: 'es' | 'en'; status?: string
}) {
  return <section className="relative isolate overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 px-5 py-5 text-white shadow-xl sm:px-8">
    <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 size-72 rounded-full bg-blue-600/20 blur-3xl" />
    <div className="relative flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400"><span className="flex items-center gap-2"><Activity className="size-4 text-emerald-400" />{status || (language === 'es' ? 'En juego' : 'Live scorebook')}</span><span>{language === 'es' ? 'Entrada' : 'Inning'} {inning}</span></div>
    <div data-keep-grid className="relative my-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div><p className="truncate text-sm font-bold sm:text-lg">{home}</p><p className="mt-1 font-mono text-5xl font-black tabular-nums text-emerald-300 sm:text-6xl">{homeScore}</p></div>
      <span className="font-mono text-xl text-slate-600">:</span>
      <div className="text-right"><p className="truncate text-sm font-bold sm:text-lg">{away}</p><p className="mt-1 font-mono text-5xl font-black tabular-nums text-white sm:text-6xl">{awayScore}</p></div>
    </div>
    <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
      <div className="flex items-center gap-2" aria-label={`${outs} outs`}><span className="mr-1 text-xs font-bold uppercase text-slate-400">Outs</span>{[1, 2, 3].map(n => <span key={n} className={`size-3 rounded-full border ${n <= outs ? 'border-rose-400 bg-rose-400 shadow-[0_0_12px_#fb718560]' : 'border-slate-600 bg-slate-800'}`} />)}</div>
      {batter && <p className="text-sm"><span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">{language === 'es' ? 'Al bat' : 'At bat'}</span><strong>{batter}</strong></p>}
    </div>
  </section>
}
