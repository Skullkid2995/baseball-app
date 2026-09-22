import { describe, expect, it } from 'vitest'
import { atBatIdentity } from './atBatRecord'
import { nextAtBat } from './battingOrder'

describe('at-bat ownership', () => {
  it.each(['home', 'opponent'] as const)('persists the %s side instead of relying on the home database default', teamSide => {
    const cell = { playerId: 'batter', inning: 2, appearance: 1, teamSide }
    expect(atBatIdentity('game', cell)).toEqual({ game_id: 'game', player_id: 'batter', inning: 2, at_bat_number: 1, team_side: teamSide })
  })
  it('advances only the opponent order after inserting an opponent at-bat', () => {
    const lineup = [{ id: 'first' }, { id: 'next' }]
    const row = { ...atBatIdentity('game', nextAtBat(lineup, [], 'opponent')!), result: 'double' }
    expect(nextAtBat(lineup, [row], 'opponent')?.playerId).toBe('next')
    expect(nextAtBat(lineup, [row], 'home')?.playerId).toBe('first')
  })
})
