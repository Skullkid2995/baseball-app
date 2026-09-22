import { describe, expect, it } from 'vitest'
import { scorebookProgress } from './basePath'
import { applyRunnerEvent } from '@/lib/runnerEvents'
import { runnerUpdateFor } from './runners'
import { emptyBases, savedPlay } from './plays'

describe('scorebook base paths', () => {
  it.each([['first', 1], ['second', 2], ['third', 3]] as const)('draws every completed leg to %s from a single current-base flag', (base, reached) => {
    expect(scorebookProgress({ result: 'single', base_runners: { [base]: true } })).toMatchObject({ reached, occupied: reached, out: false })
  })
  it('shows the whole circuit for a scored runner', () => {
    expect(scorebookProgress({ result: 'single', base_runners: { home: true }, runs_scored: 1 })).toMatchObject({ reached: 4, scored: true, occupied: 0 })
  })
  it.each(['K', '6-3', 'SF', 'DP'])('does not draw a reached base for %s even with the first-base out flag', code => {
    expect(scorebookProgress(savedPlay(code))).toEqual({ reached: 0, out: true, scored: false, occupied: 0 })
  })
  it('extends the path when a runner steals second', () => {
    const patch = applyRunnerEvent({ base_runners: { ...emptyBases(), first: true } }, { type: 'SB', fromBase: 'first', toBase: 'second', isOut: false })
    expect(scorebookProgress({ result: 'single', ...patch })).toMatchObject({ reached: 2, occupied: 2 })
  })
  it('keeps the completed route when a runner is later retired without showing them on base', () => {
    const patch = runnerUpdateFor({ atBatId: 'runner', playerName: 'Runner', base: 'second' }, 'out', '1B')
    expect(scorebookProgress({ result: 'single', ...patch })).toMatchObject({ reached: 2, occupied: 0, out: true })
  })
  it('does not complete the attempted leg on a caught stealing', () => {
    const patch = applyRunnerEvent({}, { type: 'CS', fromBase: 'second', toBase: 'third', isOut: true })
    expect(scorebookProgress({ result: 'single', ...patch })).toMatchObject({ reached: 2, occupied: 0, out: true })
  })
  it('uses the batting result for legacy hits without base flags', () => {
    expect(scorebookProgress({ result: 'double' })).toMatchObject({ reached: 2, occupied: 2 })
    expect(scorebookProgress()).toMatchObject({ reached: 0, occupied: 0 })
  })
})
