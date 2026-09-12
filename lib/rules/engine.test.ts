import { describe, expect, it } from 'vitest'
import { applyEvent, createGame, diffStates, inningsPitched } from './engine'
import { SCENARIOS, demoLineup, runScenario } from './scenarios'

const scenario = (key: string) => {
  const s = SCENARIOS.find((x) => x.key === key)
  if (!s) throw new Error(`missing scenario ${key}`)
  return runScenario(s)
}

describe('count', () => {
  it('walks on four balls, strikes out on three strikes, ignores fouls with two strikes', () => {
    const s = scenario('count')
    expect(s.runners.map((r) => r.playerId)).toEqual(['D1']) // walked
    expect(s.outs).toBe(1) // strikeout
    expect(s.currentBatter?.playerId).toBe('D3')
    const p = s.pitcherLines['R8']
    expect(p.pitches).toBe(11)
    expect(p.walks).toBe(1)
    expect(p.strikeouts).toBe(1)
    expect(p.battersFaced).toBe(2)
  })
})

describe('batting order', () => {
  it('carries over between innings and lets a player bat twice in one inning', () => {
    const s = scenario('batting_around')
    expect(s.score.home).toBe(8)
    expect(s.batterLines['D1'].plateAppearances).toBe(2)
    expect(s.inning).toBe(1)
    expect(s.half).toBe('bottom')
    expect(s.nextBatterIndex.home).toBe(4) // 13 plate appearances, next is slot 5
  })
})

describe('game end', () => {
  it('ends on a walk-off as soon as the home side takes the lead', () => {
    const s = scenario('walk_off')
    expect(s.status).toBe('final')
    expect(s.finalReason).toBe('walk_off')
    expect(s.score).toEqual({ home: 1, opponent: 2 })
    expect(s.violations.some((v) => v.code === 'game_over')).toBe(true) // extra singles were ignored
  })

  it('plays extra innings with a runner on second and ends when the runner scores', () => {
    const s = scenario('extra_innings')
    expect(s.status).toBe('final')
    expect(s.inning).toBe(2)
    expect(s.score.opponent).toBe(2)
    expect(s.decisions.some((d) => /empieza en segunda/.test(d.text.es))).toBe(true)
  })

  it('applies the mercy rule after a complete inning', () => {
    const s = scenario('mercy')
    expect(s.status).toBe('final')
    expect(s.finalReason).toBe('mercy')
    expect(s.score.home).toBe(10)
  })

  it('ends as a tie when extra innings are off', () => {
    let s = createGame({ rules: { regulationInnings: 1, extraInningsAllowed: false }, battingFirst: 'home', lineups: { home: demoLineup('home'), opponent: demoLineup('opponent') } })
    const out = { type: 'ball_in_play', result: 'ground_out' } as const
    for (let i = 0; i < 6; i++) s = applyEvent(s, out)
    expect(s.status).toBe('final')
    expect(s.finalReason).toBe('tie')
  })
})

describe('substitutions', () => {
  it('loses the DH when the DH takes the field', () => {
    const s = scenario('dh')
    expect(s.hasDH.home).toBe(false)
    expect(s.violations.some((v) => v.code === 'dh_lost')).toBe(true)
  })

  it('handles pinch hitter and runner, and rejects re-entry when disabled', () => {
    const s = scenario('pinch')
    expect(s.removed.home).toContain('D1')
    expect(s.removed.home).toContain('DB1')
    expect(s.violations.some((v) => v.code === 'reentry_not_allowed')).toBe(true)
    // pinch runner took over first base, then held on the ground out
    expect(s.runners.map((r) => r.playerId)).toEqual(['DB2'])
    expect(s.lineups.home[0].playerId).toBe('DB2')
    expect(s.lineups.home[0].history.map((h) => h.playerId)).toEqual(['D1', 'DB1', 'DB2'])
  })

  it('allows re-entry of a starter into the same slot when the rule is on', () => {
    let s = createGame({ rules: { reentryAllowed: true }, battingFirst: 'home', lineups: { home: demoLineup('home'), opponent: demoLineup('opponent') } })
    s = applyEvent(s, { type: 'substitution', kind: 'pinch_hitter', side: 'home', outPlayerId: 'D1', inPlayer: { playerId: 'DB1', name: 'Felix', position: 'LF' } })
    s = applyEvent(s, { type: 'substitution', kind: 'defensive', side: 'home', outPlayerId: 'DB1', inPlayer: { playerId: 'D1', name: 'Cabral', position: 'LF' } })
    expect(s.violations.some((v) => v.code === 'reentry_not_allowed')).toBe(false)
    expect(s.lineups.home[0].playerId).toBe('D1')
  })
})

describe('pitching', () => {
  it('accumulates a full pitching line and splits it across a pitching change', () => {
    const s = scenario('pitching')
    const starter = s.pitcherLines['R8']
    const reliever = s.pitcherLines['RB3']
    expect(starter.pitches).toBe(10)
    expect(starter.strikeouts).toBe(1)
    expect(starter.walks).toBe(1)
    expect(starter.hits).toBe(1)
    expect(starter.homeRuns).toBe(1)
    expect(starter.runs).toBe(3)
    expect(starter.earnedRuns).toBe(2) // the runner who reached on error is unearned
    expect(starter.battersFaced).toBe(4)
    expect(starter.outs).toBe(1)
    expect(reliever.strikeouts).toBe(1)
    expect(reliever.outs).toBe(2)
    expect(inningsPitched(starter.outs)).toBe('0.1')
    expect(inningsPitched(reliever.outs)).toBe('0.2')
  })
})

describe('third out on the bases', () => {
  it('keeps the batter for the next inning and does not count the interrupted plate appearance', () => {
    const s = scenario('runner_out_ends_inning')
    expect(s.nextBatterIndex.home).toBe(3) // D4 leads off next time
    expect(s.batterLines['D4'].plateAppearances).toBe(0)
    expect(s.pitcherLines['R8'].battersFaced).toBe(3)
    expect(s.inning).toBe(2)
    expect(s.half).toBe('top')
    expect(s.currentBatter?.playerId).toBe('D4')
    expect(s.balls).toBe(0)
    expect(s.strikes).toBe(0)
  })
})

describe('two-scorer validation', () => {
  it('reports no differences for identical event streams and differences otherwise', () => {
    const a = scenario('pitching')
    const b = scenario('pitching')
    expect(diffStates(a, b)).toEqual([])
    const c = applyEvent(b, { type: 'pitch', call: 'ball' })
    expect(diffStates(a, c).length).toBeGreaterThan(0)
  })
})
