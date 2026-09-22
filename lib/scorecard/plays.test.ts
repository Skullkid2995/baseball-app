import { describe, expect, it } from 'vitest'
import { emptyBases, playerOuts, savedPlay, scoringPlay, SCORING_PLAYS } from './plays'
import { defaultRunnerMoves, runnerUpdateFor, thirdOutCancelsRuns } from './runners'
import { notationEvent, submit, type Room } from '@/lib/faceoff/workflow'
import { applyEvent, createGame } from '@/lib/rules/engine'
import { demoLineup } from '@/lib/rules/scenarios'

describe('saved scorecard results', () => {
  it.each(['K', 'SK', 'KC', 'F', 'L', 'P', 'F8', 'L-5', '3U', '6-3', 'SF', 'SAC', 'SH', 'DP', 'TP'])('%s persists an out and cannot also score the batter', notation => {
    const saved = savedPlay(notation, { ...emptyBases(), home: true })
    expect(playerOuts(saved)).toBe(1)
    expect(saved.base_runner_outs.first).toBe(true)
    expect(saved.runs_scored).toBe(0)
    expect(Object.values(saved.base_runners).some(Boolean)).toBe(false)
  })
  it('counts a result and its out flag once, including sacrifice outs', () => {
    expect(playerOuts({ result: 'sacrifice_fly', base_runner_outs: { first: true, second: true } })).toBe(1)
    expect(playerOuts({ result: 'sacrifice_bunt' })).toBe(1)
  })
  it('retains a hit when the runner is later retired', () => {
    const row = savedPlay('2B', { ...emptyBases(), home: true }, { ...emptyBases(), third: true })
    expect(row.result).toBe('double')
    expect(playerOuts(row)).toBe(1)
    expect(row.runs_scored).toBe(0)
    expect(row.base_runners.home).toBe(false)
  })
  it.each(['banana', 'DRAWING_SAVED', 'SB', 'CS', 'WP', 'PB', 'BK', 'FOUL', '8'])('rejects %s instead of inventing a ground out or walk', notation => {
    expect(() => savedPlay(notation)).toThrow()
  })
  it('recognizes every offered batting result and preserves the legacy result vocabulary', () => {
    for (const p of SCORING_PLAYS) {
      expect(scoringPlay(p.code)).toBe(p)
      expect(notationEvent(p.code)).toBeTruthy()
      if (!p.sharedOnly) expect(savedPlay(p.code).result).toBe(p.result)
    }
  })
})

describe('multiple outs and runner decisions', () => {
  const runners = [{ atBatId: 'a', playerName: 'A', base: 'first' as const }, { atBatId: 'b', playerName: 'B', base: 'second' as const }]
  it('records one batter out and one out on the retired runner for a double play', () => {
    const moves = defaultRunnerMoves('6-4-3', runners)
    expect(moves).toEqual({ a: 'out', b: 'stay' })
    const updates = runners.map(r => runnerUpdateFor(r, moves[r.atBatId], 'DP'))
    expect(playerOuts(savedPlay('DP')) + updates.filter(u => u.move === 'out').length).toBe(2)
  })
  it('forces runners on a walk, but does not advance unforced runners', () => {
    expect(defaultRunnerMoves('IBB', [runners[1]])).toEqual({ b: 'stay' })
    expect(defaultRunnerMoves('BB', runners)).toEqual({ a: 'second', b: 'third' })
  })
  it('keeps fielder choice as a safe batter with a separate runner out', () => {
    expect(playerOuts(savedPlay('FC'))).toBe(0)
    expect(defaultRunnerMoves('FC', [runners[0]])).toEqual({ a: 'out' })
  })
  it('cancels runs when a fielder choice ends the inning on a force out', () => {
    const forced = runnerUpdateFor(runners[0], 'out', 'FC')
    expect(thirdOutCancelsRuns(2, false, false, [forced])).toBe(true)
    expect(thirdOutCancelsRuns(1, false, false, [forced])).toBe(false)
  })
  it('allows the scorer to credit a run before a third tag out', () => {
    const tagged = runnerUpdateFor(runners[0], 'out', '2B')
    expect(thirdOutCancelsRuns(2, false, false, [tagged])).toBe(false)
    expect(thirdOutCancelsRuns(2, true, true, [])).toBe(true)
  })
  it('maps the standard double-play notation to two engine outs', () => {
    const initial = createGame({ battingFirst: 'home', lineups: { home: demoLineup('home'), opponent: demoLineup('opponent') } })
    const onBase = applyEvent(initial, notationEvent('BB'))
    const after = applyEvent(onBase, notationEvent('6-4-3'))
    expect(after.outs).toBe(2)
    expect(after.runners).toHaveLength(0)
    expect(notationEvent('SAC')).toEqual({ type: 'ball_in_play', result: 'sacrifice_bunt' })
  })
  it('rejects impossible double plays and stores the third-out marker through an inning change', () => {
    const initial = createGame({ battingFirst: 'home', lineups: { home: demoLineup('home'), opponent: demoLineup('opponent') } })
    const room: Room = { game_id: 'g', version: 0, home_team_id: 'a', opponent_team_id: 'b', names: {home:'A',opponent:'B'}, state: initial, pending: null, history: [] }
    const actor = { id: 'a', side: 'home' as const }
    expect(() => submit(room, actor, { id:'p', notation:'DP', ink:[] }, 'now')).toThrow('Not enough runners')
    room.state = applyEvent(applyEvent(initial, notationEvent('K')), notationEvent('K'))
    const proposed = submit(room, actor, { id:'p', notation:'F8', ink:[] }, 'now')
    expect(proposed.pending?.outNumber).toBe(3)
    expect(proposed.state.outs).toBe(2)
  })
  it('does not award a sacrifice or a run on a fly out with two outs', () => {
    let state = createGame({ battingFirst: 'home', lineups: { home: demoLineup('home'), opponent: demoLineup('opponent') } })
    for (const code of ['K', 'K', '3B']) state = applyEvent(state, notationEvent(code))
    const batter = state.currentBatter!.playerId
    const after = applyEvent(state, notationEvent('SF'))
    expect(after.score.home).toBe(0)
    expect(after.half).toBe('bottom')
    expect(after.batterLines[batter].sacrificeFlies).toBe(0)
    expect(after.batterLines[batter].atBats).toBe(1)
  })
  it('fielder choice retires the forced runner without leaving two players on first', () => {
    let state = createGame({ battingFirst: 'home', lineups: { home: demoLineup('home'), opponent: demoLineup('opponent') } })
    for (const code of ['BB', 'BB', 'FC']) state = applyEvent(state, notationEvent(code))
    expect(state.outs).toBe(1)
    expect(state.runners.map(r => r.base).sort()).toEqual([1, 2])
  })
})
