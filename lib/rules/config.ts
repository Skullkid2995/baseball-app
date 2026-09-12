/**
 * Editable rule set for a game or a league. Every rule has a key, a value and
 * bilingual copy so the Rules page can list and edit them. The engine in
 * ./engine.ts reads these values; nothing about baseball is hard-coded there
 * that is not declared here.
 */

export type Lang = 'es' | 'en'

export type RuleValue = boolean | number | string

export interface RuleDefinition {
  key: keyof RuleSet
  group: 'game' | 'lineup' | 'substitutions' | 'pitching' | 'scoring'
  type: 'boolean' | 'number' | 'select'
  options?: { value: string; es: string; en: string }[]
  min?: number
  max?: number
  label: Record<Lang, string>
  description: Record<Lang, string>
}

export interface RuleSet {
  // Game length
  regulationInnings: number
  extraInningsAllowed: boolean
  maxExtraInnings: number // 0 = unlimited
  extraInningRunnerOnSecond: boolean
  walkOffEndsGame: boolean
  mercyRuleEnabled: boolean
  mercyRunDifference: number
  mercyAfterInning: number
  // Lineup
  designatedHitterAllowed: boolean
  lineupSize: number // 9, or 10 with DH
  enforceBattingOrder: boolean
  // Substitutions
  reentryAllowed: boolean
  courtesyRunnerForCatcher: boolean
  courtesyRunnerForPitcher: boolean
  courtesyRunnerOnlyWithTwoOuts: boolean
  dhLostWhenPitcherBats: boolean
  // Pitching
  pitchCountLimit: number // 0 = none
  pitchCountWarning: number // 0 = none
  minimumBattersPerPitcher: number
  // Scoring
  ballsForWalk: number
  strikesForOut: number
  foulOnTwoStrikesIsStrike: boolean
  errorRunsAreUnearned: boolean
}

export const DEFAULT_RULES: RuleSet = {
  regulationInnings: 9,
  extraInningsAllowed: true,
  maxExtraInnings: 0,
  extraInningRunnerOnSecond: false,
  walkOffEndsGame: true,
  mercyRuleEnabled: true,
  mercyRunDifference: 10,
  mercyAfterInning: 7,
  designatedHitterAllowed: true,
  lineupSize: 9,
  enforceBattingOrder: true,
  reentryAllowed: false,
  courtesyRunnerForCatcher: true,
  courtesyRunnerForPitcher: true,
  courtesyRunnerOnlyWithTwoOuts: false,
  dhLostWhenPitcherBats: true,
  pitchCountLimit: 0,
  pitchCountWarning: 0,
  minimumBattersPerPitcher: 1,
  ballsForWalk: 4,
  strikesForOut: 3,
  foulOnTwoStrikesIsStrike: false,
  errorRunsAreUnearned: true,
}

export const RULE_DEFINITIONS: RuleDefinition[] = [
  // ---- Game ----
  {
    key: 'regulationInnings', group: 'game', type: 'number', min: 1, max: 12,
    label: { es: 'Entradas reglamentarias', en: 'Regulation innings' },
    description: { es: 'Número de entradas de un juego completo. Si hay empate al terminar, se aplican las reglas de extra innings.', en: 'Innings in a complete game. A tie after this many innings goes to the extra-innings rules.' },
  },
  {
    key: 'extraInningsAllowed', group: 'game', type: 'boolean',
    label: { es: 'Extra innings permitidos', en: 'Extra innings allowed' },
    description: { es: 'Si está apagado, un empate al final de las entradas reglamentarias termina el juego empatado.', en: 'If off, a tie after regulation ends the game as a tie.' },
  },
  {
    key: 'maxExtraInnings', group: 'game', type: 'number', min: 0, max: 10,
    label: { es: 'Máximo de extra innings', en: 'Maximum extra innings' },
    description: { es: '0 = sin límite. Al llegar al máximo con empate, el juego termina empatado.', en: '0 = unlimited. Reaching the maximum while tied ends the game as a tie.' },
  },
  {
    key: 'extraInningRunnerOnSecond', group: 'game', type: 'boolean',
    label: { es: 'Corredor en segunda en extra innings', en: 'Runner on second in extra innings' },
    description: { es: 'Cada mitad de extra inning empieza con el último bateador de la entrada anterior en segunda base.', en: 'Each extra half-inning starts with the previous batter on second base.' },
  },
  {
    key: 'walkOffEndsGame', group: 'game', type: 'boolean',
    label: { es: 'Carrera de la victoria termina el juego', en: 'Walk-off ends the game' },
    description: { es: 'En la parte baja de la última entrada (o extra), el juego termina en cuanto el equipo local toma la ventaja.', en: 'In the bottom of the last inning (or extras), the game ends as soon as the home team takes the lead.' },
  },
  {
    key: 'mercyRuleEnabled', group: 'game', type: 'boolean',
    label: { es: 'Regla de misericordia', en: 'Mercy rule' },
    description: { es: 'El juego termina cuando la diferencia de carreras alcanza el límite después de la entrada indicada.', en: 'The game ends when the run difference reaches the limit after the given inning.' },
  },
  {
    key: 'mercyRunDifference', group: 'game', type: 'number', min: 1, max: 30,
    label: { es: 'Diferencia de carreras (misericordia)', en: 'Run difference (mercy)' },
    description: { es: 'Carreras de ventaja necesarias para aplicar la regla.', en: 'Lead required to apply the rule.' },
  },
  {
    key: 'mercyAfterInning', group: 'game', type: 'number', min: 1, max: 12,
    label: { es: 'A partir de la entrada (misericordia)', en: 'From inning (mercy)' },
    description: { es: 'La regla se revisa al terminar cada entrada completa desde esta entrada.', en: 'Checked at the end of every complete inning from this one on.' },
  },
  // ---- Lineup ----
  {
    key: 'designatedHitterAllowed', group: 'lineup', type: 'boolean',
    label: { es: 'Bateador designado (DH)', en: 'Designated hitter (DH)' },
    description: { es: 'Permite que un DH batee por el lanzador; la alineación tiene 10 jugadores.', en: 'A DH may bat for the pitcher; the lineup has 10 players.' },
  },
  {
    key: 'lineupSize', group: 'lineup', type: 'select',
    options: [{ value: '9', es: '9 bateadores', en: '9 batters' }, { value: '10', es: '10 bateadores (con DH)', en: '10 batters (with DH)' }],
    label: { es: 'Tamaño de la alineación', en: 'Lineup size' },
    description: { es: 'Bateadores en el orden al bat. Con DH son 10 jugadores en la tarjeta pero 9 en el orden.', en: 'Batters in the order. With a DH there are 10 players on the card but 9 in the order.' },
  },
  {
    key: 'enforceBattingOrder', group: 'lineup', type: 'boolean',
    label: { es: 'Validar orden al bat', en: 'Enforce batting order' },
    description: { es: 'El motor avisa cuando batea alguien fuera de turno. El orden continúa entre entradas: si un equipo batea en vuelta, el mismo jugador puede batear dos veces en la misma entrada.', en: 'The engine flags a batter out of turn. The order carries over between innings: when a team bats around, the same player can bat twice in an inning.' },
  },
  // ---- Substitutions ----
  {
    key: 'reentryAllowed', group: 'substitutions', type: 'boolean',
    label: { es: 'Reingreso de titulares', en: 'Starter re-entry' },
    description: { es: 'Un titular sustituido puede volver al juego una vez, en su mismo turno al bat (común en ligas amateur).', en: 'A substituted starter may re-enter once, in the same batting slot (common in amateur leagues).' },
  },
  {
    key: 'courtesyRunnerForCatcher', group: 'substitutions', type: 'boolean',
    label: { es: 'Corredor de cortesía por el receptor', en: 'Courtesy runner for the catcher' },
    description: { es: 'Otro jugador corre por el receptor sin que cuente como sustitución.', en: 'Another player runs for the catcher without it counting as a substitution.' },
  },
  {
    key: 'courtesyRunnerForPitcher', group: 'substitutions', type: 'boolean',
    label: { es: 'Corredor de cortesía por el lanzador', en: 'Courtesy runner for the pitcher' },
    description: { es: 'Otro jugador corre por el lanzador sin que cuente como sustitución.', en: 'Another player runs for the pitcher without it counting as a substitution.' },
  },
  {
    key: 'courtesyRunnerOnlyWithTwoOuts', group: 'substitutions', type: 'boolean',
    label: { es: 'Corredor de cortesía solo con dos outs', en: 'Courtesy runner only with two outs' },
    description: { es: 'Limita el corredor de cortesía a situaciones con dos outs.', en: 'Limits the courtesy runner to two-out situations.' },
  },
  {
    key: 'dhLostWhenPitcherBats', group: 'substitutions', type: 'boolean',
    label: { es: 'Se pierde el DH si batea el lanzador', en: 'DH is lost when the pitcher bats' },
    description: { es: 'Si el lanzador entra al orden al bat (o el DH pasa a la defensa), el equipo pierde el DH por el resto del juego.', en: 'If the pitcher enters the batting order (or the DH takes the field), the team loses the DH for the rest of the game.' },
  },
  // ---- Pitching ----
  {
    key: 'pitchCountLimit', group: 'pitching', type: 'number', min: 0, max: 200,
    label: { es: 'Límite de lanzamientos', en: 'Pitch count limit' },
    description: { es: '0 = sin límite. Al llegar, el motor marca que el lanzador debe ser reemplazado al terminar el bateador.', en: '0 = none. When reached, the engine flags that the pitcher must be replaced after the current batter.' },
  },
  {
    key: 'pitchCountWarning', group: 'pitching', type: 'number', min: 0, max: 200,
    label: { es: 'Aviso de lanzamientos', en: 'Pitch count warning' },
    description: { es: '0 = sin aviso. Muestra una alerta al llegar a este número.', en: '0 = none. Shows a warning at this count.' },
  },
  {
    key: 'minimumBattersPerPitcher', group: 'pitching', type: 'number', min: 1, max: 9,
    label: { es: 'Mínimo de bateadores por lanzador', en: 'Minimum batters per pitcher' },
    description: { es: 'Un relevista debe enfrentar al menos este número de bateadores antes de ser cambiado (salvo lesión).', en: 'A reliever must face at least this many batters before being replaced (injury aside).' },
  },
  // ---- Scoring ----
  {
    key: 'ballsForWalk', group: 'scoring', type: 'number', min: 1, max: 6,
    label: { es: 'Bolas para base por bolas', en: 'Balls for a walk' },
    description: { es: 'Normalmente 4.', en: 'Normally 4.' },
  },
  {
    key: 'strikesForOut', group: 'scoring', type: 'number', min: 1, max: 4,
    label: { es: 'Strikes para ponche', en: 'Strikes for a strikeout' },
    description: { es: 'Normalmente 3.', en: 'Normally 3.' },
  },
  {
    key: 'foulOnTwoStrikesIsStrike', group: 'scoring', type: 'boolean',
    label: { es: 'Foul con dos strikes es ponche', en: 'Foul on two strikes is a strikeout' },
    description: { es: 'Apagado en béisbol: el foul con dos strikes no cuenta (excepto foul tip atrapado y toque de bola).', en: 'Off in baseball: a foul with two strikes does not count (except a caught foul tip or a bunt).' },
  },
  {
    key: 'errorRunsAreUnearned', group: 'scoring', type: 'boolean',
    label: { es: 'Carreras por error son limpias', en: 'Runs enabled by errors are unearned' },
    description: { es: 'Un corredor que llegó por error no cuenta como carrera limpia contra el lanzador.', en: 'A runner who reached on an error does not count as an earned run against the pitcher.' },
  },
]

export const RULE_GROUPS: { key: RuleDefinition['group']; es: string; en: string }[] = [
  { key: 'game', es: 'Duración del juego', en: 'Game length' },
  { key: 'lineup', es: 'Alineación', en: 'Lineup' },
  { key: 'substitutions', es: 'Sustituciones', en: 'Substitutions' },
  { key: 'pitching', es: 'Pitcheo', en: 'Pitching' },
  { key: 'scoring', es: 'Anotación', en: 'Scoring' },
]

export function mergeRules(partial: Partial<RuleSet> | null | undefined): RuleSet {
  return { ...DEFAULT_RULES, ...(partial || {}) }
}
