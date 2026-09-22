import type { BaseRunners } from './interpret'

export type PlayGroup = 'hit' | 'out' | 'reach'
export interface ScoringPlay {
  code: string
  en: string
  es: string
  group: PlayGroup
  result: string
  outs: number
  base: 0 | 1 | 2 | 3 | 4
  sharedOnly?: boolean
}

/** A batting result is explicit. Runner events and unfinished counts are never at-bats. */
export const SCORING_PLAYS: ScoringPlay[] = [
  { code: '1B', en: 'Single', es: 'Sencillo', group: 'hit', result: 'single', outs: 0, base: 1 },
  { code: '2B', en: 'Double', es: 'Doble', group: 'hit', result: 'double', outs: 0, base: 2 },
  { code: '3B', en: 'Triple', es: 'Triple', group: 'hit', result: 'triple', outs: 0, base: 3 },
  { code: 'HR', en: 'Home run', es: 'Jonrón', group: 'hit', result: 'home_run', outs: 0, base: 4 },
  { code: 'BUNT', en: 'Bunt single', es: 'Hit de toque', group: 'hit', result: 'single', outs: 0, base: 1 },
  { code: 'INF', en: 'Infield single', es: 'Hit al cuadro', group: 'hit', result: 'single', outs: 0, base: 1 },
  { code: 'GRD', en: 'Ground-rule double', es: 'Doble por regla', group: 'hit', result: 'double', outs: 0, base: 2 },
  { code: 'K', en: 'Strikeout swinging', es: 'Ponche con swing', group: 'out', result: 'strikeout', outs: 1, base: 0 },
  { code: 'KC', en: 'Strikeout looking', es: 'Ponche sin swing', group: 'out', result: 'strikeout', outs: 1, base: 0 },
  { code: 'GO', en: 'Ground out', es: 'Out por rodado', group: 'out', result: 'ground_out', outs: 1, base: 0 },
  { code: 'FO', en: 'Fly out', es: 'Out por elevado', group: 'out', result: 'fly_out', outs: 1, base: 0 },
  { code: 'LO', en: 'Line out', es: 'Out por línea', group: 'out', result: 'line_out', outs: 1, base: 0 },
  { code: 'PO', en: 'Pop out', es: 'Out por elevado corto', group: 'out', result: 'pop_out', outs: 1, base: 0 },
  { code: 'FOUL_OUT', en: 'Caught foul ball', es: 'Foul atrapado', group: 'out', result: 'fly_out', outs: 1, base: 0 },
  { code: 'BUNT_OUT', en: 'Bunt out', es: 'Out en toque', group: 'out', result: 'ground_out', outs: 1, base: 0 },
  { code: 'SF', en: 'Sacrifice fly', es: 'Elevado de sacrificio', group: 'out', result: 'sacrifice_fly', outs: 1, base: 0 },
  { code: 'SAC', en: 'Sacrifice bunt', es: 'Toque de sacrificio', group: 'out', result: 'sacrifice_bunt', outs: 1, base: 0 },
  { code: 'DP', en: 'Double play', es: 'Doble play', group: 'out', result: 'ground_out', outs: 2, base: 0 },
  { code: 'TP', en: 'Triple play', es: 'Triple play', group: 'out', result: 'ground_out', outs: 3, base: 0 },
  { code: 'BB', en: 'Walk', es: 'Base por bolas', group: 'reach', result: 'walk', outs: 0, base: 1 },
  { code: 'IBB', en: 'Intentional walk', es: 'Base intencional', group: 'reach', result: 'walk', outs: 0, base: 1 },
  { code: 'HBP', en: 'Hit by pitch', es: 'Golpeado', group: 'reach', result: 'hit_by_pitch', outs: 0, base: 1 },
  { code: 'E', en: 'Reached on error', es: 'Llega por error', group: 'reach', result: 'error', outs: 0, base: 1 },
  { code: 'FC', en: "Fielder’s choice", es: 'Selección del fildeador', group: 'reach', result: 'fielders_choice', outs: 0, base: 1 },
  { code: 'CI', en: 'Catcher interference', es: 'Interferencia del receptor', group: 'reach', result: 'catcher_interference', outs: 0, base: 1, sharedOnly: true },
]

const aliases: Record<string, string> = {
  H1: '1B', H2: '2B', H3: '3B', HIT: '1B', HOMER: 'HR', HOMERUN: 'HR',
  BUNT_SINGLE: 'BUNT', INFIELD_HIT: 'INF', INFIELD_SINGLE: 'INF', OUT: 'GO',
  SO: 'K', SK: 'K', STRIKEOUT_LOOKING: 'KC', F: 'FO', L: 'LO', P: 'PO', SH: 'SAC',
  SAC_FLY: 'SF', SAC_BUNT: 'SAC', FIELDERS_CHOICE_OUT: 'FC', FIELDER_CHOICE: 'FC',
  BUNT_GROUND_OUT: 'BUNT_OUT', '6-4-3': 'DP', '4-6-3': 'DP', '5-4-3': 'DP',
  DOUBLE_PLAY: 'DP', TRIPLE_PLAY: 'TP', INTENTIONAL_WALK: 'IBB',
}
export function scoringPlay(raw: string): ScoringPlay | null {
  const normalized = raw.trim().toUpperCase()
  const code = aliases[normalized] || normalized
  const play = SCORING_PLAYS.find(p => p.code === code || p.result.toUpperCase() === code)
  if (play) return play
  const fielder = code.match(/^([FLPE])-?([1-9])$/)
  if (fielder) return SCORING_PLAYS.find(p => p.code === ({ F: 'FO', L: 'LO', P: 'PO', E: 'E' }[fielder[1]]))!
  if (/^[1-9](?:-[1-9])+$/.test(code) || /^(?:U-?[1-9]|[1-9]U|FO-[123H])$/.test(code)) return SCORING_PLAYS.find(p => p.code === 'GO')!
  return null
}

export const emptyBases = (): BaseRunners => ({ first: false, second: false, third: false, home: false })
export function playBases(play: ScoringPlay): BaseRunners {
  const bases = emptyBases()
  if (play.base) bases[(['first', 'second', 'third', 'home'] as const)[play.base - 1]] = true
  return bases
}

export function isBatterOut(result: string) {
  return ['strikeout', 'strikeout_looking', 'ground_out', 'fly_out', 'line_out', 'pop_out', 'sacrifice_fly', 'sacrifice_bunt', 'double_play', 'triple_play'].includes(result)
}
/** Each legacy row represents ONE player. A batter result and their out flag are the same out. */
export function playerOuts(row: { result: string; base_runner_outs?: Partial<BaseRunners> | null }): number {
  return isBatterOut(row.result) || Object.values(row.base_runner_outs || {}).some(Boolean) ? 1 : 0
}

export function savedPlay(raw: string, bases = emptyBases(), outs = emptyBases()) {
  const play = scoringPlay(raw)
  if (!play || play.sharedOnly) throw new Error('Choose a batting result. Runner plays and foul balls do not finish an at-bat.')
  const markedOut = Object.values(outs).some(Boolean)
  const batterOut = play.outs > 0
  return {
    result: play.result,
    base_runners: batterOut ? emptyBases() : { ...bases, home: markedOut ? false : bases.home },
    base_runner_outs: batterOut ? { ...emptyBases(), first: true } : outs,
    runs_scored: !batterOut && !markedOut && bases.home ? 1 : 0,
  }
}
