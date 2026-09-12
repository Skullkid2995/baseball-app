/**
 * Scripted situations that exercise the rules engine. The Rules page runs them
 * and prints every decision so the logic can be read and challenged; the test
 * suite asserts their outcomes.
 */
import type { Lang, RuleSet } from './config'
import { createGame, type GameEvent, type GameState, type LineupInput, type Side } from './engine'
import { applyEvent } from './engine'

export interface Scenario {
  key: string
  title: Record<Lang, string>
  description: Record<Lang, string>
  rules?: Partial<RuleSet>
  battingFirst?: Side
  events: GameEvent[]
}

const P = (id: string, name: string, position: string) => ({ playerId: id, name, position })

export function demoLineup(side: Side, withDH = false): LineupInput {
  const prefix = side === 'home' ? 'D' : 'R'
  const names = side === 'home'
    ? ['Cabral', 'E. Valdez', 'Angulo', 'Zuñiga', 'Contreras', 'H. Valdez', 'M. Valdez', 'F. Zuñiga', 'Y. Garcia']
    : ['Rival 1', 'Rival 2', 'Rival 3', 'Rival 4', 'Rival 5', 'Rival 6', 'Rival 7', 'Rival 8', 'Rival 9']
  const positions = withDH
    ? ['LF', 'SS', 'C', 'CF', '3B', 'RF', '1B', 'DH', '2B']
    : ['LF', 'SS', 'C', 'CF', '3B', 'RF', '1B', 'P', '2B']
  return {
    side,
    batters: names.map((n, i) => P(`${prefix}${i + 1}`, n, positions[i])),
    pitcher: withDH ? P(`${prefix}P`, side === 'home' ? 'Juarez (P)' : 'Rival P', 'P') : undefined,
    bench: [P(`${prefix}B1`, side === 'home' ? 'Felix' : 'Rival B1', 'OF'), P(`${prefix}B2`, side === 'home' ? 'Lopez' : 'Rival B2', 'IF'), P(`${prefix}B3`, side === 'home' ? 'Yeghoian' : 'Rival B3', 'P')],
  }
}

const K: GameEvent[] = [{ type: 'pitch', call: 'strike_swinging' }, { type: 'pitch', call: 'strike_swinging' }, { type: 'pitch', call: 'strike_swinging' }]
const single: GameEvent = { type: 'ball_in_play', result: 'single', trajectory: 'ground' }
const groundOut: GameEvent = { type: 'ball_in_play', result: 'ground_out', fielders: [6, 3], trajectory: 'ground' }
const flyOut: GameEvent = { type: 'ball_in_play', result: 'fly_out', fielders: [8], trajectory: 'fly' }
const homer: GameEvent = { type: 'ball_in_play', result: 'home_run', trajectory: 'fly' }
const threeOuts: GameEvent[] = [groundOut, flyOut, groundOut]

/** A quiet half inning: three outs */
const quietHalf = (): GameEvent[] => [...threeOuts]

export const SCENARIOS: Scenario[] = [
  {
    key: 'count',
    title: { es: 'Cuenta: bolas, strikes y fouls', en: 'Count: balls, strikes and fouls' },
    description: { es: 'Cuatro bolas dan base por bolas; tres strikes son ponche; el foul con dos strikes no cuenta.', en: 'Four balls walk the batter; three strikes strike him out; a foul with two strikes does not count.' },
    events: [
      { type: 'pitch', call: 'ball' }, { type: 'pitch', call: 'strike_looking' }, { type: 'pitch', call: 'foul' }, { type: 'pitch', call: 'foul' }, { type: 'pitch', call: 'foul' },
      { type: 'pitch', call: 'ball' }, { type: 'pitch', call: 'ball' }, { type: 'pitch', call: 'ball' },
      { type: 'pitch', call: 'strike_swinging' }, { type: 'pitch', call: 'foul' }, { type: 'pitch', call: 'strike_looking' },
    ],
  },
  {
    key: 'batting_around',
    title: { es: 'Bateo en vuelta: un jugador batea dos veces en la entrada', en: 'Batting around: a player bats twice in one inning' },
    description: { es: 'Diez bateadores sin que caigan tres outs. El orden continúa y el primer bateador vuelve a batear; después el orden sigue en la siguiente entrada donde se quedó.', en: 'Ten batters before three outs. The order continues, the leadoff bats again, and the next inning picks up where the order left off.' },
    events: [single, single, single, homer, single, single, single, homer, single, single, groundOut, flyOut, groundOut],
  },
  {
    key: 'walk_off',
    title: { es: 'Carrera de la victoria en la última entrada', en: 'Walk-off in the last inning' },
    description: { es: 'Juego a 1 entrada para abreviar: el visitante anota 1; en la baja el local empata y gana con un sencillo. El juego termina en cuanto anota la carrera de la ventaja.', en: 'One-inning game for brevity: the visitors score 1; in the bottom the home team ties and wins on a single. The game ends the moment the go-ahead run scores.' },
    rules: { regulationInnings: 1 },
    events: [homer, ...threeOuts, single, single, single, single, single, single], // the last single comes after the game ended and must be ignored
  },
  {
    key: 'extra_innings',
    title: { es: 'Extra innings con corredor en segunda', en: 'Extra innings with runner on second' },
    description: { es: 'Empate al final de la entrada reglamentaria; la siguiente entrada empieza con corredor en segunda. Un sencillo lo trae a anotar.', en: 'Tied after regulation; the next inning starts with a runner on second. A single brings him home.' },
    rules: { regulationInnings: 1, extraInningRunnerOnSecond: true },
    events: [homer, ...threeOuts, homer, ...threeOuts, ...quietHalf(), single, single, single, single],
  },
  {
    key: 'mercy',
    title: { es: 'Regla de misericordia', en: 'Mercy rule' },
    description: { es: 'Con 10 carreras de ventaja después de la entrada 1 (configurado para la demo), el juego termina.', en: 'With a 10-run lead after inning 1 (configured for the demo), the game ends.' },
    rules: { mercyAfterInning: 1, regulationInnings: 9 },
    events: [homer, homer, homer, homer, homer, homer, homer, homer, homer, homer, ...threeOuts, ...threeOuts],
  },
  {
    key: 'dh',
    title: { es: 'Bateador designado y pérdida del DH', en: 'Designated hitter and losing the DH' },
    description: { es: 'Alineación con DH. Cuando el DH pasa a la defensa, el equipo pierde el DH y el lanzador entra al orden.', en: 'Lineup with a DH. When the DH takes the field the team loses the DH and the pitcher joins the order.' },
    events: [single, { type: 'position_change', side: 'home', playerId: 'D8', position: '1B' }, groundOut],
  },
  {
    key: 'pinch',
    title: { es: 'Bateador emergente, corredor emergente y reingreso', en: 'Pinch hitter, pinch runner and re-entry' },
    description: { es: 'Entra un emergente por el primer bateador, luego un corredor emergente. El titular intenta reingresar: se rechaza porque el reingreso está apagado.', en: 'A pinch hitter replaces the leadoff, then a pinch runner. The starter tries to re-enter and is rejected because re-entry is off.' },
    events: [
      { type: 'substitution', kind: 'pinch_hitter', side: 'home', outPlayerId: 'D1', inPlayer: P('DB1', 'Felix', 'LF') },
      single,
      { type: 'substitution', kind: 'pinch_runner', side: 'home', outPlayerId: 'DB1', inPlayer: P('DB2', 'Lopez', 'LF') },
      { type: 'substitution', kind: 'pinch_hitter', side: 'home', outPlayerId: 'D2', inPlayer: P('D1', 'Cabral', 'LF') },
      groundOut,
    ],
  },
  {
    key: 'pitching',
    title: { es: 'Estadística de pitcheo y cambio de lanzador', en: 'Pitching line and pitching change' },
    description: { es: 'Ponche, base por bolas, jonrón y un relevo. Se acumulan lanzamientos, bateadores enfrentados, outs, carreras y carreras limpias por lanzador.', en: 'Strikeout, walk, home run and a reliever. Pitches, batters faced, outs, runs and earned runs accumulate per pitcher.' },
    events: [
      ...K,
      { type: 'pitch', call: 'ball' }, { type: 'pitch', call: 'ball' }, { type: 'pitch', call: 'ball' }, { type: 'pitch', call: 'ball' },
      { type: 'pitch', call: 'strike_looking' }, { type: 'pitch', call: 'in_play' }, { type: 'ball_in_play', result: 'error', fielders: [6], trajectory: 'ground' },
      { type: 'pitch', call: 'in_play' }, homer,
      { type: 'substitution', kind: 'pitching_change', side: 'opponent', outPlayerId: 'R8', inPlayer: P('RB3', 'Rival B3', 'P') },
      ...K, groundOut,
    ],
  },
  {
    key: 'runner_out_ends_inning',
    title: { es: 'Tercer out en las bases: el bateador conserva su turno', en: 'Third out on the bases: the batter keeps his turn' },
    description: { es: 'Con dos outs y corredor en primera, el corredor es puesto out robando durante el turno. La entrada termina y el mismo bateador abre la siguiente con cuenta nueva.', en: 'Two outs, runner on first, the runner is caught stealing during the at-bat. The inning ends and the same batter leads off the next one with a fresh count.' },
    events: [single, groundOut, flyOut, { type: 'pitch', call: 'ball' }, { type: 'pitch', call: 'strike_looking' }, { type: 'runner', action: 'caught_stealing', playerId: 'D1' }, ...threeOuts],
  },
]

export function runScenario(s: Scenario): GameState {
  const withDH = s.key === 'dh'
  let state = createGame({
    rules: s.rules,
    battingFirst: s.battingFirst || 'home',
    lineups: { home: demoLineup('home', withDH), opponent: demoLineup('opponent') },
  })
  for (const e of s.events) state = applyEvent(state, e)
  return state
}
