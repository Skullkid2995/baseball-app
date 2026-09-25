import { describe, expect, it, vi } from 'vitest'
import { allowedSymbol, loadTrainingSamples, recognizeFor, templatesFor, type TrainingSample } from './templates'
import type { Stroke } from './recognizer'
import { BOX_SCENARIOS } from '@/lib/scorecard/scenarios'

const ink: Stroke[] = [[[20, 20], [30, 40], [60, 25]]]
describe('shared training recognition', () => {
  it('filters unrelated symbols before selecting three batting suggestions', () => {
    const templates = templatesFor(['A', 'B', 'C', '1B', 'K', 'BB'].map(symbol => ({ symbol, strokes: ink })))
    expect(recognizeFor(ink, templates, 'batting').map(m => m.symbol)).toEqual(['1B', 'K', 'BB'])
  })
  it('accepts every scorecard scenario, including composed fielding codes after reload', () => {
    for (const scenario of BOX_SCENARIOS) expect(allowedSymbol(scenario.expected.token, 'batting')).toBe(true)
    expect(recognizeFor(ink, templatesFor([{ symbol: 'F8', strokes: ink }]), 'batting')[0].symbol).toBe('F8')
  })
  it('keeps standalone digits, letters and runner events out of batting recognition', () => {
    for (const s of ['1', '2', 'A', 'SB', 'WP']) expect(allowedSymbol(s, 'batting')).toBe(false)
    expect(allowedSymbol('SB', 'notation')).toBe(true)
    expect(allowedSymbol('1', 'letters')).toBe(true)
    expect(allowedSymbol('CI', 'batting')).toBe(false)
    expect(allowedSymbol('CI', 'shared')).toBe(true)
  })
  it('normalizes legacy casing and excludes unusable samples', () => {
    expect(templatesFor([{ symbol: 'Kc', strokes: ink }, { symbol: 'K', strokes: [] }, { symbol: 'BB', strokes: [[[NaN, 1]]] }]).map(t => t.symbol)).toEqual(['KC'])
  })
  it('loads past server page limits instead of silently omitting later training', async () => {
    const rows = Array.from({ length: 1101 }, (_, id) => ({ id: String(id) } as TrainingSample))
    const page = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
    expect(await loadTrainingSamples(page)).toHaveLength(1101)
    expect(page).toHaveBeenLastCalledWith(1000, 1499)
  })
  it('rejects partial loads when a later page fails', async () => {
    const page = vi.fn(async (from: number) => from === 0
      ? { data: Array.from({ length: 500 }, () => ({} as TrainingSample)), error: null }
      : { data: null, error: { message: 'offline' } })
    await expect(loadTrainingSamples(page)).rejects.toThrow('offline')
  })
})
