import { describe, expect, it } from 'vitest'
import { createGame } from '@/lib/rules/engine'
import { demoLineup } from '@/lib/rules/scenarios'
import { notationEvent, readInk, review, submit, type Room } from './workflow'

const now = '2026-09-22T00:00:00Z'
function initial(): Room {
  return { game_id: 'game', version: 0, home_team_id: 'a', opponent_team_id: 'b', names: { home: 'A', opponent: 'B' }, pending: null, history: [],
    state: createGame({ battingFirst: 'home', lineups: { home: demoLineup('home'), opponent: demoLineup('opponent') } }) }
}
const batting = { id: 'manager-a', side: 'home' as const }
const defending = { id: 'manager-b', side: 'opponent' as const }
const ink = [{ type: 'stroke' as const, points: [[20, 20], [40, 50]] as [number, number][] }]
const input = { id: 'play-1', notation: 'HR', ink }

describe('shared scorecard workflow', () => {
  it('preserves handwriting without changing confirmed score until acceptance', () => {
    const start = initial()
    const pending = submit(start, batting, input, now)
    expect(pending.state.score.home).toBe(0)
    expect(pending.pending?.ink).toEqual(ink)
    expect(pending.pending?.ink).not.toBe(ink)
    expect(start.pending).toBeNull()
    const accepted = review(pending, defending, input.id, true, '', now)
    expect(accepted.state.score.home).toBe(1)
    expect(accepted.history[0].ink).toEqual(ink)
    expect(accepted.history[0].reviewedBy).toBe(defending.id)
    expect(accepted.version).toBe(2)
    expect(accepted.pending).toBeNull()
  })
  it('retains rejected ink and note without changing baseball state', () => {
    const start = initial()
    const result = review(submit(start, batting, input, now), defending, input.id, false, 'It was a double', now)
    expect(result.state).toEqual(start.state)
    expect(result.history[0]).toMatchObject({ status: 'correction_requested', note: 'It was a double', ink })
    expect(submit(result, batting, { ...input, id: 'correction-2', notation: '2B' }, now).pending?.notation).toBe('2B')
  })
  it('rejects scoring by the defending manager or an observer', () => {
    expect(() => submit(initial(), defending, input, now)).toThrow('batting manager')
    expect(() => submit(initial(), { id: 'observer', side: null }, input, now)).toThrow('batting manager')
  })
  it('rejects self-validation and same-team validation for regular managers', () => {
    const room = submit(initial(), batting, input, now)
    expect(() => review(room, batting, input.id, true, '', now)).toThrow('opposing manager')
    expect(() => review(room, { ...defending, id: batting.id }, input.id, true, '', now)).toThrow('opposing manager')
    expect(() => review(room, { ...batting, id: 'second-coach' }, input.id, true, '', now)).toThrow('opposing manager')
  })
  it('lets a verified super-admin test both sides and labels the history', () => {
    const room = submit(initial(), { ...batting, adminTest: true }, input, now)
    const result = review(room, { id: batting.id, side: 'opponent', adminTest: true }, input.id, true, '', now)
    expect(result.state.score.home).toBe(1)
    expect(result.history[0].adminTest).toBe(true)
    expect(result.history[0].author).toBe(result.history[0].reviewedBy)
    expect(() => review(room, { ...batting, adminTest: true }, input.id, true, '', now)).toThrow('opposing manager')
  })
  it('prevents overwriting a pending play, duplicate acceptance, or replaying a processed ID', () => {
    const pending = submit(initial(), batting, input, now)
    expect(() => submit(pending, batting, { ...input, id: 'other' }, now)).toThrow('pending play')
    const accepted = review(pending, defending, input.id, true, '', now)
    expect(() => review(accepted, defending, input.id, true, '', now)).toThrow('no longer pending')
    expect(() => submit(accepted, batting, input, now)).toThrow('already processed')
  })
  it('requires an explanation for a correction', () => {
    expect(() => review(submit(initial(), batting, input, now), defending, input.id, false, ' ', now)).toThrow('Explain')
  })
  it('switches the scorer after the third confirmed out', () => {
    let room = initial()
    for (let i = 0; i < 3; i++) {
      const id = `out-${i}`
      room = review(submit(room, batting, { ...input, id, notation: '6-3' }, now), defending, id, true, '', now)
    }
    expect(room.state.battingSide).toBe('opponent')
    expect(room.state.half).toBe('bottom')
    expect(() => submit(room, batting, input, now)).toThrow('batting manager')
    expect(submit(room, defending, input, now).pending?.side).toBe('opponent')
  })
  it('rejects unknown notation and invalid or oversized ink', () => {
    expect(() => notationEvent('not a play')).toThrow('supported play')
    expect(() => readInk([{ type: 'stroke', points: [[Infinity, 1]] }])).toThrow()
    expect(() => readInk([{ type: 'tap', point: [101, 1] }])).toThrow()
    expect(() => readInk(Array(501).fill({ type: 'tap', point: [1, 1] }))).toThrow()
    expect(notationEvent('Kc')).toEqual({ type: 'plate_result', result: 'strikeout_looking' })
    expect(notationEvent('6-3')).toEqual({ type: 'ball_in_play', result: 'ground_out', fielders: [6, 3] })
  })
})
