import { describe, expect, it } from 'vitest'
import { classifyStroke, interpretBox, type BoxAction } from './interpret'
import { FIRST, HOME, OUT_MARK, SECOND, THIRD } from './geometry'

const line = (a: [number, number], b: [number, number], n = 12): [number, number][] =>
  Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / (n - 1), a[1] + ((b[1] - a[1]) * i) / (n - 1)])

const circle = (c: [number, number], r: number): [number, number][] =>
  Array.from({ length: 24 }, (_, i) => [c[0] + r * Math.cos((i / 23) * Math.PI * 2), c[1] + r * Math.sin((i / 23) * Math.PI * 2)])

describe('classifyStroke', () => {
  it('reads a stroke along the home-to-first path as reaching first', () => {
    expect(classifyStroke(line(HOME, FIRST))).toEqual({ kind: 'base_path', toBase: 1 })
  })
  it('reads a long stroke home-first-second as reaching second', () => {
    expect(classifyStroke([...line(HOME, FIRST), ...line(FIRST, SECOND)])).toEqual({ kind: 'base_path', toBase: 2 })
  })
  it('reads third-to-home as scoring', () => {
    expect(classifyStroke(line(THIRD, HOME))).toEqual({ kind: 'base_path', toBase: 4 })
  })
  it('reads a stroke from home into left field as the batted ball', () => {
    const k = classifyStroke(line(HOME, [22, 22]))
    expect(k.kind).toBe('hit_line')
  })
  it('reads a small circle in the corner as an out mark', () => {
    expect(classifyStroke(circle(OUT_MARK, 6)).kind).toBe('out_circle')
  })
  it('reads a short poke as a tap', () => {
    expect(classifyStroke([[50, 50], [50.5, 50.2]]).kind).toBe('tap')
  })
  it('reads writing in the middle as notation ink', () => {
    expect(classifyStroke(line([40, 40], [40, 60])).kind).toBe('ink')
  })
})

describe('interpretBox', () => {
  it('combines taps, path strokes, hit line, out circle and notation', () => {
    const actions: BoxAction[] = [
      { type: 'stroke', points: line(HOME, [35, 30]) }, // batted ball to left-center
      { type: 'stroke', points: line(HOME, FIRST) }, // reached first
      { type: 'tap', point: [SECOND[0], SECOND[1]] }, // then second (tap)
      { type: 'stroke', points: circle(OUT_MARK, 6) }, // an out was recorded (runner later)
      { type: 'stroke', points: line([45, 45], [45, 60]) }, // "1" of a notation
      { type: 'tap', point: [7.75, 7.75] }, // first ball box
      { type: 'tap', point: [92.25, 7.75] }, // first strike box
    ]
    const { marks, kinds } = interpretBox(actions, [])
    expect(marks.hitLine).not.toBeNull()
    expect(marks.bases).toEqual({ first: true, second: true, third: false, home: false })
    expect(marks.outNumber).toBe(1)
    expect(marks.ink.length).toBe(1)
    expect(marks.balls).toBe(1)
    expect(marks.strikes).toBe(1)
    expect(kinds.map((k) => k.kind)).toEqual(['hit_line', 'base_path', 'out_circle', 'ink'])
  })

  it('tapping home marks a run and tapping again clears it', () => {
    const home: BoxAction = { type: 'tap', point: [HOME[0], HOME[1]] }
    expect(interpretBox([home], []).marks.bases.home).toBe(true)
    expect(interpretBox([home, home], []).marks.bases.home).toBe(false)
  })
})
