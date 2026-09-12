/**
 * Runner events during an at-bat: stolen base, caught stealing, pickoff,
 * wild pitch, passed ball, balk. Pure helpers shared by the Digital dialog,
 * the Classic pad and the scorebook that persists them.
 */
export type RunnerBase = 'first' | 'second' | 'third'
export type ToBase = 'second' | 'third' | 'home'
export type RunnerEventType = 'SB' | 'CS' | 'PK' | 'WP' | 'PB' | 'BK' | 'ADV'

export interface BaseFlags {
  first: boolean
  second: boolean
  third: boolean
  home: boolean
}

export interface RunnerEventInput {
  runnerAtBatId: string
  runnerPlayerId?: string | null
  runnerName: string
  type: RunnerEventType
  fromBase: RunnerBase
  toBase: ToBase
  isOut: boolean
  /** SB only: with throw (true) / no throw (false) */
  throw?: boolean | null
  /** positions involved, e.g. '1-3-6' */
  fielders?: string | null
  enteredVia: 'classic' | 'digital'
}

export const RUNNER_TOKENS = new Set(['SB', 'CS', 'PK', 'WP', 'PB', 'BK'])
export const BASE_ORDER: RunnerBase[] = ['first', 'second', 'third']

export function nextBase(from: RunnerBase): ToBase {
  return from === 'first' ? 'second' : from === 'second' ? 'third' : 'home'
}

export const BASE_SHORT: Record<string, string> = { first: '1B', second: '2B', third: '3B', home: 'Home' }

export const EVENT_LABELS: Record<RunnerEventType, { es: string; en: string }> = {
  SB: { es: 'Base robada', en: 'Stolen base' },
  CS: { es: 'Out robando', en: 'Caught stealing' },
  PK: { es: 'Pickoff', en: 'Pickoff' },
  WP: { es: 'Wild pitch', en: 'Wild pitch' },
  PB: { es: 'Passed ball', en: 'Passed ball' },
  BK: { es: 'Balk', en: 'Balk' },
  ADV: { es: 'Avanza', en: 'Advances' },
}

/** Is the event an out for the runner? */
export function eventIsOut(type: RunnerEventType): boolean {
  return type === 'CS' || type === 'PK'
}

/** Notation for the runner's box, like the paper sheet: SB, SB(t), CS 2-6, PK 1-3 */
export function eventNotation(ev: Pick<RunnerEventInput, 'type' | 'throw' | 'fielders'>): string {
  if (ev.type === 'SB') return ev.throw ? 'SB (t)' : 'SB'
  if (ev.fielders) return `${ev.type} ${ev.fielders}`
  return ev.type
}

/** The patch to write on the runner's at_bats row after the event. */
export function applyRunnerEvent(
  row: { base_runners?: BaseFlags | null; base_runner_outs?: BaseFlags | null; runs_scored?: number | null; stolen_bases?: number | null },
  ev: Pick<RunnerEventInput, 'type' | 'fromBase' | 'toBase' | 'isOut'>
): { base_runners: BaseFlags; base_runner_outs: BaseFlags; runs_scored: number; stolen_bases: number; out_type?: string } {
  const none: BaseFlags = { first: false, second: false, third: false, home: false }
  const outs: BaseFlags = { ...none, ...(row.base_runner_outs ?? {}) }
  if (ev.isOut) {
    outs[ev.fromBase] = true
    return {
      base_runners: { ...none },
      base_runner_outs: outs,
      runs_scored: row.runs_scored ?? 0,
      stolen_bases: row.stolen_bases ?? 0,
      out_type: ev.type === 'PK' ? 'PICKED_OFF' : 'CAUGHT_STEALING',
    }
  }
  const bases: BaseFlags = { ...none }
  bases[ev.toBase] = true
  return {
    base_runners: bases,
    base_runner_outs: outs,
    runs_scored: ev.toBase === 'home' ? 1 : row.runs_scored ?? 0,
    stolen_bases: (row.stolen_bases ?? 0) + (ev.type === 'SB' ? 1 : 0),
  }
}

/** Where a runner stands according to their box (null when not on base, out, or scored). */
export function runnerBaseOf(row: { base_runners?: BaseFlags | null; base_runner_outs?: BaseFlags | null }): RunnerBase | null {
  const b = row.base_runners
  if (!b || b.home) return null
  const base: RunnerBase | null = b.third ? 'third' : b.second ? 'second' : b.first ? 'first' : null
  if (!base) return null
  if (row.base_runner_outs?.[base]) return null
  return base
}
