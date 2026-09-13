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
  BALL_BOXES, BASE_PATH, BASE_RADIUS, FIRST, HIT_MIN_LENGTH, HIT_START_RADIUS, HOME, OUT_AREA_RADIUS, OUT_MARK,
  PATH_END_RADIUS, PATH_MAX_DEVIATION, SECOND, STRIKE_BOXES, TALLY, TALLY_BAND, TALLY_SLACK, TAP_LENGTH, THIRD, bbox, dist,
  distToSegment, inBox, strokeLength, type Pt,
} from './geometry'

export interface BaseRunners { first: boolean; second: boolean; third: boolean; home: boolean }
export const NO_BASES: BaseRunners = { first: false, second: false, third: false, home: false }

export type BoxAction = { type: 'stroke'; points: Stroke } | { type: 'tap'; point: Pt }

export type TallySide = 'balls' | 'strikes'

export type StrokeKind =
  | { kind: 'tap'; point: Pt }
  | { kind: 'tally'; side: TallySide; boxes: number[] }
  | { kind: 'base_path'; toBase: 1 | 2 | 3 | 4 }
  | { kind: 'hit_line'; end: Pt }
  | { kind: 'out_circle' }
  | { kind: 'out_digit' }
  | { kind: 'ink' }

export interface BoxMarks {
  bases: BaseRunners
  outNumber: number
  /** number of ball / strike boxes marked (derived from ballMarks / strikeMarks) */
  balls: number
  strikes: number
  /** which of the 3 ball boxes and 2 strike boxes carry a mark; each box is independent, like on paper */
  ballMarks: boolean[]
  strikeMarks: boolean[]
  hitLine: Stroke | null
  /** notation strokes (what the recognizer sees) */
  ink: Stroke[]
  /** strokes drawn along base paths */
  pathStrokes: Stroke[]
  outCircles: Stroke[]
  /** digit strokes written inside the out circle */
  outDigitStrokes: Stroke[]
  /** ticks, slashes and lines drawn over the ball / strike boxes (shown as drawn, like on paper) */
  tallyStrokes: Stroke[]
}

export interface Interpretation {
  marks: BoxMarks
  /** top matches for the notation ink, best first */
  tokenMatches: Match[]
  /** what the digit in the out circle was read as, when digit templates exist */
  outDigit: Match | null
  /** per-stroke classification, same order as the stroke actions */
  kinds: StrokeKind[]
}

/** Tokens that put the batter on a base by themselves */
export const TOKEN_BASE: Record<string, keyof BaseRunners> = {
  '1B': 'first', BB: 'first', HBP: 'first', E: 'first', FC: 'first', '2B': 'second', '3B': 'third', HR: 'home',
}
export const OUT_TOKENS = new Set(['K', 'Kc', 'F', 'L', 'P', 'SF', 'SAC', 'DP', '6-3', '4-3', '5-3', '1-3', '3-1', '6-4-3', '4-6-3'])

const baseIndex = (p: Pt): number => {
  // 0 = home plate (start), 1..3 bases; home as the destination is handled by the caller
  const candidates: [Pt, number][] = [[HOME, 0], [FIRST, 1], [SECOND, 2], [THIRD, 3]]
  let best = -1, bestD = Infinity
  for (const [pt, i] of candidates) {
    const d = dist(p, pt)
    if (d < PATH_END_RADIUS && d < bestD) { best = i; bestD = d }
  }
  return best
}

/**
 * A stroke over the ball / strike boxes: a tick, an X or a slash over one box,
 * or one line drawn across several boxes, the way a scorer marks the count on
 * paper. Returns the boxes the ink covers, or null when the stroke is not in
 * the row of boxes.
 */
export function tallyStroke(s: Stroke): { side: TallySide; boxes: number[] } | null {
  if (s.length === 0) return null
  const b = bbox(s)
  if (b.maxY > TALLY_BAND) return null
  const rows: [TallySide, Pt[]][] = [['balls', BALL_BOXES], ['strikes', STRIKE_BOXES]]
  for (const [side, list] of rows) {
    const left = Math.min(...list.map((k) => k[0])) - TALLY_SLACK
    const right = Math.max(...list.map((k) => k[0])) + TALLY + TALLY_SLACK
    if (b.minX < left || b.maxX > right) continue
    // Boxes the ink passes over (a little tolerance for a shaky hand)
    const boxes = list.map((_, i) => i).filter((i) => s.some((p) => p[0] >= list[i][0] - 1 && p[0] <= list[i][0] + TALLY + 1))
    if (boxes.length > 0) return { side, boxes }
    // Ink in a gap between boxes: the nearest box to its center
    let best = 0, bestD = Infinity
    list.forEach((k, i) => { const d = Math.abs(b.cx - (k[0] + TALLY / 2)); if (d < bestD) { best = i; bestD = d } })
    return { side, boxes: [best] }
  }
  return null
}

/** Classify one stroke. Pure. */
export function classifyStroke(s: Stroke): StrokeKind {
  if (s.length === 0) return { kind: 'ink' }
  const start = s[0] as Pt
  const end = s[s.length - 1] as Pt
  const length = strokeLength(s)
  const b = bbox(s)
  // A tick, an X, a slash or a line over the ball/strike boxes marks them
  const tally = tallyStroke(s)
  if (tally) return { kind: 'tally', ...tally }
  if (length < TAP_LENGTH || (b.w < 2.5 && b.h < 2.5)) return { kind: 'tap', point: start }

  // Base path: starts at a base (or home plate) and ends at a later base, hugging the path
  const from = baseIndex(start)
  const toRaw = baseIndex(end)
  if (from >= 0 && toRaw >= 0) {
    const to = toRaw === 0 && from > 0 ? 4 : toRaw
    if (to > from) {
      const maxDev = Math.max(...s.map((p) => Math.min(...Array.from({ length: to - from }, (_, k) => distToSegment(p as Pt, BASE_PATH[from + k], BASE_PATH[from + k + 1])))))
      if (maxDev < PATH_MAX_DEVIATION) return { kind: 'base_path', toBase: to as 1 | 2 | 3 | 4 }
    }
  }

  // Batted ball: leaves home plate into the field, does not end on a base
  if (dist(start, HOME) < HIT_START_RADIUS && length >= HIT_MIN_LENGTH && dist(end, HOME) > HIT_MIN_LENGTH && baseIndex(end) < 0 && end[1] < HOME[1]) {
    return { kind: 'hit_line', end }
  }

  // Marks near the out circle: a closed loop is the circle, anything else is the digit inside it
  if (dist([b.cx, b.cy], OUT_MARK) < OUT_AREA_RADIUS && b.w <= 26 && b.h <= 26) {
    const closed = dist(start, end) < Math.max(4, Math.max(b.w, b.h) * 0.35)
    if (closed && length > 12 && b.w >= 5 && b.h >= 5) return { kind: 'out_circle' }
    return { kind: 'out_digit' }
  }

  return { kind: 'ink' }
}

/** Apply a tap to the marks (returns a copy). */
export function applyTap(marks: BoxMarks, p: Pt): BoxMarks {
  const m: BoxMarks = { ...marks, bases: { ...marks.bases } }
  if (dist(p, FIRST) < BASE_RADIUS) { m.bases.first = !m.bases.first; m.bases.home = false; return m }
  if (dist(p, SECOND) < BASE_RADIUS) { m.bases.second = !m.bases.second; m.bases.home = false; return m }
  if (dist(p, THIRD) < BASE_RADIUS) { m.bases.third = !m.bases.third; m.bases.home = false; return m }
  if (dist(p, HOME) < BASE_RADIUS || dist(p, [50, 74]) < BASE_RADIUS) {
    m.bases = m.bases.home ? { ...NO_BASES } : { first: true, second: true, third: true, home: true }
    return m
  }
  if (dist(p, OUT_MARK) < BASE_RADIUS) { m.outNumber = (m.outNumber + 1) % 4; return m }
  const bi = BALL_BOXES.findIndex((b) => inBox(p, b))
  if (bi >= 0) return applyTally(m, 'balls', [bi], true)
  const si = STRIKE_BOXES.findIndex((b) => inBox(p, b))
  if (si >= 0) return applyTally(m, 'strikes', [si], true)
  return m
}

/**
 * Mark ball / strike boxes (returns a copy). Every box stands on its own, as on
 * paper: marking one box never fills the boxes before it, and the count is the
 * number of marked boxes. Ink over a box always marks it (so an X drawn in two
 * strokes stays marked); a tap toggles, so tapping a marked box clears it.
 */
export function applyTally(marks: BoxMarks, side: TallySide, boxes: number[], toggle = false): BoxMarks {
  const arr = [...(side === 'balls' ? marks.ballMarks : marks.strikeMarks)]
  for (const i of boxes) if (i >= 0 && i < arr.length) arr[i] = toggle ? !arr[i] : true
  const count = arr.filter(Boolean).length
  return side === 'balls' ? { ...marks, ballMarks: arr, balls: count } : { ...marks, strikeMarks: arr, strikes: count }
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
  return {
    bases: { ...NO_BASES }, outNumber: 0, balls: 0, strikes: 0,
    ballMarks: BALL_BOXES.map(() => false), strikeMarks: STRIKE_BOXES.map(() => false),
    hitLine: null, ink: [], pathStrokes: [], outCircles: [], outDigitStrokes: [], tallyStrokes: [],
  }
}

/**
 * Reduce the ordered actions to marks and recognize the notation ink.
 * `digitTemplates` (samples of 1, 2, 3 from the letters set) let a number
 * written inside the out circle set the out number directly.
 */
export function interpretBox(actions: BoxAction[], templates: Template[], digitTemplates: Template[] = []): Interpretation {
  let marks = emptyMarks()
  const kinds: StrokeKind[] = []
  let circles = 0
  for (const a of actions) {
    if (a.type === 'tap') { marks = applyTap(marks, a.point); continue }
    const k = classifyStroke(a.points)
    kinds.push(k)
    switch (k.kind) {
      case 'tap': marks = applyTap(marks, k.point); break
      case 'tally': marks = { ...applyTally(marks, k.side, k.boxes), tallyStrokes: [...marks.tallyStrokes, a.points] }; break
      case 'base_path': marks = { ...marks, bases: markBase(marks.bases, k.toBase), pathStrokes: [...marks.pathStrokes, a.points] }; break
      case 'hit_line': marks = { ...marks, hitLine: a.points }; break
      case 'out_circle': circles += 1; marks = { ...marks, outCircles: [...marks.outCircles, a.points] }; break
      case 'out_digit': marks = { ...marks, outDigitStrokes: [...marks.outDigitStrokes, a.points] }; break
      case 'ink': marks = { ...marks, ink: [...marks.ink, a.points] }; break
    }
  }
  // Out number: a readable digit wins, otherwise the number of circles, otherwise taps
  let outDigit: Match | null = null
  if (marks.outDigitStrokes.length && digitTemplates.length) {
    const digits = digitTemplates.filter((t) => ['1', '2', '3'].includes(t.symbol))
    outDigit = recognize(marks.outDigitStrokes, digits)[0] ?? null
  }
  if (outDigit) marks = { ...marks, outNumber: Number(outDigit.symbol) }
  else if (circles > 0 || marks.outDigitStrokes.length) marks = { ...marks, outNumber: Math.min(3, Math.max(marks.outNumber, circles || 1)) }

  const tokenMatches = marks.ink.length ? recognize(marks.ink, templates).slice(0, 3) : []
  return { marks, tokenMatches, outDigit, kinds }
}

/** Bases implied by a confirmed token when the scorer marked none. */
export function basesForToken(token: string, marked: BaseRunners): BaseRunners {
  if (marked.first || marked.second || marked.third || marked.home) return marked
  const base = TOKEN_BASE[token]
  if (!base) return marked
  if (base === 'home') return { first: true, second: true, third: true, home: true }
  return { ...NO_BASES, [base]: true }
}
