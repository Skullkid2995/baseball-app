/**
 * Interprets what a scorer put in a classic scorecard box.
 *
 * Input is the ordered list of actions on the box: strokes (ink) and taps.
 * Output is the set of marks the box shows and the data behind them:
 * bases reached, out number, ball/strike tallies, the batted-ball line, and
 * the notation strokes that go to the handwriting recognizer.
 *
 * Every rule here is deliberately simple and tunable; the scorecard lab
 * collects real samples so the thresholds can be adjusted with evidence.
 */
import { recognize, type Match, type Stroke, type Template } from '@/lib/handwriting/recognizer'
import {
  BALL_BOXES, BASE_PATH, BASE_RADIUS, FIRST, HIT_MIN_LENGTH, HIT_START_RADIUS, HOME, OUT_MARK, PATH_END_RADIUS, SECOND,
  STRIKE_BOXES, TAP_LENGTH, THIRD, bbox, dist, distToSegment, inBox, strokeLength, type Pt,
} from './geometry'

export interface BaseRunners { first: boolean; second: boolean; third: boolean; home: boolean }
export const NO_BASES: BaseRunners = { first: false, second: false, third: false, home: false }

export type BoxAction = { type: 'stroke'; points: Stroke } | { type: 'tap'; point: Pt }

export type StrokeKind =
  | { kind: 'tap'; point: Pt }
  | { kind: 'base_path'; toBase: 1 | 2 | 3 | 4 }
  | { kind: 'hit_line'; end: Pt }
  | { kind: 'out_circle' }
  | { kind: 'ink' }

export interface BoxMarks {
  bases: BaseRunners
  outNumber: number
  balls: number
  strikes: number
  hitLine: Stroke | null
  /** notation strokes (what the recognizer sees) */
  ink: Stroke[]
  /** strokes drawn along base paths, kept so they can be undone */
  pathStrokes: Stroke[]
  outCircles: Stroke[]
}

export interface Interpretation {
  marks: BoxMarks
  /** top matches for the notation ink, best first */
  tokenMatches: Match[]
  /** per-stroke classification, same order as the stroke actions */
  kinds: StrokeKind[]
}

/** Tokens that put the batter on a base by themselves */
export const TOKEN_BASE: Record<string, keyof BaseRunners> = {
  '1B': 'first', BB: 'first', HBP: 'first', E: 'first', FC: 'first', '2B': 'second', '3B': 'third', HR: 'home',
}
export const OUT_TOKENS = new Set(['K', 'Kc', 'F', 'L', 'P', 'SF', 'SAC', 'DP', '6-3', '4-3', '5-3', '1-3', '3-1', '6-4-3', '4-6-3'])

const baseIndex = (p: Pt): number => {
  // 0 = home plate (start), 1..3 bases, 4 = home (scored) is the same point as 0
  const candidates: [Pt, number][] = [[HOME, 0], [FIRST, 1], [SECOND, 2], [THIRD, 3]]
  let best = -1, bestD = Infinity
  for (const [pt, i] of candidates) {
    const d = dist(p, pt)
    if (d < PATH_END_RADIUS && d < bestD) { best = i; bestD = d }
  }
  return best
}

/** Classify one stroke. Pure. */
export function classifyStroke(s: Stroke): StrokeKind {
  if (s.length === 0) return { kind: 'ink' }
  const start = s[0] as Pt
  const end = s[s.length - 1] as Pt
  const length = strokeLength(s)
  if (length < TAP_LENGTH) return { kind: 'tap', point: start }

  // Base path: starts at a base (or home plate) and ends at a later base, hugging the path
  const from = baseIndex(start)
  const toRaw = baseIndex(end)
  if (from >= 0 && toRaw >= 0) {
    // ending at home plate after leaving a base means the runner scored (index 4)
    const to = toRaw === 0 && from > 0 ? 4 : toRaw
    if (to > from) {
      // every point must stay close to the polyline from..to
      const maxDev = Math.max(...s.map((p) => Math.min(...Array.from({ length: to - from }, (_, k) => distToSegment(p as Pt, BASE_PATH[from + k], BASE_PATH[from + k + 1])))))
      if (maxDev < 9) return { kind: 'base_path', toBase: to as 1 | 2 | 3 | 4 }
    }
  }

  // Batted ball: leaves home plate into the field, does not end on a base
  if (dist(start, HOME) < HIT_START_RADIUS && length >= HIT_MIN_LENGTH && dist(end, HOME) > HIT_MIN_LENGTH && baseIndex(end) < 0) {
    return { kind: 'hit_line', end }
  }

  // Out circle: a small closed loop in the lower-right corner
  const b = bbox(s)
  const closed = dist(start, end) < Math.max(4, b.w * 0.35)
  if (closed && length > 12 && b.w >= 5 && b.w <= 24 && b.h >= 5 && b.h <= 24 && dist([b.cx, b.cy], OUT_MARK) < 16) {
    return { kind: 'out_circle' }
  }

  return { kind: 'ink' }
}

/** Apply a tap to the marks (mutates a copy). */
export function applyTap(marks: BoxMarks, p: Pt): BoxMarks {
  const m: BoxMarks = { ...marks, bases: { ...marks.bases } }
  if (dist(p, FIRST) < BASE_RADIUS) { m.bases.first = !m.bases.first; m.bases.home = false; return m }
  if (dist(p, SECOND) < BASE_RADIUS) { m.bases.second = !m.bases.second; m.bases.home = false; return m }
  if (dist(p, THIRD) < BASE_RADIUS) { m.bases.third = !m.bases.third; m.bases.home = false; return m }
  if (dist(p, HOME) < BASE_RADIUS || dist(p, [50, 52]) < BASE_RADIUS) {
    m.bases = m.bases.home ? { ...NO_BASES } : { first: true, second: true, third: true, home: true }
    return m
  }
  if (dist(p, OUT_MARK) < BASE_RADIUS) { m.outNumber = (m.outNumber + 1) % 4; return m }
  const bi = BALL_BOXES.findIndex((b) => inBox(p, b))
  if (bi >= 0) { m.balls = m.balls >= bi + 1 ? bi : bi + 1; return m }
  const si = STRIKE_BOXES.findIndex((b) => inBox(p, b))
  if (si >= 0) { m.strikes = m.strikes >= si + 1 ? si : si + 1; return m }
  return m
}

function markBase(bases: BaseRunners, toBase: 1 | 2 | 3 | 4): BaseRunners {
  if (toBase === 4) return { first: true, second: true, third: true, home: true }
  const b = { ...bases, home: false }
  if (toBase >= 1) b.first = true
  if (toBase >= 2) b.second = true
  if (toBase >= 3) b.third = true
  return b
}

export function emptyMarks(): BoxMarks {
  return { bases: { ...NO_BASES }, outNumber: 0, balls: 0, strikes: 0, hitLine: null, ink: [], pathStrokes: [], outCircles: [] }
}

/** Reduce the ordered actions to marks and recognize the notation ink. */
export function interpretBox(actions: BoxAction[], templates: Template[]): Interpretation {
  let marks = emptyMarks()
  const kinds: StrokeKind[] = []
  for (const a of actions) {
    if (a.type === 'tap') { marks = applyTap(marks, a.point); continue }
    const k = classifyStroke(a.points)
    kinds.push(k)
    switch (k.kind) {
      case 'tap': marks = applyTap(marks, k.point); break
      case 'base_path': marks = { ...marks, bases: markBase(marks.bases, k.toBase), pathStrokes: [...marks.pathStrokes, a.points] }; break
      case 'hit_line': marks = { ...marks, hitLine: a.points }; break
      case 'out_circle': marks = { ...marks, outNumber: Math.min(3, marks.outNumber + 1), outCircles: [...marks.outCircles, a.points] }; break
      case 'ink': marks = { ...marks, ink: [...marks.ink, a.points] }; break
    }
  }
  const tokenMatches = marks.ink.length ? recognize(marks.ink, templates).slice(0, 3) : []
  return { marks, tokenMatches, kinds }
}

/** Bases implied by a confirmed token when the scorer marked none. */
export function basesForToken(token: string, marked: BaseRunners): BaseRunners {
  if (marked.first || marked.second || marked.third || marked.home) return marked
  const base = TOKEN_BASE[token]
  if (!base) return marked
  if (base === 'home') return { first: true, second: true, third: true, home: true }
  return { ...NO_BASES, [base]: true }
}
