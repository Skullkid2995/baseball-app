import { describe, expect, it } from 'vitest'
import { changedLineup, slotRows, runnerIdentity, type PlayerChange } from './substitutions'
import { nextAtBat } from './battingOrder'

const player = (id: string, position: string) => ({ id, first_name: id, last_name: '', jersey_number: 1, positions: [position] })
const initial = [player('a', 'SS'), player('b', 'CF')]
const change = (patch: Partial<PlayerChange> = {}): PlayerChange => ({ id: 'change', team_side: 'home', kind: 'pinch_hitter', out_player_id: 'a', in_player_id: 'c', position: 'SS', incoming: player('c', 'SS'), runner_at_bat_id: null, ...patch })

describe('scorecard player changes', () => {
  it('keeps prior appearances in the same batting slot after a replacement', () => {
    const slots = changedLineup(initial, [change()], 'home')
    const rows = [{ player_id: 'a', inning: 1, at_bat_number: 1, result: 'single' }, { player_id: 'b', inning: 1, at_bat_number: 1, result: 'walk' }]
    expect(nextAtBat(slots, slotRows(rows, slots, 'home'), 'home')).toEqual({ playerId: 'c', inning: 1, appearance: 2, teamSide: 'home' })
    expect(rows[0].player_id).toBe('a')
  })
  it('retains every player in a slot through successive substitutions and reloads', () => {
    expect(changedLineup(initial, [change(), change({ out_player_id: 'c', in_player_id: 'd', incoming: player('d', 'SS') })], 'home')[0].members).toEqual(['a', 'c', 'd'])
    expect(changedLineup(initial, [change()], 'opponent')[0].id).toBe('a')
  })
  it('counts outs recorded by a replaced batter when advancing the inning', () => {
    const slots = changedLineup(initial, [change()], 'home')
    const rows = [
      { player_id: 'a', inning: 1, at_bat_number: 1, result: 'strikeout' },
      { player_id: 'b', inning: 1, at_bat_number: 1, result: 'strikeout' },
      { player_id: 'c', inning: 1, at_bat_number: 2, result: 'strikeout' },
    ]
    expect(nextAtBat(slots, slotRows(rows, slots, 'home'), 'home')).toEqual({ playerId: 'b', inning: 2, appearance: 1, teamSide: 'home' })
  })
  it('swaps occupied fielding positions without moving the batting order', () => {
    const slots = changedLineup(initial, [change({ kind: 'position', in_player_id: 'a', position: 'CF' })], 'home')
    expect(slots.map(p => [p.id, p.positions[0]])).toEqual([['a', 'CF'], ['b', 'SS']])
    expect(initial[0].positions).toEqual(['SS'])
  })
  it('transfers only the selected runner, including a second pinch runner', () => {
    const changes = [change({ kind: 'pinch_runner', runner_at_bat_id: 'ab1' }), change({ kind: 'pinch_runner', runner_at_bat_id: 'ab1', out_player_id: 'c', in_player_id: 'd' })]
    expect(runnerIdentity('ab1', 'a', changes)).toBe('d')
    expect(runnerIdentity('ab2', 'a', changes)).toBe('a')
  })
})
