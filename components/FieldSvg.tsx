import { FENCE_RADIUS, FIELDERS, FIRST, HOME, LEFT_POLE, MOUND, RIGHT_POLE, SECOND, THIRD } from '@/lib/scorecard/geometry'

/**
 * A proportioned baseball field in a 0-100 square, drawn from the shared
 * geometry: foul lines, outfield to the fence arc, infield diamond, mound,
 * bases, home plate and faint fielder numbers. Used by the Digital field
 * picker; the classic box paints the same layout on its canvas.
 */
export default function FieldSvg({ className, showNumbers = true }: { className?: string; showNumbers?: boolean }) {
  const arc = `M ${LEFT_POLE[0]} ${LEFT_POLE[1]} A ${FENCE_RADIUS} ${FENCE_RADIUS} 0 0 1 ${RIGHT_POLE[0]} ${RIGHT_POLE[1]}`
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* fair territory */}
      <path d={`M ${HOME[0]} ${HOME[1]} L ${LEFT_POLE[0]} ${LEFT_POLE[1]} ${arc.replace('M', 'L')} Z`} fill="#dcefd7" />
      {/* infield dirt */}
      <path d={`M ${HOME[0]} ${HOME[1]} L ${FIRST[0] + 8} ${FIRST[1] - 8} A 22 22 0 0 0 ${THIRD[0] - 8} ${THIRD[1] - 8} Z`} fill="#e8d9bf" />
      {/* infield grass */}
      <polygon points={`${HOME[0]},${HOME[1] - 3} ${FIRST[0] - 3},${FIRST[1]} ${SECOND[0]},${SECOND[1] + 3} ${THIRD[0] + 3},${THIRD[1]}`} fill="#cfe6c6" />
      {/* fence */}
      <path d={arc} fill="none" stroke="#475569" strokeWidth="1.2" />
      {/* foul lines */}
      <line x1={HOME[0]} y1={HOME[1]} x2={LEFT_POLE[0]} y2={LEFT_POLE[1]} stroke="#475569" strokeWidth="0.8" />
      <line x1={HOME[0]} y1={HOME[1]} x2={RIGHT_POLE[0]} y2={RIGHT_POLE[1]} stroke="#475569" strokeWidth="0.8" />
      {/* base paths */}
      <polygon points={`${HOME[0]},${HOME[1]} ${FIRST[0]},${FIRST[1]} ${SECOND[0]},${SECOND[1]} ${THIRD[0]},${THIRD[1]}`} fill="none" stroke="#475569" strokeWidth="0.8" />
      {/* mound */}
      <circle cx={MOUND[0]} cy={MOUND[1]} r="2.2" fill="#e8d9bf" stroke="#94a3b8" strokeWidth="0.5" />
      {/* bases */}
      {[FIRST, SECOND, THIRD].map((b, i) => (
        <rect key={i} x={b[0] - 2.2} y={b[1] - 2.2} width="4.4" height="4.4" fill="#fff" stroke="#475569" strokeWidth="0.6" transform={`rotate(45 ${b[0]} ${b[1]})`} />
      ))}
      {/* home plate */}
      <polygon points={`${HOME[0] - 2.5},${HOME[1] - 2} ${HOME[0] + 2.5},${HOME[1] - 2} ${HOME[0] + 2.5},${HOME[1]} ${HOME[0]},${HOME[1] + 2.5} ${HOME[0] - 2.5},${HOME[1]}`} fill="#fff" stroke="#475569" strokeWidth="0.6" />
      {showNumbers && FIELDERS.map((f) => (
        <text key={f.n} x={f.at[0]} y={f.at[1]} textAnchor="middle" dominantBaseline="middle" fontSize="4" fontWeight="600" fill="#64748b" opacity="0.7">
          {f.n}
        </text>
      ))}
    </svg>
  )
}
