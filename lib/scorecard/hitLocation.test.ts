import { expect, it } from 'vitest'
import { drawnHitLocation, requiresHitLocation, validHitLocation } from './hitLocation'
import { HOME } from './geometry'
import { SCORING_PLAYS } from './plays'

it('requires a direction for every ball in play, regardless of input method', () => {
  for (const play of SCORING_PLAYS) expect(requiresHitLocation(play.code)).toBe(!['walk', 'strikeout', 'hit_by_pitch', 'catcher_interference'].includes(play.result))
  expect(requiresHitLocation('6-4-3')).toBe(true)
  expect(requiresHitLocation('DRAWING_SAVED')).toBe(false)
})
it('rejects a mark at home, invalid coordinates and nonfinite values', () => {
  for (const value of [null, HOME, [50, 89], [NaN, 20], [10, Infinity], [-1, 20], [101, 20], [30, 40, 50]]) expect(validHitLocation(value)).toBe(false)
  expect(validHitLocation([22, 40])).toBe(true)
})
it('accepts an existing trajectory but not a batter base path or handwritten result alone', () => {
  expect(drawnHitLocation([{ type: 'stroke', points: [HOME, [35, 65], [22, 40]] }])).toEqual([22, 40])
  expect(drawnHitLocation([{ type: 'stroke', points: [HOME, [66, 74]] }])).toBeNull()
  expect(drawnHitLocation([{ type: 'stroke', points: [[35, 20], [35, 35]] }])).toBeNull()
})
