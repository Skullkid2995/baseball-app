import { HOME, type Pt } from './geometry'
import { scoringPlay } from './plays'
import { interpretBox, type BoxAction } from './interpret'

export function requiresHitLocation(notation: string): boolean {
  const play = scoringPlay(notation)
  return !!play && !['walk', 'strikeout', 'hit_by_pitch', 'catcher_interference'].includes(play.result)
}
export function validHitLocation(value: unknown): value is Pt {
  return Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100) && Math.hypot(value[0] - HOME[0], value[1] - HOME[1]) > 4
}
export function drawnHitLocation(actions: BoxAction[]): Pt | null {
  const line = interpretBox(actions, []).marks.hitLine
  const last = line?.[line.length - 1]
  return validHitLocation(last) ? last : null
}
