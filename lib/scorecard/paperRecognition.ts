import type { Match } from '@/lib/handwriting/recognizer'
import { scoringPlay } from './plays'
/** Only prefill a clear result; committing the play still requires the scorer. */
export function confidentNotation(matches: Match[]): string | null {
  const valid=matches.filter(m=>scoringPlay(m.symbol) && !scoringPlay(m.symbol)?.sharedOnly)
  const [first,second]=valid
  return first && first.score>=0.9 && (!second || first.score-second.score>=0.15) ? first.symbol : null
}
