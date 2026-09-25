export default function PaperScoreHeader({home,opponent,rows,inning,outs,side,language}: {
  home:string; opponent:string; rows:{inning:number;runs_scored:number;team_side?:'home'|'opponent'}[]
  inning:number;outs:number;side:'home'|'opponent';language:'en'|'es'
}) {
  const innings=Array.from({length:Math.max(9,inning)},(_,i)=>i+1)
  return <div className="space-y-2">
    <div className="overflow-x-auto"><table className="w-full border-collapse text-center font-serif text-sm" aria-label={language==='es'?'Carreras por entrada':'Runs by inning'}>
      <thead><tr><th className="border border-stone-400 px-3 py-1 text-left">{language==='es'?'Equipo':'Team'}</th>{innings.map(i=><th key={i} className="min-w-7 border border-stone-400 px-1">{i}</th>)}<th className="border border-stone-400 px-2">R</th></tr></thead>
      <tbody>{(['home','opponent'] as const).map(team=>{
        const plays=rows.filter(r=>(r.team_side||'home')===team)
        return <tr key={team}><th className="border border-stone-400 px-3 py-1 text-left font-normal">{side===team?'› ':''}{team==='home'?home:opponent}</th>{innings.map(i=><td key={i} className="border border-stone-400">{plays.some(r=>r.inning===i)?plays.filter(r=>r.inning===i).reduce((n,r)=>n+r.runs_scored,0):'·'}</td>)}<td className="border border-stone-400 font-bold">{plays.reduce((n,r)=>n+r.runs_scored,0)}</td></tr>
      })}</tbody>
    </table></div>
    <p className="font-serif text-sm">{language==='es'?'Anotando':'Scoring'}: <strong>{side==='home'?home:opponent}</strong> · {language==='es'?'Entrada':'Inning'} {inning} · {outs} outs</p>
  </div>
}
