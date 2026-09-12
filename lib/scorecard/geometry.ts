/**
 * Geometry of the scorecard box and the field, in box-relative units (0-100).
 * Shared by the interpreter, the classic box renderer, the Digital field
 * picker and the lab, so every view agrees on where things are.
 *
 * Layout: a real field seen from above. Home plate at the bottom, foul lines
 * at 45°, a small infield diamond, and the outfield up to the fence arc so
 * left, center and right field have room to point at.
 */
import type { Stroke } from '@/lib/handwriting/recognizer'

export type Pt = [number, number]

// Infield
export const HOME: Pt = [50, 90]
export const FIRST: Pt = [66, 74]
export const SECOND: Pt = [50, 58]
export const THIRD: Pt = [34, 74]
export const MOUND: Pt = [50, 78]
/** Bases in running order; index 0 = home plate (start), 4 = home (scored) */
export const BASE_PATH: Pt[] = [HOME, FIRST, SECOND, THIRD, HOME]

// Outfield
export const FENCE_RADIUS = 60 // from home plate; center field fence at y = 30
export const LEFT_POLE: Pt = [50 - FENCE_RADIUS * Math.SQRT1_2, 90 - FENCE_RADIUS * Math.SQRT1_2]
export const RIGHT_POLE: Pt = [50 + FENCE_RADIUS * Math.SQRT1_2, 90 - FENCE_RADIUS * Math.SQRT1_2]
export const INFIELD_RADIUS = 40 // grass line: closer than this is the infield

/** Fielder numbers at their usual spots, for the faint labels on the field */
export const FIELDERS: { n: number; at: Pt }[] = [
  { n: 1, at: [50, 72.5] }, { n: 2, at: [50, 95.5] }, { n: 3, at: [69, 66] }, { n: 4, at: [60, 61] }, { n: 5, at: [31, 66] },
  { n: 6, at: [40, 61] }, { n: 7, at: [26, 46] }, { n: 8, at: [50, 38] }, { n: 9, at: [74, 46] },
]

// Marks
export const OUT_MARK: Pt = [88, 91]
export const TALLY = 8 // tally box size: big enough for a finger on a phone
export const TALLY_GAP = 2.5
export const TALLY_TOLERANCE = 2.5 // taps this far outside a box still count
export const BALL_BOXES: Pt[] = [0, 1, 2].map((i) => [3 + i * (TALLY + TALLY_GAP), 3])
export const STRIKE_BOXES: Pt[] = [0, 1].map((i) => [97 - TALLY - i * (TALLY + TALLY_GAP), 3])

// Interpretation thresholds
export const TAP_LENGTH = 3 // strokes shorter than this are taps
export const BASE_RADIUS = 7 // tap radius around a base
export const PATH_END_RADIUS = 8 // how close a stroke must start/end to bases to count as a base path
export const PATH_MAX_DEVIATION = 6
export const HIT_START_RADIUS = 11
export const HIT_MIN_LENGTH = 14
export const OUT_AREA_RADIUS = 15 // strokes centered this close to the out mark belong to it

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])
export const strokeLength = (s: Stroke) => s.reduce((acc, p, i) => (i ? acc + dist(p as Pt, s[i - 1] as Pt) : 0), 0)
export const inBox = (p: Pt, b: Pt) =>
  p[0] >= b[0] - TALLY_TOLERANCE && p[0] <= b[0] + TALLY + TALLY_TOLERANCE && p[1] >= b[1] - TALLY_TOLERANCE && p[1] <= b[1] + TALLY + TALLY_TOLERANCE

export function bbox(s: Stroke) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of s) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

/** Distance from point p to the segment ab */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(p, a)
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return dist(p, [a[0] + t * dx, a[1] + t * dy])
}

/** Angle of a point seen from home plate: 0 = straight to center, -45 = left line, +45 = right line */
export function angleFromHome(p: Pt): number {
  return (Math.atan2(p[0] - HOME[0], HOME[1] - p[1]) * 180) / Math.PI
}

/**
 * Field area name for a point, using the vocabulary the scorebook already
 * stores: INFIELD, FOUL_LEFT/RIGHT, and LEFT/CENTER/RIGHT_FIELD_{SHALLOW|MEDIUM|DEEP}_{...}.
 */
export function fieldAreaAt(p: Pt): string {
  const a = angleFromHome(p)
  const d = dist(p, HOME)
  if (p[1] > HOME[1] || a < -45) return 'FOUL_LEFT'
  if (a > 45) return 'FOUL_RIGHT'
  if (d < INFIELD_RADIUS) return 'INFIELD'
  const depth = d < 47 ? 'SHALLOW' : d < 54 ? 'MEDIUM' : 'DEEP'
  if (a < -15) return `LEFT_FIELD_${depth}_${a < -35 ? 'LINE' : a < -25 ? 'GAP' : 'CENTER'}`
  if (a > 15) return `RIGHT_FIELD_${depth}_${a > 35 ? 'LINE' : a > 25 ? 'GAP' : 'CENTER'}`
  return `CENTER_FIELD_${depth}_${a < -5 ? 'LEFT_GAP' : a > 5 ? 'RIGHT_GAP' : 'CENTER'}`
}

export interface LandingData {
  fieldArea: string
  fieldZone: string
  hitDistance: string
  hitAngle: string
  xCoordinate: number
  yCoordinate: number
}

/** Coarse zone + exact point for a batted ball ending at p (box units). */
export function landingData(p: Pt): LandingData {
  const zone = fieldAreaAt(p)
  const a = angleFromHome(p)
  const d = dist(p, HOME)
  const fieldArea = zone.startsWith('FOUL') ? 'FOUL' : zone === 'INFIELD' ? 'INFIELD' : zone.split('_FIELD')[0] + '_FIELD'
  return {
    fieldArea,
    fieldZone: zone,
    hitDistance: d < INFIELD_RADIUS ? 'SHORT' : d < 54 ? 'MEDIUM' : 'DEEP',
    hitAngle: a < -15 ? 'PULL' : a > 15 ? 'OPPO' : 'CENTER',
    xCoordinate: Math.round(p[0] * 100) / 100,
    yCoordinate: Math.round(p[1] * 100) / 100,
  }
}
