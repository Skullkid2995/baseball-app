import { describe, expect, it } from 'vitest'
import { inningEndsOnPlay, runnerReviewComplete, runnerUpdateFor, thirdOutCancelsRuns } from './runners'
const runner = { atBatId: 'r', playerName: 'Runner', base: 'first' as const }
describe('third-out runner review', () => {
  it('ends on a batter third out with unreviewed runners holding', () => {
    expect(inningEndsOnPlay(2, true, [runnerUpdateFor(runner, 'stay', 'K')])).toBe(true)
  })
  it('ends on an active runner third out while the batter is safe', () => {
    expect(inningEndsOnPlay(2, false, [runnerUpdateFor(runner, 'out', 'H1')])).toBe(true)
  })
  it('waits for the actual runner out on a double play', () => {
    expect(inningEndsOnPlay(1, true, [runnerUpdateFor(runner, 'stay', 'DP')])).toBe(false)
    expect(inningEndsOnPlay(1, true, [runnerUpdateFor(runner, 'out', 'DP')])).toBe(true)
  })
  it('still requires runner review before three outs', () => {
    expect(inningEndsOnPlay(1, false, [runnerUpdateFor(runner, 'out', 'H1')])).toBe(false)
  })
  it('cancels runs on a force third out but preserves a possible timing run on a tag', () => {
    expect(thirdOutCancelsRuns(2, true, true, [])).toBe(true)
    expect(thirdOutCancelsRuns(2, false, false, [runnerUpdateFor(runner, 'out', 'GO')])).toBe(true)
    expect(thirdOutCancelsRuns(2, false, false, [runnerUpdateFor(runner, 'out', '1B')])).toBe(false)
  })
  it('requires runner review when a third tag out can still allow a run', () => {
    const scoringRunner = { atBatId: 's', playerName: 'Scorer', base: 'third' as const }
    const cancelRuns = thirdOutCancelsRuns(2, false, false, [runnerUpdateFor(runner, 'out', '1B')])
    expect(runnerReviewComplete([runner, scoringRunner], { r: 'first' }, cancelRuns)).toBe(false)
    expect(runnerReviewComplete([runner, scoringRunner], { r: 'first', s: 'third' }, cancelRuns)).toBe(true)
  })
  it('skips runner confirmations only when the third out nullifies all runs', () => {
    expect(runnerReviewComplete([runner], {}, true)).toBe(true)
    expect(runnerReviewComplete([runner], {}, false)).toBe(false)
    expect(runnerReviewComplete([], {}, false)).toBe(true)
  })
  it('requires reviewing the new base after a runner advances between pitches', () => {
    expect(runnerReviewComplete([{ ...runner, base: 'second' }], { r: 'first' }, false)).toBe(false)
  })
})
