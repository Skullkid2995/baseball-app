import type { BaseRunners } from './interpret'
import { isBatterOut, playerOuts, scoringPlay } from './plays'

export interface ScorebookPlay {
  result: string
  notation?: string
  base_runners?: Partial<BaseRunners> | null
  base_runner_outs?: Partial<BaseRunners> | null
  out_type?: string | null
  runs_scored?: number | null
}

const BASES = ['first', 'second', 'third', 'home'] as const
function furthestBase(flags?: Partial<BaseRunners> | null): number {
  return BASES.reduce((last, base, index) => flags?.[base] ? index + 1 : last, 0)
}

/** Reconstruct the completed base path from the saved player box, not the hit location. */
export function scorebookProgress(play?: ScorebookPlay | null) {
  if (!play) return { reached: 0, out: false, scored: false, occupied: 0 }
  const out = playerOuts(play) > 0
  // A strikeout/groundout also has an out flag at first; that isn't a reached base.
  if (isBatterOut(play.result)) return { reached: 0, out, scored: false, occupied: 0 }
  const scored = !out && (!!play.base_runners?.home || (play.runs_scored || 0) > 0 || scoringPlay(play.result)?.base === 4)
  if (scored) return { reached: 4, out, scored, occupied: 0 }
  const resultBase = scoringPlay(play.result)?.base || 0
  if (out) {
    // Runner-event updates clear occupancy and keep the runner's last safe base in the out flags.
    const hasLastSafeBase = ['TAGGED_OUT', 'FORCE_OUT', 'PICKED_OFF', 'CAUGHT_STEALING'].includes(play.out_type || '')
    const lastSafeBase = hasLastSafeBase ? furthestBase(play.base_runner_outs) : 0
    const safeFlags = { ...play.base_runners, home: false }
    for (const base of BASES) if (play.base_runner_outs?.[base]) safeFlags[base] = false
    return { reached: Math.min(3, Math.max(lastSafeBase, furthestBase(safeFlags), resultBase)), out, scored, occupied: 0 }
  }
  const reached = furthestBase(play.base_runners) || resultBase
  return { reached, out, scored, occupied: reached > 0 && reached < 4 ? reached : 0 }
}
