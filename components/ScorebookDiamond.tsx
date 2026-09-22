import { scorebookProgress, type ScorebookPlay } from '@/lib/scorecard/basePath'
import { scoringPlay } from '@/lib/scorecard/plays'
import { notationInk } from '@/lib/scorecard/notationInk'

const POINTS = [[24, 45], [45, 24], [24, 3], [3, 24], [24, 45]] as const
const BASE_LABELS = ['Home', '1B', '2B', '3B', 'Home']

/** Small paper-scorebook box: completed base paths, current base, result and out indicator. */
export default function ScorebookDiamond({ play, current = false }: { play?: ScorebookPlay | null; current?: boolean }) {
  const { reached, out, scored, occupied } = scorebookProgress(play)
  const marker = occupied ? POINTS[occupied] : scored ? POINTS[4] : null
  const notation = play ? play.notation || scoringPlay(play.result)?.code || play.result : ''
  const strokes = notationInk(notation, { centerX: 24, top: 18, width: 30, height: 11 })
  return <div className="relative size-11 shrink-0">
    <svg viewBox="0 0 48 48" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
      <path d="M24 45 45 24 24 3 3 24Z" fill={scored ? '#2459e5' : 'none'} stroke="#cbd5e1" strokeWidth="1" />
      {reached > 0 && <polyline data-base-path={reached} points={POINTS.slice(0, reached + 1).map(p => p.join(',')).join(' ')} fill="none" stroke={scored ? '#ffffff' : '#1e293b'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      {marker && <path d={`M${marker[0]} ${marker[1] - 4.5} ${marker[0] + 4.5} ${marker[1]} ${marker[0]} ${marker[1] + 4.5} ${marker[0] - 4.5} ${marker[1]}Z`} fill="#fbbf24" />}
      {!scored && strokes.map((stroke, i) => <polyline key={i} points={stroke.map(p => p.join(',')).join(' ')} fill="none" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />)}
      {(out || (current && !play)) && <circle cx="42" cy="6" r="6" fill={out ? '#ef233c' : '#10b981'} stroke="white" strokeWidth="1" />}
    </svg>
    {play && reached > 0 && <span className="sr-only">{BASE_LABELS.slice(0, reached + 1).join(' → ')}</span>}
    {play && <span className="sr-only">{notation}</span>}
    {!play && <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center text-sm ${current ? 'text-emerald-700' : 'text-slate-300'}`}>+</span>}
  </div>
}
