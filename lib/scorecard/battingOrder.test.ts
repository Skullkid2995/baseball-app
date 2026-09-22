import { describe, expect, it } from 'vitest'
import { canScoreCell, nextAtBat, type AtBatCell } from './battingOrder'

const lineup = ['a', 'b', 'c'].map(id => ({ id }))
const row = (player_id: string, order: number, result = 'single', inning = 1, appearance = 1) => ({
  player_id, result, inning, at_bat_number: appearance, created_at: `2026-09-22T12:00:${String(order).padStart(2, '0')}Z`,
})
function enabledCells(current: AtBatCell | null, locked = false) {
  const cells: AtBatCell[] = []
  for (const teamSide of ['home', 'opponent'] as const) for (const player of lineup) for (const inning of [1, 2, 3]) for (const appearance of [1, 2, 3]) {
    const cell = { playerId: player.id, inning, appearance, teamSide }
    if (canScoreCell(cell, current, locked)) cells.push(cell)
  }
  return cells
}

describe('current at-bat scoring restriction', () => {
  it('enables exactly one cell at game start, excluding other batters, innings and teams', () => {
    expect(enabledCells(nextAtBat(lineup, [], 'home'))).toEqual([{ playerId: 'a', inning: 1, appearance: 1, teamSide: 'home' }])
  })
  it('locks a saved appearance and moves to the next batter', () => {
    const before = nextAtBat(lineup, [], 'home')!
    const after = nextAtBat(lineup, [row('a', 1)], 'home')
    expect(canScoreCell(before, after, false)).toBe(false)
    expect(enabledCells(after)).toEqual([{ playerId: 'b', inning: 1, appearance: 1, teamSide: 'home' }])
  })
  it('selects only the next duplicate column when the lineup bats around', () => {
    const rows = [row('a', 1), row('b', 2), row('c', 3), row('a', 4, 'single', 1, 2)]
    expect(enabledCells(nextAtBat(lineup, rows, 'home'))).toEqual([{ playerId: 'b', inning: 1, appearance: 2, teamSide: 'home' }])
  })
  it('clears the old inning after three outs and resumes the batting order', () => {
    const rows = [row('a', 1, 'strikeout'), row('b', 2, 'ground_out'), row('c', 3, 'fly_out')]
    expect(enabledCells(nextAtBat(lineup, rows, 'home'))).toEqual([{ playerId: 'a', inning: 2, appearance: 1, teamSide: 'home' }])
  })
  it('counts a runner retired later when deciding whether the inning ended', () => {
    const rows = [{ ...row('a', 1), base_runner_outs: { first: false, second: true, third: false, home: false } }, row('b', 2, 'strikeout'), row('c', 3, 'strikeout')]
    expect(nextAtBat(lineup, rows, 'home')?.inning).toBe(2)
  })
  it('keeps each team separate and treats legacy rows as home', () => {
    const rows = [row('a', 1), { ...row('b', 2), team_side: 'opponent' as const }]
    expect(nextAtBat(lineup, rows, 'home')?.playerId).toBe('b')
    expect(nextAtBat(lineup, rows, 'opponent')?.playerId).toBe('c')
  })
  it('disables every cell for a completed game or an empty lineup', () => {
    expect(enabledCells(nextAtBat(lineup, [], 'home'), true)).toEqual([])
    expect(enabledCells(nextAtBat([], [], 'home'))).toEqual([])
  })
})
