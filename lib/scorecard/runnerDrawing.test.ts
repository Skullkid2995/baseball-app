import { describe, expect, it } from 'vitest'
import { runnerDrawing, drawnRunnerUpdate, RUNNER_DIAMOND as D, RUNNER_OUT } from './runnerDrawing'
import type { BoxAction } from './interpret'
import type { ActiveRunner } from './runners'

const runner: ActiveRunner = { atBatId: 'one', playerName: 'Runner', base: 'first' }
const stroke = (...points: [number, number][]): BoxAction => ({ type: 'stroke', points })
describe('drawing in an existing runner scorecard', () => {
  it('starts with the existing path and never advances automatically', () => {
    expect(runnerDrawing(runner, []).move).toBe('stay')
    expect(runnerDrawing({ ...runner, base: 'third' }, []).reached).toBe(3)
  })
  it('accepts incremental paths and continuous multi-base advances', () => {
    expect(runnerDrawing(runner, [stroke(D[1], D[2])]).move).toBe('second')
    expect(runnerDrawing(runner, [stroke(D[1], D[2], D[3])]).move).toBe('third')
    expect(runnerDrawing(runner, [stroke(D[1], D[2]), stroke(D[2], D[3]), stroke(D[3], D[4])]).scored).toBe(true)
  })
  it('does not accept disconnected paths or erase the original bases', () => {
    expect(runnerDrawing(runner, [stroke(D[3], D[4])]).move).toBe('stay')
    expect(runnerDrawing({ ...runner, base: 'third' }, [{ type: 'tap', point: D[1] }]).reached).toBe(3)
    expect(runnerDrawing(runner, [stroke([20,20], [40,30])]).move).toBe('stay')
  })
  it('shading or completing the diamond records exactly one run', () => {
    const shaded = [stroke([40,50], [60,50], [43,53], [57,47])]
    expect(drawnRunnerUpdate(runner, shaded, '1B').runs_scored).toBe(1)
    expect(drawnRunnerUpdate({ ...runner, base: 'third' }, [stroke(D[3], D[4])], '1B').runs_scored).toBe(1)
  })
  it('an out cancels a run and preserves the completed path', () => {
    const actions: BoxAction[] = [stroke(D[1], D[2]), { type: 'tap', point: RUNNER_OUT }]
    const update = drawnRunnerUpdate(runner, actions, '1B')
    expect(update.move).toBe('out')
    expect(update.base_runners.second).toBe(true)
    expect(update.runs_scored).toBe(0)
    expect(drawnRunnerUpdate(runner, [...actions, { type: 'tap', point: D[0] }], '1B').runs_scored).toBe(0)
  })
  it('undo and reset restore the runner without affecting another box', () => {
    const actions = [stroke(D[1], D[2]), stroke(D[2], D[3])]
    expect(runnerDrawing(runner, actions.slice(0,-1)).move).toBe('second')
    expect(runnerDrawing(runner, []).move).toBe('stay')
    expect(runnerDrawing({ ...runner, atBatId: 'two', base: 'second' }, []).reached).toBe(2)
  })
})
