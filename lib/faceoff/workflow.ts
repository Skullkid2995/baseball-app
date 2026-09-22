import { applyEvent, type GameEvent, type GameState, type Side } from '@/lib/rules/engine'
import { scoringPlay } from '@/lib/scorecard/plays'
import type { BoxAction } from '@/lib/scorecard/interpret'

export interface Proposal {
  id: string
  author: string
  side: Side
  notation: string
  ink: BoxAction[]
  event: GameEvent
  batter: string
  inning: number
  half: string
  status: 'pending' | 'accepted' | 'correction_requested'
  submittedAt: string
  reviewedBy?: string
  reviewedAt?: string
  note?: string
  adminTest?: boolean
  outNumber?: number
}
export interface Room {
  game_id: string
  version: number
  home_team_id: string
  opponent_team_id: string
  names: Record<Side, string>
  state: GameState
  pending: Proposal | null
  history: Proposal[]
}
export interface Actor { id: string; side: Side | null; adminTest?: boolean }
export class WorkflowError extends Error {}
const fail = (message: string): never => { throw new WorkflowError(message) }

export function readInk(value: unknown): BoxAction[] {
  if (!Array.isArray(value) || value.length > 500) return fail('Invalid scorecard ink')
  let total = 0
  const point = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)
  for (const a of value) {
    if (!a || typeof a !== 'object') return fail('Invalid scorecard ink')
    if (a.type === 'tap') { if (!point(a.point)) return fail('Invalid scorecard point'); total++ }
    else if (a.type === 'stroke' && Array.isArray(a.points) && a.points.length && a.points.every(point)) total += a.points.length
    else return fail('Invalid scorecard stroke')
  }
  if (total > 20000) return fail('Scorecard ink is too large')
  return structuredClone(value)
}

/** Explicit vocabulary: unknown handwriting must never silently become an out. */
export function notationEvent(raw: unknown): GameEvent {
  if (typeof raw !== 'string' || raw.length > 20) return fail('Choose a recognized play')
  const n = raw.trim().toUpperCase()
  const play = scoringPlay(n)
  if (!play) return fail('Choose a supported play; unknown notation cannot be submitted')
  const plate: Record<string, Extract<GameEvent, { type: 'plate_result' }>['result']> = {
    walk: 'walk', strikeout: 'strikeout', hit_by_pitch: 'hit_by_pitch', catcher_interference: 'catcher_interference',
  }
  if (play.result in plate) return { type: 'plate_result', result: play.code === 'KC' ? 'strikeout_looking' : play.code === 'IBB' ? 'intentional_walk' : plate[play.result] }
  const result = play.code === 'DP' ? 'double_play' : play.code === 'TP' ? 'triple_play' : play.result as Extract<GameEvent, { type: 'ball_in_play' }>['result']
  const fielders = /^[1-9](?:-[1-9])+$/.test(n) ? n.split('-').map(Number) : /^[FLPEU]-?[1-9]$|^[1-9]U$/.test(n) ? [Number(n.match(/[1-9]/)![0])] : undefined
  return { type: 'ball_in_play', result, ...(fielders ? { fielders } : {}) }

}

export function submit(room: Room, actor: Actor, input: { id: string; notation: unknown; ink: unknown }, now: string): Room {
  if (!actor.side || actor.side !== room.state.battingSide) return fail('Only the batting manager can score')
  if (room.pending) return fail('Wait for the pending play to be reviewed')
  if (room.state.status === 'final') return fail('The game has finished')
  if (!room.state.currentBatter) return fail('No batter in the lineup')
  if (room.history.some(p => p.id === input.id)) return fail('This submission was already processed; refresh the game')
  if (room.history.length >= 3000) return fail('Game history limit reached')
  const event = notationEvent(input.notation)
  if (event.type === 'ball_in_play') {
    const outs = event.result === 'double_play' ? 2 : event.result === 'triple_play' ? 3 : 0
    if (outs && (room.state.runners.length < outs - 1 || room.state.outs + outs > 3)) return fail('Not enough runners or outs remaining for this play')
  }
  const next = applyEvent(room.state, event)
  if (next.violations.some(v => v.seq === next.seq)) return fail('The rules engine rejected this play')
  return { ...room, version: room.version + 1, pending: {
    id: input.id, author: actor.id, side: actor.side, notation: String(input.notation).trim(), ink: readInk(input.ink), event,
    batter: room.state.batterLines[room.state.currentBatter.playerId].name,
    outNumber: scoringPlay(String(input.notation))?.outs ? Math.min(3, room.state.outs + (scoringPlay(String(input.notation))?.outs || 1)) : 0,
    inning: room.state.inning, half: room.state.half, status: 'pending', submittedAt: now, adminTest: actor.adminTest || false,
  } }
}

export function review(room: Room, actor: Actor, id: string, accept: boolean, note: string, now: string): Room {
  const p = room.pending
  if (!p || p.id !== id) return fail('This play is no longer pending; refresh the game')
  if (!actor.side || actor.side === p.side || (actor.id === p.author && !actor.adminTest)) return fail('Only the opposing manager can validate')
  if (!accept && !note.trim()) return fail('Explain the correction needed')
  if (note.length > 1000) return fail('Keep the note under 1000 characters')
  return { ...room, version: room.version + 1, pending: null,
    state: accept ? applyEvent(room.state, p.event) : room.state,
    history: [...room.history, { ...p, status: accept ? 'accepted' : 'correction_requested', reviewedBy: actor.id, reviewedAt: now, note: note.trim(), adminTest: !!(p.adminTest || actor.adminTest) }],
  }
}
