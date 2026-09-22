/**
 * Game engine: a pure reducer over scoring events.
 *
 *   state' = applyEvent(state, event)
 *
 * Everything the scorecard shows (count, outs, runners, score, who bats next,
 * pitcher lines) is derived from the ordered list of events, so corrections are
 * just "void an event and replay". Two scorers (one per team) can be compared
 * by replaying both event lists and diffing the resulting states.
 *
 * Nothing here depends on React or the database.
 */
import { DEFAULT_RULES, type Lang, type RuleSet } from './config'

export type Side = 'home' | 'opponent'
export const otherSide = (s: Side): Side => (s === 'home' ? 'opponent' : 'home')

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------
export interface LineupPlayer {
  playerId: string
  name: string
  position: string // P C 1B 2B 3B SS LF CF RF DH
}

export interface LineupInput {
  side: Side
  batters: LineupPlayer[] // batting order, 9 (or 9 + the pitcher listed separately with a DH)
  pitcher?: LineupPlayer // when a DH bats for the pitcher
  bench?: LineupPlayer[]
}

export interface LineupSlot {
  order: number // 1-based
  playerId: string
  name: string
  position: string
  /** Everyone who has occupied this slot, first is the starter */
  history: { playerId: string; name: string; enteredAt: number }[]
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export type PitchCall = 'ball' | 'strike_looking' | 'strike_swinging' | 'foul' | 'foul_tip' | 'hit_by_pitch' | 'in_play'

export type BallInPlayResult =
  | 'single' | 'double' | 'triple' | 'home_run'
  | 'ground_out' | 'fly_out' | 'line_out' | 'pop_out'
  | 'error' | 'fielders_choice' | 'sacrifice_fly' | 'sacrifice_bunt'
  | 'double_play' | 'triple_play'

export type Base = 1 | 2 | 3 | 4 // 4 = home (scored)

export interface RunnerMove {
  playerId: string
  to: Base | 'out'
}

export type GameEvent =
  | { type: 'pitch'; call: PitchCall }
  | {
      type: 'ball_in_play'
      result: BallInPlayResult
      fielders?: number[] // e.g. [6, 3]
      hitX?: number; hitY?: number
      trajectory?: 'ground' | 'line' | 'fly' | 'popup' | 'bunt'
      /** Explicit runner movement; when omitted the engine applies default advancement */
      runners?: RunnerMove[]
      rbi?: number
    }
  | { type: 'plate_result'; result: 'walk' | 'intentional_walk' | 'strikeout' | 'strikeout_looking' | 'hit_by_pitch' | 'catcher_interference' }
  | { type: 'runner'; action: 'stolen_base' | 'caught_stealing' | 'wild_pitch' | 'passed_ball' | 'balk' | 'pickoff' | 'advance' | 'out'; playerId: string; to?: Base }
  | {
      type: 'substitution'
      kind: 'pinch_hitter' | 'pinch_runner' | 'courtesy_runner' | 'pitching_change' | 'defensive'
      side: Side
      outPlayerId: string
      inPlayer: LineupPlayer
    }
  | { type: 'position_change'; side: Side; playerId: string; position: string }
  | { type: 'end_game'; reason: 'time_limit' | 'forfeit' | 'weather' | 'agreement' }

export interface LoggedEvent {
  id: string
  seq: number
  event: GameEvent
  /** Set when a later correction voided this event */
  voided?: boolean
}

// ---------------------------------------------------------------------------
// Stats lines
// ---------------------------------------------------------------------------
export interface PitcherLine {
  playerId: string
  name: string
  side: Side
  pitches: number
  balls: number
  strikes: number // called, swinging, foul and in-play pitches
  battersFaced: number
  outs: number // innings pitched = outs / 3
  hits: number
  runs: number
  earnedRuns: number
  walks: number
  intentionalWalks: number
  strikeouts: number
  hitBatters: number
  homeRuns: number
  wildPitches: number
  balks: number
  pickoffs: number
  groundOuts: number
  flyOuts: number
  firstPitchStrikes: number
  entered: { inning: number; half: 'top' | 'bottom' }
}

export interface BatterLine {
  playerId: string
  name: string
  side: Side
  plateAppearances: number
  atBats: number
  hits: number
  doubles: number
  triples: number
  homeRuns: number
  runs: number
  rbi: number
  walks: number
  strikeouts: number
  hitByPitch: number
  sacrificeFlies: number
  sacrificeBunts: number
  stolenBases: number
  caughtStealing: number
  pitchesSeen: number
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
export interface Runner {
  playerId: string
  name: string
  base: 1 | 2 | 3
  /** pitcher charged if this runner scores */
  responsiblePitcher: string | null
  reachedOnError: boolean
}

export interface Violation {
  code:
    | 'batting_out_of_order'
    | 'reentry_not_allowed'
    | 'courtesy_runner_not_allowed'
    | 'pitch_count_limit'
    | 'pitch_count_warning'
    | 'dh_lost'
    | 'minimum_batters'
    | 'game_over'
    | 'invalid_event'
  message: Record<Lang, string>
  seq: number
}

export interface Decision {
  seq: number
  inning: number
  half: 'top' | 'bottom'
  text: Record<Lang, string>
}

export interface GameState {
  rules: RuleSet
  battingFirst: Side
  status: 'pending' | 'in_progress' | 'final'
  finalReason?: string
  inning: number
  half: 'top' | 'bottom'
  battingSide: Side
  outs: number
  balls: number
  strikes: number
  runners: Runner[]
  score: Record<Side, number>
  inningRuns: Record<Side, number[]>
  lineups: Record<Side, LineupSlot[]>
  bench: Record<Side, LineupPlayer[]>
  /** players removed from the game (cannot re-enter unless rules allow) */
  removed: Record<Side, string[]>
  hasDH: Record<Side, boolean>
  currentPitcher: Record<Side, string | null> // pitcher for the FIELDING side, keyed by that side
  nextBatterIndex: Record<Side, number> // 0-based index into lineups[side]
  currentBatter: { side: Side; slot: number; playerId: string; pitchesSeen: number; firstPitch: boolean } | null
  pitcherLines: Record<string, PitcherLine>
  batterLines: Record<string, BatterLine>
  pitcherBattersFaced: Record<string, number> // batters faced since entering (for minimum batters rule)
  seq: number
  decisions: Decision[]
  violations: Violation[]
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
export function createGame(opts: {
  rules?: Partial<RuleSet>
  battingFirst: Side
  lineups: Record<Side, LineupInput>
}): GameState {
  const rules = { ...DEFAULT_RULES, ...(opts.rules || {}) }
  const mk = (input: LineupInput): LineupSlot[] =>
    input.batters.map((p, i) => ({ order: i + 1, playerId: p.playerId, name: p.name, position: p.position, history: [{ playerId: p.playerId, name: p.name, enteredAt: 0 }] }))
  const pitcherOf = (input: LineupInput): LineupPlayer | undefined =>
    input.pitcher || input.batters.find((p) => p.position === 'P')

  const state: GameState = {
    rules,
    battingFirst: opts.battingFirst,
    status: 'in_progress',
    inning: 1,
    half: 'top',
    battingSide: opts.battingFirst,
    outs: 0,
    balls: 0,
    strikes: 0,
    runners: [],
    score: { home: 0, opponent: 0 },
    inningRuns: { home: [], opponent: [] },
    lineups: { home: mk(opts.lineups.home), opponent: mk(opts.lineups.opponent) },
    bench: { home: opts.lineups.home.bench || [], opponent: opts.lineups.opponent.bench || [] },
    removed: { home: [], opponent: [] },
    hasDH: {
      home: opts.lineups.home.batters.some((p) => p.position === 'DH'),
      opponent: opts.lineups.opponent.batters.some((p) => p.position === 'DH'),
    },
    currentPitcher: { home: null, opponent: null },
    nextBatterIndex: { home: 0, opponent: 0 },
    currentBatter: null,
    pitcherLines: {},
    batterLines: {},
    pitcherBattersFaced: {},
    seq: 0,
    decisions: [],
    violations: [],
  }
  for (const side of ['home', 'opponent'] as Side[]) {
    const p = pitcherOf(opts.lineups[side])
    if (p) {
      state.currentPitcher[side] = p.playerId
      state.pitcherLines[p.playerId] = newPitcherLine(p, side, 1, 'top')
      state.pitcherBattersFaced[p.playerId] = 0
    }
    for (const b of opts.lineups[side].batters) state.batterLines[b.playerId] = newBatterLine(b, side)
  }
  log(state, {
    es: `Juego iniciado. Batea primero: ${sideName(state, opts.battingFirst, 'es')}.`,
    en: `Game started. ${sideName(state, opts.battingFirst, 'en')} bats first.`,
  })
  startPlateAppearance(state)
  return state
}

function newPitcherLine(p: LineupPlayer, side: Side, inning: number, half: 'top' | 'bottom'): PitcherLine {
  return {
    playerId: p.playerId, name: p.name, side, pitches: 0, balls: 0, strikes: 0, battersFaced: 0, outs: 0, hits: 0, runs: 0,
    earnedRuns: 0, walks: 0, intentionalWalks: 0, strikeouts: 0, hitBatters: 0, homeRuns: 0, wildPitches: 0, balks: 0,
    pickoffs: 0, groundOuts: 0, flyOuts: 0, firstPitchStrikes: 0, entered: { inning, half },
  }
}

function newBatterLine(p: LineupPlayer, side: Side): BatterLine {
  return {
    playerId: p.playerId, name: p.name, side, plateAppearances: 0, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
    runs: 0, rbi: 0, walks: 0, strikeouts: 0, hitByPitch: 0, sacrificeFlies: 0, sacrificeBunts: 0, stolenBases: 0,
    caughtStealing: 0, pitchesSeen: 0,
  }
}

// ---------------------------------------------------------------------------
// Replay helpers
// ---------------------------------------------------------------------------
export function replay(initial: GameState, events: LoggedEvent[]): GameState {
  let state = structuredClone(initial)
  for (const e of events) {
    if (e.voided) continue
    state = applyEvent(state, e.event)
  }
  return state
}

/** Differences two scorers' states that matter for validation. */
export function diffStates(a: GameState, b: GameState, lang: Lang = 'es'): string[] {
  const out: string[] = []
  const t = (es: string, en: string) => (lang === 'es' ? es : en)
  if (a.score.home !== b.score.home || a.score.opponent !== b.score.opponent)
    out.push(t(`Marcador: ${a.score.home}-${a.score.opponent} vs ${b.score.home}-${b.score.opponent}`, `Score: ${a.score.home}-${a.score.opponent} vs ${b.score.home}-${b.score.opponent}`))
  if (a.inning !== b.inning || a.half !== b.half) out.push(t(`Entrada: ${a.inning} ${a.half} vs ${b.inning} ${b.half}`, `Inning: ${a.inning} ${a.half} vs ${b.inning} ${b.half}`))
  if (a.outs !== b.outs) out.push(t(`Outs: ${a.outs} vs ${b.outs}`, `Outs: ${a.outs} vs ${b.outs}`))
  const ra = a.runners.map((r) => `${r.base}:${r.playerId}`).sort().join(',')
  const rb = b.runners.map((r) => `${r.base}:${r.playerId}`).sort().join(',')
  if (ra !== rb) out.push(t('Corredores en base difieren', 'Runners on base differ'))
  for (const id of new Set([...Object.keys(a.pitcherLines), ...Object.keys(b.pitcherLines)])) {
    const pa = a.pitcherLines[id], pb = b.pitcherLines[id]
    if (!pa || !pb) { out.push(t(`Lanzador ${id} solo en una tarjeta`, `Pitcher ${id} only on one card`)); continue }
    if (pa.pitches !== pb.pitches) out.push(t(`${pa.name}: lanzamientos ${pa.pitches} vs ${pb.pitches}`, `${pa.name}: pitches ${pa.pitches} vs ${pb.pitches}`))
    if (pa.strikeouts !== pb.strikeouts) out.push(t(`${pa.name}: ponches ${pa.strikeouts} vs ${pb.strikeouts}`, `${pa.name}: strikeouts ${pa.strikeouts} vs ${pb.strikeouts}`))
  }
  return out
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
export function applyEvent(prev: GameState, event: GameEvent): GameState {
  const state = structuredClone(prev)
  state.seq += 1
  if (state.status === 'final' && event.type !== 'substitution') {
    violation(state, 'game_over', { es: 'El juego ya terminó; evento ignorado.', en: 'Game is over; event ignored.' })
    return state
  }
  switch (event.type) {
    case 'pitch': return onPitch(state, event.call)
    case 'plate_result': return onPlateResult(state, event.result)
    case 'ball_in_play': return onBallInPlay(state, event)
    case 'runner': return onRunner(state, event)
    case 'substitution': return onSubstitution(state, event)
    case 'position_change': return onPositionChange(state, event)
    case 'end_game':
      endGame(state, event.reason, { es: `Juego terminado (${event.reason}).`, en: `Game ended (${event.reason}).` })
      return state
  }
}

// ---- pitches ----------------------------------------------------------------
function onPitch(state: GameState, call: PitchCall): GameState {
  const pitcher = fieldingPitcher(state)
  const batter = state.currentBatter
  if (!batter) return state
  if (pitcher) {
    pitcher.pitches += 1
    if (call === 'ball') pitcher.balls += 1
    else pitcher.strikes += 1
    if (batter.firstPitch && call !== 'ball') pitcher.firstPitchStrikes += 1
  }
  batter.firstPitch = false
  batter.pitchesSeen += 1
  state.batterLines[batter.playerId].pitchesSeen += 1
  checkPitchCount(state, pitcher)

  switch (call) {
    case 'ball':
      state.balls += 1
      log(state, { es: `Bola ${state.balls}.`, en: `Ball ${state.balls}.` })
      if (state.balls >= state.rules.ballsForWalk) return finishPlateAppearance(state, 'walk')
      return state
    case 'strike_looking':
    case 'strike_swinging':
      state.strikes += 1
      log(state, { es: `Strike ${state.strikes}${call === 'strike_looking' ? ' (cantado)' : ' (abanicando)'}.`, en: `Strike ${state.strikes}${call === 'strike_looking' ? ' (looking)' : ' (swinging)'}.` })
      if (state.strikes >= state.rules.strikesForOut) return finishPlateAppearance(state, call === 'strike_looking' ? 'strikeout_looking' : 'strikeout')
      return state
    case 'foul':
    case 'foul_tip': {
      const twoStrikes = state.strikes >= state.rules.strikesForOut - 1
      if (!twoStrikes) {
        state.strikes += 1
        log(state, { es: `Foul, strike ${state.strikes}.`, en: `Foul, strike ${state.strikes}.` })
      } else if (call === 'foul_tip' || state.rules.foulOnTwoStrikesIsStrike) {
        state.strikes += 1
        log(state, { es: call === 'foul_tip' ? 'Foul tip atrapado con dos strikes: ponche.' : 'Foul con dos strikes cuenta como strike (regla de liga).', en: call === 'foul_tip' ? 'Caught foul tip with two strikes: strikeout.' : 'Foul on two strikes counts as a strike (league rule).' })
        return finishPlateAppearance(state, 'strikeout')
      } else {
        log(state, { es: 'Foul con dos strikes: la cuenta no cambia.', en: 'Foul with two strikes: count unchanged.' })
      }
      return state
    }
    case 'hit_by_pitch':
      return finishPlateAppearance(state, 'hit_by_pitch')
    case 'in_play':
      log(state, { es: 'Pelota en juego. Registra el resultado.', en: 'Ball in play. Record the result.' })
      return state
  }
}

function checkPitchCount(state: GameState, pitcher: PitcherLine | null) {
  if (!pitcher) return
  const { pitchCountLimit, pitchCountWarning } = state.rules
  if (pitchCountLimit && pitcher.pitches === pitchCountLimit)
    violation(state, 'pitch_count_limit', { es: `${pitcher.name} llegó al límite de ${pitchCountLimit} lanzamientos: debe salir al terminar este bateador.`, en: `${pitcher.name} reached the ${pitchCountLimit}-pitch limit: must leave after this batter.` })
  else if (pitchCountWarning && pitcher.pitches === pitchCountWarning)
    violation(state, 'pitch_count_warning', { es: `${pitcher.name} lleva ${pitchCountWarning} lanzamientos.`, en: `${pitcher.name} is at ${pitchCountWarning} pitches.` })
}

// ---- plate results without a ball in play ----------------------------------
function onPlateResult(state: GameState, result: 'walk' | 'intentional_walk' | 'strikeout' | 'strikeout_looking' | 'hit_by_pitch' | 'catcher_interference'): GameState {
  return finishPlateAppearance(state, result)
}

function finishPlateAppearance(state: GameState, result: 'walk' | 'intentional_walk' | 'strikeout' | 'strikeout_looking' | 'hit_by_pitch' | 'catcher_interference'): GameState {
  const batter = state.currentBatter
  if (!batter) return state
  const line = state.batterLines[batter.playerId]
  const pitcher = fieldingPitcher(state)
  completePlateAppearance(state, line, pitcher)
  switch (result) {
    case 'walk':
    case 'intentional_walk':
    case 'hit_by_pitch':
    case 'catcher_interference': {
      if (result === 'hit_by_pitch') { line.hitByPitch += 1; if (pitcher) pitcher.hitBatters += 1 }
      else if (result === 'catcher_interference') { /* reaches first, no AB */ }
      else { line.walks += 1; if (pitcher) { pitcher.walks += 1; if (result === 'intentional_walk') pitcher.intentionalWalks += 1 } }
      forceAdvance(state, batter.playerId, batter.side)
      log(state, {
        es: `${batterName(state)} ${result === 'hit_by_pitch' ? 'golpeado por lanzamiento' : result === 'catcher_interference' ? 'interferencia del receptor' : 'base por bolas'}: a primera.`,
        en: `${batterName(state)} ${result === 'hit_by_pitch' ? 'hit by pitch' : result === 'catcher_interference' ? 'catcher interference' : 'walks'}: to first.`,
      })
      break
    }
    case 'strikeout':
    case 'strikeout_looking':
      line.atBats += 1
      line.strikeouts += 1
      if (pitcher) pitcher.strikeouts += 1
      log(state, { es: `${batterName(state)} ponchado${result === 'strikeout_looking' ? ' sin swing' : ''}.`, en: `${batterName(state)} strikes out${result === 'strikeout_looking' ? ' looking' : ''}.` })
      recordOut(state)
      break
  }
  return nextBatterOrHalf(state)
}

function completePlateAppearance(state: GameState, line: BatterLine, pitcher: PitcherLine | null) {
  line.plateAppearances += 1
  if (pitcher) {
    pitcher.battersFaced += 1
    state.pitcherBattersFaced[pitcher.playerId] = (state.pitcherBattersFaced[pitcher.playerId] || 0) + 1
  }
}

// ---- balls in play -----------------------------------------------------------
function onBallInPlay(state: GameState, e: Extract<GameEvent, { type: 'ball_in_play' }>): GameState {
  const requiredOuts = e.result === 'double_play' ? 2 : e.result === 'triple_play' ? 3 : 0
  if (requiredOuts && (state.outs + requiredOuts > 3 || state.runners.length < requiredOuts - 1)) {
    violation(state, 'invalid_event', { es: 'Faltan corredores u outs disponibles.', en: 'Not enough runners or outs remaining.' })
    return state
  }
  // With two outs these are ordinary outs, not sacrifices; no runner can score.
  if (state.outs === 2 && (e.result === 'sacrifice_fly' || e.result === 'sacrifice_bunt')) {
    e = { ...e, result: e.result === 'sacrifice_fly' ? 'fly_out' : 'ground_out' }
  }
  const batter = state.currentBatter
  if (!batter) return state
  const line = state.batterLines[batter.playerId]
  const pitcher = fieldingPitcher(state)
  completePlateAppearance(state, line, pitcher)
  const runsBefore = state.score[batter.side]
  const isHit = ['single', 'double', 'triple', 'home_run'].includes(e.result)
  const isSac = e.result === 'sacrifice_fly' || e.result === 'sacrifice_bunt'
  if (!isSac) line.atBats += 1
  if (isHit) { line.hits += 1; if (pitcher) pitcher.hits += 1 }
  if (e.result === 'double') line.doubles += 1
  if (e.result === 'triple') line.triples += 1
  if (e.result === 'home_run') { line.homeRuns += 1; if (pitcher) pitcher.homeRuns += 1 }
  if (e.result === 'sacrifice_fly') line.sacrificeFlies += 1
  if (e.result === 'sacrifice_bunt') line.sacrificeBunts += 1
  if (pitcher) {
    if (e.result === 'ground_out' || e.result === 'double_play') pitcher.groundOuts += 1
    if (e.result === 'fly_out' || e.result === 'pop_out' || e.result === 'line_out' || e.result === 'sacrifice_fly') pitcher.flyOuts += 1
  }

  const batterBase: Base | 'out' =
    e.result === 'single' || e.result === 'error' || e.result === 'fielders_choice' ? 1
    : e.result === 'double' ? 2
    : e.result === 'triple' ? 3
    : e.result === 'home_run' ? 4
    : 'out'

  if (e.runners && e.runners.length) {
    // Explicit movement supplied by the scorer
    applyRunnerMoves(state, e.runners, e.result === 'error')
  } else {
    defaultAdvance(state, e.result)
  }

  // batter
  const outsOnBatter = batterBase === 'out'
  if (outsOnBatter) {
    recordOut(state)
  } else {
    placeRunner(state, batter.playerId, batter.side, batterBase, e.result === 'error')
  }
  // extra outs on the play
  if (e.result === 'double_play' && !(e.runners && e.runners.length)) {
    const lead = state.runners.sort((a, b) => a.base - b.base)[0]
    if (lead) { removeRunner(state, lead.playerId); recordOut(state) }
  }
  if (e.result === 'triple_play' && !(e.runners && e.runners.length)) {
    for (const r of [...state.runners].sort((a, b) => b.base - a.base).slice(0, 2)) { removeRunner(state, r.playerId); recordOut(state) }
  }
  if (e.result === 'fielders_choice' && !(e.runners && e.runners.length)) {
    const lead = state.runners.filter((r) => r.playerId !== batter.playerId).sort((a, b) => a.base - b.base)[0]
    if (lead) { removeRunner(state, lead.playerId); recordOut(state) }
  }

  const runs = state.score[batter.side] - runsBefore
  const rbi = e.rbi ?? (e.result === 'error' ? 0 : runs)
  line.rbi += rbi
  log(state, {
    es: `${batterName(state)}: ${resultName(e.result, 'es')}${e.fielders?.length ? ` (${e.fielders.join('-')})` : ''}${runs ? `, ${runs} carrera${runs > 1 ? 's' : ''}` : ''}.`,
    en: `${batterName(state)}: ${resultName(e.result, 'en')}${e.fielders?.length ? ` (${e.fielders.join('-')})` : ''}${runs ? `, ${runs} run${runs > 1 ? 's' : ''}` : ''}.`,
  })
  return nextBatterOrHalf(state)
}

function defaultAdvance(state: GameState, result: BallInPlayResult) {
  const advanceAll = (n: number) => {
    for (const r of [...state.runners].sort((a, b) => b.base - a.base)) moveRunner(state, r.playerId, Math.min(4, r.base + n) as Base)
  }
  switch (result) {
    case 'single': advanceAll(1); break
    case 'double': advanceAll(2); break
    case 'triple': advanceAll(3); break
    case 'home_run': advanceAll(4); break
    case 'sacrifice_fly': {
      const third = state.runners.find((r) => r.base === 3)
      if (third && state.outs < 2) moveRunner(state, third.playerId, 4)
      break
    }
    case 'sacrifice_bunt': advanceAll(1); break
    case 'error': advanceAll(1); break
    default: break // outs: runners hold
  }
}

function applyRunnerMoves(state: GameState, moves: RunnerMove[], viaError: boolean) {
  for (const m of [...moves].sort((a, b) => (b.to === 'out' ? 5 : b.to) - (a.to === 'out' ? 5 : a.to))) {
    if (m.to === 'out') { removeRunner(state, m.playerId); recordOut(state) }
    else moveRunner(state, m.playerId, m.to, viaError)
  }
}

// ---- runner events (steals, wild pitches, ...) -------------------------------
function onRunner(state: GameState, e: Extract<GameEvent, { type: 'runner' }>): GameState {
  const runner = state.runners.find((r) => r.playerId === e.playerId)
  const pitcher = fieldingPitcher(state)
  const name = runner?.name || e.playerId
  switch (e.action) {
    case 'stolen_base':
      if (runner) {
        moveRunner(state, runner.playerId, (e.to ?? (runner.base + 1)) as Base)
        if (state.batterLines[runner.playerId]) state.batterLines[runner.playerId].stolenBases += 1
      }
      log(state, { es: `${name} se roba la base.`, en: `${name} steals.` })
      break
    case 'caught_stealing':
      if (runner) {
        removeRunner(state, runner.playerId)
        recordOut(state)
        if (state.batterLines[runner.playerId]) state.batterLines[runner.playerId].caughtStealing += 1
      }
      log(state, { es: `${name} out robando.`, en: `${name} caught stealing.` })
      return afterOutCheck(state)
    case 'wild_pitch':
    case 'passed_ball':
    case 'balk':
      if (pitcher && e.action === 'wild_pitch') pitcher.wildPitches += 1
      if (pitcher && e.action === 'balk') pitcher.balks += 1
      if (runner) moveRunner(state, runner.playerId, (e.to ?? (runner.base + 1)) as Base)
      log(state, { es: `${e.action === 'wild_pitch' ? 'Lanzamiento descontrolado' : e.action === 'passed_ball' ? 'Passed ball' : 'Balk'}: ${name} avanza.`, en: `${e.action.replace('_', ' ')}: ${name} advances.` })
      break
    case 'pickoff':
      if (pitcher) pitcher.pickoffs += 1
      if (runner) { removeRunner(state, runner.playerId); recordOut(state) }
      log(state, { es: `${name} out por pickoff.`, en: `${name} picked off.` })
      return afterOutCheck(state)
    case 'advance':
      if (runner && e.to) moveRunner(state, runner.playerId, e.to)
      log(state, { es: `${name} avanza.`, en: `${name} advances.` })
      break
    case 'out':
      if (runner) { removeRunner(state, runner.playerId); recordOut(state) }
      log(state, { es: `${name} out en las bases.`, en: `${name} out on the bases.` })
      return afterOutCheck(state)
  }
  return state
}

// ---- substitutions -----------------------------------------------------------
function onSubstitution(state: GameState, e: Extract<GameEvent, { type: 'substitution' }>): GameState {
  const side = e.side
  const lineup = state.lineups[side]
  const slot = lineup.find((s) => s.playerId === e.outPlayerId)
  const inId = e.inPlayer.playerId

  // Re-entry check
  if (state.removed[side].includes(inId)) {
    const starter = lineup.some((s) => s.history[0]?.playerId === inId)
    const sameSlot = slot?.history[0]?.playerId === inId
    if (!(state.rules.reentryAllowed && starter && sameSlot)) {
      violation(state, 'reentry_not_allowed', { es: `${e.inPlayer.name} ya salió del juego y no puede reingresar.`, en: `${e.inPlayer.name} already left the game and cannot re-enter.` })
      return state
    }
    log(state, { es: `${e.inPlayer.name} reingresa en su turno original (regla de reingreso).`, en: `${e.inPlayer.name} re-enters in the original slot (re-entry rule).` })
  }

  if (e.kind === 'courtesy_runner') {
    const runner = state.runners.find((r) => r.playerId === e.outPlayerId)
    const pos = slot?.position
    const allowed = (pos === 'C' && state.rules.courtesyRunnerForCatcher) || (pos === 'P' && state.rules.courtesyRunnerForPitcher)
    if (!allowed || (state.rules.courtesyRunnerOnlyWithTwoOuts && state.outs < 2)) {
      violation(state, 'courtesy_runner_not_allowed', { es: 'Corredor de cortesía no permitido en esta situación.', en: 'Courtesy runner not allowed in this situation.' })
      return state
    }
    if (runner) { runner.playerId = inId; runner.name = e.inPlayer.name }
    log(state, { es: `${e.inPlayer.name} corre por ${slot?.name} (cortesía, no cuenta como cambio).`, en: `${e.inPlayer.name} runs for ${slot?.name} (courtesy, not a substitution).` })
    return state
  }

  if (e.kind === 'pitching_change') {
    const current = state.currentPitcher[side]
    if (current && state.rules.minimumBattersPerPitcher > 1 && (state.pitcherBattersFaced[current] || 0) < state.rules.minimumBattersPerPitcher) {
      violation(state, 'minimum_batters', { es: `El lanzador debe enfrentar al menos ${state.rules.minimumBattersPerPitcher} bateadores.`, en: `The pitcher must face at least ${state.rules.minimumBattersPerPitcher} batters.` })
    }
    state.currentPitcher[side] = inId
    if (!state.pitcherLines[inId]) state.pitcherLines[inId] = newPitcherLine(e.inPlayer, side, state.inning, state.half)
    state.pitcherBattersFaced[inId] = 0
    // If the pitcher was in the batting order (no DH), the reliever takes that slot
    if (slot && slot.position === 'P') {
      replaceInSlot(state, side, slot, e.inPlayer, 'P')
    } else if (current) {
      state.removed[side].push(current)
    }
    log(state, { es: `Cambio de lanzador: entra ${e.inPlayer.name} por ${state.pitcherLines[current || '']?.name || 'lanzador'}.`, en: `Pitching change: ${e.inPlayer.name} replaces ${state.pitcherLines[current || '']?.name || 'pitcher'}.` })
    return state
  }

  if (!slot) {
    violation(state, 'invalid_event', { es: 'El jugador que sale no está en la alineación.', en: 'The outgoing player is not in the lineup.' })
    return state
  }

  const position = e.kind === 'defensive' ? (e.inPlayer.position || slot.position) : slot.position
  replaceInSlot(state, side, slot, e.inPlayer, position)

  if (e.kind === 'pinch_runner') {
    const runner = state.runners.find((r) => r.playerId === e.outPlayerId)
    if (runner) { runner.playerId = inId; runner.name = e.inPlayer.name }
  }
  if (e.kind === 'pinch_hitter' && state.currentBatter?.playerId === e.outPlayerId) {
    state.currentBatter.playerId = inId
  }
  // DH rules: a DH taking the field or the pitcher batting ends the DH
  if (state.hasDH[side] && state.rules.dhLostWhenPitcherBats) {
    const pitcherId = state.currentPitcher[side]
    if (slot.position === 'DH' && e.kind === 'defensive') {
      state.hasDH[side] = false
      violation(state, 'dh_lost', { es: 'El DH pasó a la defensa: el equipo pierde el DH y el lanzador batea en ese turno.', en: 'The DH took the field: the team loses the DH and the pitcher bats in that slot.' })
    } else if (pitcherId && inId === pitcherId && slot.position === 'DH') {
      state.hasDH[side] = false
      violation(state, 'dh_lost', { es: 'El lanzador batea por el DH: el equipo pierde el DH por el resto del juego.', en: 'The pitcher bats for the DH: the team loses the DH for the rest of the game.' })
    }
  }
  log(state, {
    es: `${kindName(e.kind, 'es')}: entra ${e.inPlayer.name} por ${slot.history[slot.history.length - 2]?.name || slot.name} (turno ${slot.order}).`,
    en: `${kindName(e.kind, 'en')}: ${e.inPlayer.name} replaces ${slot.history[slot.history.length - 2]?.name || slot.name} (slot ${slot.order}).`,
  })
  return state
}

function replaceInSlot(state: GameState, side: Side, slot: LineupSlot, inPlayer: LineupPlayer, position: string) {
  state.removed[side].push(slot.playerId)
  slot.history.push({ playerId: inPlayer.playerId, name: inPlayer.name, enteredAt: state.seq })
  slot.playerId = inPlayer.playerId
  slot.name = inPlayer.name
  slot.position = position
  state.bench[side] = state.bench[side].filter((p) => p.playerId !== inPlayer.playerId)
  if (!state.batterLines[inPlayer.playerId]) state.batterLines[inPlayer.playerId] = newBatterLine(inPlayer, side)
}

function onPositionChange(state: GameState, e: Extract<GameEvent, { type: 'position_change' }>): GameState {
  const slot = state.lineups[e.side].find((s) => s.playerId === e.playerId)
  if (slot) {
    const from = slot.position
    slot.position = e.position
    log(state, { es: `${slot.name} pasa de ${from} a ${e.position}.`, en: `${slot.name} moves from ${from} to ${e.position}.` })
    if (from === 'DH' && state.rules.dhLostWhenPitcherBats) {
      state.hasDH[e.side] = false
      violation(state, 'dh_lost', { es: 'El DH pasó a la defensa: se pierde el DH.', en: 'The DH took the field: DH is lost.' })
    }
  }
  return state
}

// ---- base running helpers ------------------------------------------------------
function placeRunner(state: GameState, playerId: string, side: Side, base: Base, viaError = false) {
  const name = state.lineups[side].find((s) => s.playerId === playerId)?.name || playerId
  if (base === 4) { scoreRun(state, { playerId, name, base: 3, responsiblePitcher: state.currentPitcher[otherSide(side)], reachedOnError: viaError }); return }
  state.runners = state.runners.filter((r) => r.playerId !== playerId)
  state.runners.push({ playerId, name, base, responsiblePitcher: state.currentPitcher[otherSide(side)], reachedOnError: viaError })
}

function moveRunner(state: GameState, playerId: string, to: Base, viaError = false) {
  const r = state.runners.find((x) => x.playerId === playerId)
  if (!r) return
  if (viaError) r.reachedOnError = true
  if (to === 4) { scoreRun(state, r); return }
  r.base = to
}

function removeRunner(state: GameState, playerId: string) {
  state.runners = state.runners.filter((r) => r.playerId !== playerId)
}

/** Walk / HBP: only forced runners move */
function forceAdvance(state: GameState, batterId: string, side: Side) {
  const occupied = (b: number) => state.runners.some((r) => r.base === b)
  if (occupied(1)) {
    if (occupied(2)) {
      if (occupied(3)) moveRunner(state, state.runners.find((r) => r.base === 3)!.playerId, 4)
      moveRunner(state, state.runners.find((r) => r.base === 2)!.playerId, 3)
    }
    moveRunner(state, state.runners.find((r) => r.base === 1)!.playerId, 2)
  }
  placeRunner(state, batterId, side, 1)
}

function scoreRun(state: GameState, runner: Runner) {
  removeRunner(state, runner.playerId)
  state.score[state.battingSide] += 1
  const arr = state.inningRuns[state.battingSide]
  arr[state.inning - 1] = (arr[state.inning - 1] || 0) + 1
  if (state.batterLines[runner.playerId]) state.batterLines[runner.playerId].runs += 1
  const p = runner.responsiblePitcher ? state.pitcherLines[runner.responsiblePitcher] : null
  if (p) {
    p.runs += 1
    if (!(runner.reachedOnError && state.rules.errorRunsAreUnearned)) p.earnedRuns += 1
  }
  log(state, { es: `Anota ${runner.name}. Marcador ${state.score.home}-${state.score.opponent}.`, en: `${runner.name} scores. Score ${state.score.home}-${state.score.opponent}.` })
  checkWalkOff(state)
}

function recordOut(state: GameState) {
  state.outs += 1
  const p = fieldingPitcher(state)
  if (p) p.outs += 1
}

// ---- flow: batters, half innings, game end -------------------------------------
function startPlateAppearance(state: GameState) {
  if (state.status === 'final') { state.currentBatter = null; return }
  const side = state.battingSide
  const lineup = state.lineups[side]
  const idx = state.nextBatterIndex[side] % lineup.length
  const slot = lineup[idx]
  state.currentBatter = { side, slot: slot.order, playerId: slot.playerId, pitchesSeen: 0, firstPitch: true }
  state.balls = 0
  state.strikes = 0
  log(state, { es: `Al bat: ${slot.name} (turno ${slot.order}).`, en: `At bat: ${slot.name} (slot ${slot.order}).` })
}

/** The plate appearance is over: advance the order (it carries over between innings, so a team batting around can send the same player up twice). */
function nextBatterOrHalf(state: GameState): GameState {
  const side = state.battingSide
  state.nextBatterIndex[side] = (state.nextBatterIndex[side] + 1) % state.lineups[side].length
  state.currentBatter = null
  return afterOutCheck(state)
}

/**
 * After any out or completed plate appearance. A runner thrown out for the third
 * out ends the inning while the batter is still up; the batter keeps their turn
 * and leads off the next inning with a fresh count, which is why the order index
 * is not advanced here.
 */
function afterOutCheck(state: GameState): GameState {
  if (state.status === 'final') { state.currentBatter = null; return state }
  if (state.outs >= 3) endHalfInning(state)
  else if (!state.currentBatter) startPlateAppearance(state)
  return state
}

function endHalfInning(state: GameState) {
  const finished = state.battingSide
  state.inningRuns[finished][state.inning - 1] = state.inningRuns[finished][state.inning - 1] || 0
  log(state, { es: `Fin de la ${state.half === 'top' ? 'alta' : 'baja'} de la entrada ${state.inning}.`, en: `End of the ${state.half} of inning ${state.inning}.` })
  state.runners = []
  state.outs = 0
  state.balls = 0
  state.strikes = 0
  if (checkGameEnd(state)) { state.currentBatter = null; return }
  if (state.half === 'top') {
    state.half = 'bottom'
  } else {
    state.half = 'top'
    state.inning += 1
  }
  state.battingSide = otherSide(state.battingSide)
  // Extra-inning tiebreak runner
  if (state.rules.extraInningRunnerOnSecond && state.inning > state.rules.regulationInnings) {
    const side = state.battingSide
    const lineup = state.lineups[side]
    const prevIdx = (state.nextBatterIndex[side] + lineup.length - 1) % lineup.length
    const prev = lineup[prevIdx]
    placeRunner(state, prev.playerId, side, 2)
    log(state, { es: `Extra inning: ${prev.name} empieza en segunda base.`, en: `Extra inning: ${prev.name} starts on second base.` })
  }
  startPlateAppearance(state)
}

function homeSide(state: GameState): Side {
  return otherSide(state.battingFirst) // the team batting second is the home team
}

function checkWalkOff(state: GameState) {
  if (!state.rules.walkOffEndsGame) return
  const home = homeSide(state)
  if (state.half === 'bottom' && state.battingSide === home && state.inning >= state.rules.regulationInnings && state.score[home] > state.score[otherSide(home)]) {
    endGame(state, 'walk_off', { es: `Carrera de la victoria: gana ${sideName(state, home, 'es')} ${state.score.home}-${state.score.opponent}.`, en: `Walk-off: ${sideName(state, home, 'en')} win ${state.score.home}-${state.score.opponent}.` })
  }
}

/** Called after a half inning; returns true when the game is over. */
function checkGameEnd(state: GameState): boolean {
  const home = homeSide(state)
  const away = otherSide(home)
  const hs = state.score[home], as = state.score[away]
  const reg = state.rules.regulationInnings
  // Mercy rule after a complete inning (or after the top if the home team leads)
  if (state.rules.mercyRuleEnabled && state.inning >= state.rules.mercyAfterInning) {
    const diff = Math.abs(hs - as)
    const completeInning = state.half === 'bottom'
    const homeLeadsAfterTop = state.half === 'top' && hs > as
    if (diff >= state.rules.mercyRunDifference && (completeInning || homeLeadsAfterTop)) {
      endGame(state, 'mercy', { es: `Regla de misericordia: ${diff} carreras de diferencia. Final ${state.score.home}-${state.score.opponent}.`, en: `Mercy rule: ${diff}-run difference. Final ${state.score.home}-${state.score.opponent}.` })
      return true
    }
  }
  if (state.inning >= reg) {
    // Home team leads after the top of the last (or extra) inning: no need to bat
    if (state.half === 'top' && hs > as) {
      endGame(state, 'regulation', { es: `${sideName(state, home, 'es')} gana sin batear en la baja. Final ${state.score.home}-${state.score.opponent}.`, en: `${sideName(state, home, 'en')} win without batting in the bottom. Final ${state.score.home}-${state.score.opponent}.` })
      return true
    }
    if (state.half === 'bottom') {
      if (hs !== as) {
        endGame(state, 'regulation', { es: `Juego terminado. Final ${state.score.home}-${state.score.opponent}.`, en: `Game over. Final ${state.score.home}-${state.score.opponent}.` })
        return true
      }
      // tied after a complete inning
      if (!state.rules.extraInningsAllowed) {
        endGame(state, 'tie', { es: `Empate ${hs}-${as}: no hay extra innings.`, en: `Tie ${hs}-${as}: no extra innings.` })
        return true
      }
      if (state.rules.maxExtraInnings && state.inning - reg >= state.rules.maxExtraInnings) {
        endGame(state, 'tie', { es: `Empate ${hs}-${as} tras el máximo de extra innings.`, en: `Tie ${hs}-${as} after the maximum extra innings.` })
        return true
      }
      log(state, { es: `Empate ${hs}-${as}: vamos a extra innings.`, en: `Tied ${hs}-${as}: extra innings.` })
    }
  }
  return false
}

function endGame(state: GameState, reason: string, text: Record<Lang, string>) {
  state.status = 'final'
  state.finalReason = reason
  state.currentBatter = null
  log(state, text)
}

// ---- utilities -------------------------------------------------------------------
function fieldingPitcher(state: GameState): PitcherLine | null {
  const id = state.currentPitcher[otherSide(state.battingSide)]
  return id ? state.pitcherLines[id] : null
}

function batterName(state: GameState): string {
  const b = state.currentBatter
  if (!b) return ''
  return state.lineups[b.side].find((s) => s.playerId === b.playerId)?.name || b.playerId
}

function sideName(state: GameState, side: Side, lang: Lang): string {
  void state
  return side === 'home' ? (lang === 'es' ? 'nuestro equipo' : 'our team') : (lang === 'es' ? 'el oponente' : 'the opponent')
}

function log(state: GameState, text: Record<Lang, string>) {
  state.decisions.push({ seq: state.seq, inning: state.inning, half: state.half, text })
}

function violation(state: GameState, code: Violation['code'], message: Record<Lang, string>) {
  state.violations.push({ code, message, seq: state.seq })
  state.decisions.push({ seq: state.seq, inning: state.inning, half: state.half, text: { es: `⚠ ${message.es}`, en: `⚠ ${message.en}` } })
}

export function resultName(r: BallInPlayResult, lang: Lang): string {
  const m: Record<BallInPlayResult, [string, string]> = {
    single: ['sencillo', 'single'], double: ['doble', 'double'], triple: ['triple', 'triple'], home_run: ['jonrón', 'home run'],
    ground_out: ['rodado, out', 'ground out'], fly_out: ['elevado, out', 'fly out'], line_out: ['línea, out', 'line out'], pop_out: ['elevado corto, out', 'pop out'],
    error: ['llega por error', 'reaches on error'], fielders_choice: ['selección del fildeador', "fielder's choice"],
    sacrifice_fly: ['elevado de sacrificio', 'sacrifice fly'], sacrifice_bunt: ['toque de sacrificio', 'sacrifice bunt'],
    double_play: ['doble play', 'double play'], triple_play: ['triple play', 'triple play'],
  }
  return lang === 'es' ? m[r][0] : m[r][1]
}

function kindName(k: Extract<GameEvent, { type: 'substitution' }>['kind'], lang: Lang): string {
  const m = {
    pinch_hitter: ['Bateador emergente', 'Pinch hitter'], pinch_runner: ['Corredor emergente', 'Pinch runner'],
    courtesy_runner: ['Corredor de cortesía', 'Courtesy runner'], pitching_change: ['Cambio de lanzador', 'Pitching change'],
    defensive: ['Cambio defensivo', 'Defensive substitution'],
  } as const
  return lang === 'es' ? m[k][0] : m[k][1]
}

/** Innings pitched as the conventional "6.2" string. */
export function inningsPitched(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

/** ERA over the game's regulation innings (usually 9). */
export function era(line: PitcherLine, regulationInnings = 9): number | null {
  if (line.outs === 0) return null
  return (line.earnedRuns * regulationInnings) / (line.outs / 3)
}
