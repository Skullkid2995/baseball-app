/**
 * Batter-vs-pitcher history: what happened the previous times this batter
 * faced this pitcher, across every game we have scored.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface MatchupRow {
  id: string
  result: string
  notation: string | null
  inning: number
  game_id: string
  games?: { game_date: string; opponent: string } | null
}

export interface MatchupSummary {
  pitcherId: string
  pitcherName: string
  pa: number
  hits: number
  walks: number
  strikeouts: number
  hbp: number
  /** Most recent plate appearances first */
  recent: { label: string; date: string; inning: number }[]
}

const HITS = new Set(['single', 'double', 'triple', 'home_run'])

/** Short scorecard label for a stored result (uses the notation when we have it). */
export function resultLabel(result: string, notation?: string | null): string {
  if (notation && notation !== 'DRAWING_SAVED') return notation
  switch (result) {
    case 'single': return '1B'
    case 'double': return '2B'
    case 'triple': return '3B'
    case 'home_run': return 'HR'
    case 'walk': return 'BB'
    case 'strikeout': return 'K'
    case 'hit_by_pitch': return 'HBP'
    case 'error': return 'E'
    case 'sacrifice_fly': return 'SF'
    case 'sacrifice_bunt': return 'SAC'
    case 'ground_out': return 'GO'
    case 'fly_out': return 'FO'
    case 'line_out': return 'LO'
    case 'pop_out': return 'PO'
    default: return result
  }
}

export function summarizeMatchup(pitcherId: string, pitcherName: string, rows: MatchupRow[]): MatchupSummary {
  const sorted = [...rows].sort((a, b) => {
    const da = a.games?.game_date ?? ''
    const db = b.games?.game_date ?? ''
    if (da !== db) return da < db ? 1 : -1
    return b.inning - a.inning
  })
  return {
    pitcherId,
    pitcherName,
    pa: rows.length,
    hits: rows.filter((r) => HITS.has(r.result)).length,
    walks: rows.filter((r) => r.result === 'walk').length,
    strikeouts: rows.filter((r) => r.result === 'strikeout').length,
    hbp: rows.filter((r) => r.result === 'hit_by_pitch').length,
    recent: sorted.slice(0, 6).map((r) => ({ label: resultLabel(r.result, r.notation), date: r.games?.game_date ?? '', inning: r.inning })),
  }
}

/** Every previous plate appearance of this batter against this pitcher (all games). */
export async function loadMatchup(
  supabase: SupabaseClient,
  batterId: string,
  pitcherId: string,
  pitcherName: string,
  excludeAtBatId?: string
): Promise<MatchupSummary> {
  const { data, error } = await supabase
    .from('at_bats')
    .select('id, result, notation, inning, game_id, games ( game_date, opponent )')
    .eq('player_id', batterId)
    .eq('pitcher_id', pitcherId)
  if (error) {
    console.error('matchup lookup failed:', error.message)
    return summarizeMatchup(pitcherId, pitcherName, [])
  }
  const rows = ((data ?? []) as unknown as MatchupRow[]).filter((r) => r.id !== excludeAtBatId)
  return summarizeMatchup(pitcherId, pitcherName, rows)
}

/** One-line summary for dialog headers: "3 PA · 1 H · 1 BB · 1 K · last: 1B, K" */
export function matchupLine(m: MatchupSummary, lang: 'es' | 'en'): string {
  if (m.pa === 0) return lang === 'es' ? 'primer enfrentamiento' : 'first time facing'
  const parts = [`${m.pa} PA`, `${m.hits} H`]
  if (m.walks) parts.push(`${m.walks} BB`)
  if (m.strikeouts) parts.push(`${m.strikeouts} K`)
  if (m.hbp) parts.push(`${m.hbp} HBP`)
  const last = m.recent.slice(0, 4).map((r) => r.label).join(', ')
  return `${parts.join(' · ')} · ${lang === 'es' ? 'últimos' : 'last'}: ${last}`
}
