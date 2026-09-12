import { BASE_RADIUS, FENCE_RADIUS, FIELDERS, FIRST, HOME, LEFT_POLE, MOUND, RIGHT_POLE, SECOND, THIRD } from '@/lib/scorecard/geometry'
import type { Pt } from '@/lib/scorecard/geometry'

export type BaseName = 'first' | 'second' | 'third' | 'home'
export type BaseFlags = Record<BaseName, boolean>

/** The part of the 0-100 box shown when zoomed into the infield (square) */
const INFIELD_VIEW = { x: 20, y: 40, size: 60 }

interface FieldSvgProps {
  className?: string
  showNumbers?: boolean
  /** 'full' shows the whole field; 'infield' zooms into the diamond (animated) */
  view?: 'full' | 'infield'
  /** Bases the batter/runner has reached: painted like the classic box */
  runners?: BaseFlags
  /** Base currently selected (for marking an out) */
  selectedBase?: BaseName | null
  /** Bases where a runner was put out */
  runnerOuts?: Partial<BaseFlags>
  /** Run scored: the diamond fills Dodgers blue */
  runScored?: boolean
  /** Where the batted ball landed, in box units */
  landing?: Pt | null
  /** Makes the bases tappable */
  onBaseClick?: (base: BaseName) => void
}

const BASES: { name: BaseName; at: Pt }[] = [
  { name: 'first', at: FIRST },
  { name: 'second', at: SECOND },
  { name: 'third', at: THIRD },
  { name: 'home', at: HOME },
]

/**
 * A proportioned baseball field in a 0-100 square, drawn from the shared
 * geometry: foul lines, outfield to the fence arc, infield diamond, mound,
 * bases, home plate and faint fielder numbers. Used by the Digital view
 * (zoomed into the infield for the runners, zoomed out to pick where a
 * ball landed); the classic box paints the same layout on its canvas.
 */
export default function FieldSvg({
  className,
  showNumbers = true,
  view = 'full',
  runners,
  selectedBase = null,
  runnerOuts,
  runScored = false,
  landing = null,
  onBaseClick,
}: FieldSvgProps) {
  const arc = `M ${LEFT_POLE[0]} ${LEFT_POLE[1]} A ${FENCE_RADIUS} ${FENCE_RADIUS} 0 0 1 ${RIGHT_POLE[0]} ${RIGHT_POLE[1]}`
  const zoom = view === 'infield' ? 100 / INFIELD_VIEW.size : 1
  const transform = view === 'infield' ? `scale(${zoom}) translate(${-INFIELD_VIEW.x}px, ${-INFIELD_VIEW.y}px)` : 'none'
  const reached = runners ?? { first: false, second: false, third: false, home: false }
  const PENCIL = 'rgba(31,41,55,0.85)'

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={onBaseClick ? undefined : true}>
      <g style={{ transform, transition: 'transform 350ms ease' }}>
        {/* fair territory */}
        <path d={`M ${HOME[0]} ${HOME[1]} L ${LEFT_POLE[0]} ${LEFT_POLE[1]} ${arc.replace('M', 'L')} Z`} fill="#dcefd7" />
        {/* infield dirt */}
        <path d={`M ${HOME[0]} ${HOME[1]} L ${FIRST[0] + 8} ${FIRST[1] - 8} A 22 22 0 0 0 ${THIRD[0] - 8} ${THIRD[1] - 8} Z`} fill="#e8d9bf" />
        {/* infield grass (Dodgers blue when the run scored) */}
        <polygon
          points={`${HOME[0]},${HOME[1] - 3} ${FIRST[0] - 3},${FIRST[1]} ${SECOND[0]},${SECOND[1] + 3} ${THIRD[0] + 3},${THIRD[1]}`}
          fill={runScored ? '#1e3a8a' : '#cfe6c6'}
          style={{ transition: 'fill 250ms ease' }}
        />
        {/* fence */}
        <path d={arc} fill="none" stroke="#475569" strokeWidth="1.2" />
        {/* foul lines */}
        <line x1={HOME[0]} y1={HOME[1]} x2={LEFT_POLE[0]} y2={LEFT_POLE[1]} stroke="#475569" strokeWidth="0.8" />
        <line x1={HOME[0]} y1={HOME[1]} x2={RIGHT_POLE[0]} y2={RIGHT_POLE[1]} stroke="#475569" strokeWidth="0.8" />
        {/* base paths */}
        <polygon points={`${HOME[0]},${HOME[1]} ${FIRST[0]},${FIRST[1]} ${SECOND[0]},${SECOND[1]} ${THIRD[0]},${THIRD[1]}`} fill="none" stroke="#475569" strokeWidth="0.8" />
        {/* paths reached, drawn like the pencil marks of the classic box */}
        {(reached.first || reached.second || reached.third || reached.home) && (
          <line x1={HOME[0]} y1={HOME[1]} x2={FIRST[0]} y2={FIRST[1]} stroke={PENCIL} strokeWidth="2" strokeLinecap="round" />
        )}
        {(reached.second || reached.third || reached.home) && (
          <line x1={FIRST[0]} y1={FIRST[1]} x2={SECOND[0]} y2={SECOND[1]} stroke={PENCIL} strokeWidth="2" strokeLinecap="round" />
        )}
        {(reached.third || reached.home) && (
          <line x1={SECOND[0]} y1={SECOND[1]} x2={THIRD[0]} y2={THIRD[1]} stroke={PENCIL} strokeWidth="2" strokeLinecap="round" />
        )}
        {reached.home && <line x1={THIRD[0]} y1={THIRD[1]} x2={HOME[0]} y2={HOME[1]} stroke={PENCIL} strokeWidth="2" strokeLinecap="round" />}
        {/* mound */}
        <circle cx={MOUND[0]} cy={MOUND[1]} r="2.2" fill="#e8d9bf" stroke="#94a3b8" strokeWidth="0.5" />
        {/* bases and home plate */}
        {BASES.map(({ name, at }) => {
          const hasRunner = reached[name]
          const isOut = !!runnerOuts?.[name]
          const isSelected = selectedBase === name
          const fill = isOut ? '#fecaca' : hasRunner || isSelected ? '#fcd34d' : '#ffffff'
          const stroke = isSelected ? '#1e3a8a' : '#475569'
          return (
            <g
              key={name}
              onClick={onBaseClick ? () => onBaseClick(name) : undefined}
              style={onBaseClick ? { cursor: 'pointer' } : undefined}
              role={onBaseClick ? 'button' : undefined}
              aria-label={onBaseClick ? name : undefined}
            >
              {/* generous invisible tap target */}
              {onBaseClick && <circle cx={at[0]} cy={at[1]} r={BASE_RADIUS} fill="transparent" />}
              {name === 'home' ? (
                <polygon
                  points={`${at[0] - 2.5},${at[1] - 2} ${at[0] + 2.5},${at[1] - 2} ${at[0] + 2.5},${at[1]} ${at[0]},${at[1] + 2.5} ${at[0] - 2.5},${at[1]}`}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 0.9 : 0.6}
                />
              ) : (
                <rect x={at[0] - 2.2} y={at[1] - 2.2} width="4.4" height="4.4" fill={fill} stroke={stroke} strokeWidth={isSelected ? 0.9 : 0.6} transform={`rotate(45 ${at[0]} ${at[1]})`} />
              )}
              {isSelected && <circle cx={at[0]} cy={at[1]} r="4.2" fill="none" stroke="#1e3a8a" strokeWidth="0.6" strokeDasharray="1.2 1" />}
              {isOut && (
                <g stroke="#b91c1c" strokeWidth="0.9" strokeLinecap="round">
                  <line x1={at[0] - 1.8} y1={at[1] - 1.8} x2={at[0] + 1.8} y2={at[1] + 1.8} />
                  <line x1={at[0] + 1.8} y1={at[1] - 1.8} x2={at[0] - 1.8} y2={at[1] + 1.8} />
                </g>
              )}
            </g>
          )
        })}
        {showNumbers &&
          FIELDERS.map((f) => (
            <text key={f.n} x={f.at[0]} y={f.at[1]} textAnchor="middle" dominantBaseline="middle" fontSize="4" fontWeight="600" fill="#64748b" opacity="0.7" style={{ pointerEvents: 'none' }}>
              {f.n}
            </text>
          ))}
        {/* where the ball landed */}
        {landing && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={landing[0]} cy={landing[1]} r="2.6" fill="#ffffff" stroke="#0f172a" strokeWidth="0.6" />
            <circle cx={landing[0]} cy={landing[1]} r="1.1" fill="#ef4444" />
          </g>
        )}
      </g>
    </svg>
  )
}
