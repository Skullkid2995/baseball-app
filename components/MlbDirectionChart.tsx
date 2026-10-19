'use client'
import type { DirectionShare } from '@/lib/mlb/stats'
import FieldSvg from './FieldSvg'
import { HOME, FENCE_RADIUS } from '@/lib/scorecard/geometry'

/** Five published direction zones. Never invent individual landing coordinates from percentages. */
export default function MlbDirectionChart({ shares, lang }: { shares: DirectionShare[]; lang: 'en' | 'es' }) {
  const es = lang === 'es'
  const labels = es ? ['Izquierdo', 'Izq.–central', 'Central', 'Der.–central', 'Derecho'] : ['Left', 'Left–center', 'Center', 'Right–center', 'Right']
  const at = (angle: number, radius: number) => [HOME[0] + Math.sin(angle * Math.PI / 180) * radius, HOME[1] - Math.cos(angle * Math.PI / 180) * radius]
  const sharesByKey = Object.fromEntries(shares.map(s => [s.key, s.percent]))
  return <figure className="mx-auto w-full max-w-sm">
    <div className="relative aspect-square rounded-xl border border-slate-300 bg-[#fffdf7]">
      <FieldSvg className="absolute inset-0 h-full w-full" view="full" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" role="img" aria-label={es ? 'Porcentajes de dirección de batazos MLB, por zona' : 'MLB batted-ball direction percentages by zone'}>
        {['leftField', 'leftCenterField', 'centerField', 'rightCenterField', 'rightField'].map((key, i) => {
          const value = sharesByKey[key] ?? 0, a = -45 + i * 18, p = at(a, FENCE_RADIUS), q = at(a + 18, FENCE_RADIUS), text = at(a + 9, 46)
          return <g key={key}><path d={`M ${HOME.join(' ')} L ${p.join(' ')} A ${FENCE_RADIUS} ${FENCE_RADIUS} 0 0 1 ${q.join(' ')} Z`} fill="#059669" fillOpacity={0.06 + value / 140} stroke="#047857" strokeWidth="0.35" />
            <text x={text[0]} y={text[1]} textAnchor="middle" fontSize="4" fontWeight="bold" fill="#0f172a">{value}%</text><title>{labels[i]}: {value}%</title></g>
        })}
      </svg>
    </div>
    <figcaption className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600"><p>{labels.map((label, i) => `${label}: ${shares[i]?.percent ?? 0}%`).join(' · ')}</p><p>{es ? 'Direcciones de batazos publicadas por MLB. Las zonas no son puntos exactos de caída ni una predicción.' : 'Batted-ball directions published by MLB. Zones are not exact landing points or a prediction.'}</p></figcaption>
  </figure>
}
