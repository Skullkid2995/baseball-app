/**
 * The closed vocabulary of a baseball scorecard. Recognition only ever answers
 * with one of these tokens, which is what makes ugly handwriting safe: the
 * nearest valid token wins and the scorer confirms it.
 */
export interface Token {
  value: string
  /** Spanish description shown in the confirmation box */
  es: string
  en: string
  group: 'fielder' | 'play' | 'reach' | 'out' | 'runner'
}

export const FIELDERS: Record<string, { es: string; en: string }> = {
  '1': { es: 'Lanzador', en: 'Pitcher' },
  '2': { es: 'Receptor', en: 'Catcher' },
  '3': { es: 'Primera base', en: 'First base' },
  '4': { es: 'Segunda base', en: 'Second base' },
  '5': { es: 'Tercera base', en: 'Third base' },
  '6': { es: 'Campo corto', en: 'Shortstop' },
  '7': { es: 'Jardinero izquierdo', en: 'Left fielder' },
  '8': { es: 'Jardinero central', en: 'Center fielder' },
  '9': { es: 'Jardinero derecho', en: 'Right fielder' },
}

export const TOKENS: Token[] = [
  // Ways to reach base
  { value: '1B', es: 'Sencillo', en: 'Single', group: 'reach' },
  { value: '2B', es: 'Doble', en: 'Double', group: 'reach' },
  { value: '3B', es: 'Triple', en: 'Triple', group: 'reach' },
  { value: 'HR', es: 'Jonrón', en: 'Home run', group: 'reach' },
  { value: 'BB', es: 'Base por bolas', en: 'Walk', group: 'reach' },
  { value: 'HBP', es: 'Golpeado por lanzamiento', en: 'Hit by pitch', group: 'reach' },
  { value: 'E', es: 'Error', en: 'Error', group: 'reach' },
  { value: 'FC', es: 'Selección del fildeador', en: "Fielder's choice", group: 'reach' },
  // Outs
  { value: 'K', es: 'Ponche', en: 'Strikeout', group: 'out' },
  { value: 'Kc', es: 'Ponche sin swing', en: 'Strikeout looking', group: 'out' },
  { value: 'F', es: 'Elevado', en: 'Fly out', group: 'out' },
  { value: 'L', es: 'Línea', en: 'Line out', group: 'out' },
  { value: 'P', es: 'Elevado corto', en: 'Pop out', group: 'out' },
  { value: 'SF', es: 'Elevado de sacrificio', en: 'Sacrifice fly', group: 'out' },
  { value: 'SAC', es: 'Toque de sacrificio', en: 'Sacrifice bunt', group: 'out' },
  { value: 'DP', es: 'Doble play', en: 'Double play', group: 'out' },
  // Runner events
  { value: 'SB', es: 'Base robada', en: 'Stolen base', group: 'runner' },
  { value: 'CS', es: 'Out robando', en: 'Caught stealing', group: 'runner' },
  { value: 'WP', es: 'Lanzamiento descontrolado', en: 'Wild pitch', group: 'runner' },
  { value: 'PB', es: 'Passed ball', en: 'Passed ball', group: 'runner' },
  // Fielder numbers (also used in combinations like 6-3, 4-6-3, F8)
  ...Object.entries(FIELDERS).map(([n, d]) => ({ value: n, es: d.es, en: d.en, group: 'fielder' as const })),
  // The most common ground-out combinations, written as one unit
  { value: '6-3', es: 'Rodado al campo corto, out en primera', en: 'Ground out short to first', group: 'play' },
  { value: '4-3', es: 'Rodado a segunda, out en primera', en: 'Ground out second to first', group: 'play' },
  { value: '5-3', es: 'Rodado a tercera, out en primera', en: 'Ground out third to first', group: 'play' },
  { value: '1-3', es: 'Rodado al lanzador, out en primera', en: 'Ground out pitcher to first', group: 'play' },
  { value: '3-1', es: 'Rodado a primera, lanzador cubre', en: 'Ground out first, pitcher covers', group: 'play' },
  { value: '6-4-3', es: 'Doble play campo corto', en: 'Double play short to second to first', group: 'play' },
  { value: '4-6-3', es: 'Doble play segunda base', en: 'Double play second to short to first', group: 'play' },
]

export const TOKEN_VALUES = TOKENS.map((t) => t.value)

export function describeToken(value: string, language: 'es' | 'en'): string {
  const token = TOKENS.find((t) => t.value === value)
  if (token) return token[language]
  // Compositions like "F8" or "L7": out type + fielder
  const m = value.match(/^([FLP])([1-9])$/)
  if (m) {
    const out = TOKENS.find((t) => t.value === m[1])
    const f = FIELDERS[m[2]]
    if (out && f) return `${out[language]} · ${f[language]}`
  }
  return value
}

/**
 * Letters and digits, written one per cell. Used for free text (player names,
 * jersey numbers) in Classic mode: each cell is recognized on its own and the
 * roster is filtered as the letters arrive, so the scorer taps the player
 * instead of writing the whole name.
 */
export const LETTER_TOKENS: Token[] = [
  ...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').map((c) => ({ value: c, es: `Letra ${c}`, en: `Letter ${c}`, group: 'fielder' as const })),
  ...'0123456789'.split('').map((d) => ({ value: d, es: `Número ${d}`, en: `Digit ${d}`, group: 'fielder' as const })),
]
export const LETTER_VALUES = LETTER_TOKENS.map((t) => t.value)

export type SampleSet = 'notation' | 'letters'
export function tokensFor(set: SampleSet): Token[] {
  return set === 'letters' ? LETTER_TOKENS : TOKENS
}
