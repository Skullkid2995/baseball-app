import { scoringPlay } from './plays'

type BaseFlags = { first: boolean, second: boolean, third: boolean, home: boolean }
type RunnerBase = 'first' | 'second' | 'third'

/** A runner from another batter's box who is on base when this at-bat starts. */
export interface ActiveRunner {
  atBatId: string
  playerId?: string | null
  playerName: string
  notation?: string
  base: RunnerBase
}
export type RunnerMove = 'stay' | 'second' | 'third' | 'home' | 'out'
/** What to write into that runner's own box after this play. */
export interface RunnerUpdate {
  atBatId: string
  playerName: string
  move: RunnerMove
  base_runners: BaseFlags
  base_runner_outs: BaseFlags
  out_type: string
  runs_scored: number
}

export const NO_BASES: BaseFlags = { first: false, second: false, third: false, home: false }
const BASE_ORDER: ('first' | 'second' | 'third' | 'home')[] = ['first', 'second', 'third', 'home']
export const BASE_SHORT: Record<string, string> = { first: '1B', second: '2B', third: '3B', home: 'Home' }
export const RESULT_LABEL: Record<string, string> = {
  H1: 'Single', H2: 'Double', H3: 'Triple', HR: 'Home run', BB: 'Walk', HBP: 'Hit by pitch', E: 'Error', FC: "Fielder's choice",
  BUNT: 'Bunt', SAC: 'Sacrifice bunt', SF: 'Sacrifice fly', GO: 'Ground out', FO: 'Fly out', LO: 'Line out', PO: 'Pop out',
  BUNT_OUT: 'Bunt out', K: 'Strikeout',
}

function advance(base: RunnerBase, n: number): RunnerMove {
  if (n <= 0) return 'stay'
  return BASE_ORDER[Math.min(BASE_ORDER.indexOf(base) + n, 3)] as RunnerMove
}

/** What usually happens to each runner on this result. The scorer can change every one. */
export function defaultRunnerMoves(result: string, runners: ActiveRunner[]): Record<string, RunnerMove> {
  const p = scoringPlay(result)
  result = p?.code || result
  const on = {
    first: runners.some((r) => r.base === 'first'),
    second: runners.some((r) => r.base === 'second'),
  }
  const moves: Record<string, RunnerMove> = {}
  for (const r of runners) {
    let m: RunnerMove = 'stay'
    switch (result) {
      case 'HR':
      case '3B':
        m = 'home'
        break
      case '2B':
      case 'GRD':
        m = r.base === 'first' ? 'third' : 'home'
        break
      case '1B':
      case 'INF':
      case 'E':
      case 'BUNT':
      case 'SAC':
        m = advance(r.base, 1)
        break
      case 'BB':
      case 'IBB':
      case 'HBP':
        // Only forced runners move
        if (r.base === 'first') m = 'second'
        else if (r.base === 'second') m = on.first ? 'third' : 'stay'
        else m = on.first && on.second ? 'home' : 'stay'
        break
      case 'SF':
        m = r.base === 'third' ? 'home' : 'stay'
        break
      default:
        m = 'stay'
    }
    if (['DP', 'TP', 'FC'].includes(result)) {
      const lead = [...runners].sort((a,b) => BASE_ORDER.indexOf(a.base) - BASE_ORDER.indexOf(b.base))
      const retire = result === 'TP' ? 2 : 1
      if (lead.slice(0,retire).some(x => x.atBatId === r.atBatId)) m = 'out'
    }
    moves[r.atBatId] = m
  }
  return moves
}

export function runnerUpdateFor(r: ActiveRunner, move: RunnerMove, result: string): RunnerUpdate {
  const base_runners: BaseFlags = { ...NO_BASES }
  const base_runner_outs: BaseFlags = { ...NO_BASES }
  let out_type = ''
  let runs_scored = 0
  if (move === 'stay') base_runners[r.base] = true
  else if (move === 'out') {
    base_runner_outs[r.base] = true
    out_type = ['FC', 'GO', 'BUNT_OUT', 'SAC', 'H1', 'E', 'BUNT'].includes(result) ? 'FORCE_OUT' : 'TAGGED_OUT'
  } else if (move === 'home') {
    base_runners.home = true
    runs_scored = 1
  } else base_runners[move] = true
  return { atBatId: r.atBatId, playerName: r.playerName, move, base_runners, base_runner_outs, out_type, runs_scored }
}

export const countScored = (moves: Record<string, RunnerMove>) => Object.values(moves).filter((m) => m === 'home').length

/** Count the actual marked outs, not a DP/TP label awaiting runner selection. */
export function inningEndsOnPlay(outsBefore: number, batterRetired: boolean, updates: RunnerUpdate[]): boolean {
  return outsBefore + Number(batterRetired) + updates.filter(u => u.move === 'out').length >= 3
}

export function thirdOutCancelsRuns(outsBefore: number, batterRetired: boolean, batterOutBeforeFirst: boolean, updates: RunnerUpdate[]): boolean {
  const runnerOuts = updates.filter(u => u.move === 'out')
  return outsBefore + Number(batterRetired) + runnerOuts.length >= 3 &&
    (batterOutBeforeFirst || runnerOuts.some(u => u.out_type === 'FORCE_OUT'))
}
