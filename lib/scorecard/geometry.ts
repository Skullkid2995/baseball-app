/**
 * Geometry of the classic scorecard box, in box-relative units (0-100).
 * Shared by the interpreter, the renderer and the lab.
 */
import type { Stroke } from '@/lib/handwriting/recognizer'

export type Pt = [number, number]

export const HOME: Pt = [50, 84]
export const FIRST: Pt = [82, 52]
export const SECOND: Pt = [50, 20]
export const THIRD: Pt = [18, 52]
/** Bases in running order; index 0 = home plate (start), 4 = home (scored) */
export const BASE_PATH: Pt[] = [HOME, FIRST, SECOND, THIRD, HOME]

export const OUT_MARK: Pt = [88, 89]
export const TALLY = 5.5 // tally box size
export const TALLY_GAP = 1.5
export const BALL_BOXES: Pt[] = [0, 1, 2].map((i) => [5 + i * (TALLY + TALLY_GAP), 5])
export const STRIKE_BOXES: Pt[] = [0, 1].map((i) => [95 - TALLY - i * (TALLY + TALLY_GAP), 5])

export const TAP_LENGTH = 3 // strokes shorter than this are taps
export const BASE_RADIUS = 9 // tap radius around a base
export const PATH_END_RADIUS = 13 // how close a stroke must start/end to bases to count as a base path
export const HIT_START_RADIUS = 13
export const HIT_MIN_LENGTH = 18

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])
export const strokeLength = (s: Stroke) => s.reduce((acc, p, i) => (i ? acc + dist(p as Pt, s[i - 1] as Pt) : 0), 0)
export const inBox = (p: Pt, b: Pt) => p[0] >= b[0] - 1 && p[0] <= b[0] + TALLY + 1 && p[1] >= b[1] - 1 && p[1] <= b[1] + TALLY + 1

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
  const dx = p[0] - HOME[0]
  const dy = HOME[1] - p[1]
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI // -90 (left line) .. +90 (right line)
  const d = dist(p, HOME)
  const side = angle < -20 ? 'LEFT' : angle > 20 ? 'RIGHT' : 'CENTER'
  const depth = d < 30 ? 'INFIELD' : d < 48 ? 'SHALLOW' : d < 62 ? 'MEDIUM' : 'DEEP'
  return {
    fieldArea: depth === 'INFIELD' ? 'INFIELD' : `${side}_FIELD`,
    fieldZone: depth === 'INFIELD' ? `INFIELD_${side}` : `${side}_FIELD_${depth}`,
    hitDistance: depth === 'INFIELD' ? 'SHORT' : depth === 'DEEP' ? 'DEEP' : 'MEDIUM',
    hitAngle: side === 'LEFT' ? 'PULL' : side === 'RIGHT' ? 'OPPO' : 'CENTER',
    xCoordinate: p[0],
    yCoordinate: p[1],
  }
}
