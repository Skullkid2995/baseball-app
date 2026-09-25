import { normalize, recognize, type Stroke, type Template } from './recognizer'
import { scoringPlay } from '@/lib/scorecard/plays'
import { TOKEN_VALUES } from './vocabulary'
export type RecognitionScope = 'batting' | 'shared' | 'notation' | 'letters'
export interface TrainingSample {
  id: string; writer: string; symbol: string; strokes: Stroke[]
  recognized: string | null; correct: boolean | null; pointer_type: string | null
}
export function templatesFor(samples: { symbol: string; strokes: Stroke[] }[]): Template[] {
  return samples.filter(s => Array.isArray(s.strokes) && s.strokes.every(stroke =>
    Array.isArray(stroke) && stroke.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))))
    .map(s => ({ symbol: s.symbol.trim().toUpperCase(), cloud: normalize(s.strokes) })).filter(t => t.cloud.length > 1)
}
export function allowedSymbol(symbol: string, scope: RecognitionScope) {
  if (scope === 'letters') return /^[A-ZÑ0-9]$/.test(symbol.toUpperCase())
  const play = scoringPlay(symbol)
  if (scope === 'notation') return !!play || TOKEN_VALUES.some(t => t.toUpperCase() === symbol.toUpperCase())
  return !!play && (scope === 'shared' || !play.sharedOnly)
}
/** Filter before ranking so unrelated symbols cannot consume the top three slots. */
export function recognizeFor(strokes: Stroke[], templates: Template[], scope: RecognitionScope) {
  return recognize(strokes, templates.filter(t => allowedSymbol(t.symbol, scope))).slice(0, 3)
}
export async function loadTrainingSamples(fetchPage: (from: number, to: number) => PromiseLike<{ data: TrainingSample[] | null; error: { message: string } | null }>) {
  const rows: TrainingSample[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await fetchPage(offset, offset + 499)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < 500) return rows
  }
}
