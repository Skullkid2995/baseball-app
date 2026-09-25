import { describe, expect, it } from 'vitest'
import { inningEndsOnPlay, runnerUpdateFor, thirdOutCancelsRuns } from './runners'
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
})
