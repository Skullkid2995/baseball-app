import type { SupabaseClient } from '@supabase/supabase-js'

interface LineupAssignment { player_id: string; position: string | null; batting_for?: string | null }

export function startingPitcherId(lineup: LineupAssignment[]): string | null {
  const pitchers = new Set(lineup.flatMap(slot => {
    if (slot.position === 'P') return [slot.player_id]
    if (slot.position === 'DH' && slot.batting_for) return [slot.batting_for]
    return []
  }))
  return pitchers.size === 1 ? [...pitchers][0] : null
}

/** Initialize once, without replacing a manual starter or any pitching change. */
export async function ensureStartingPitcher(db: SupabaseClient, gameId: string, side: 'home' | 'opponent', lineup: LineupAssignment[]) {
  const pitcherId = startingPitcherId(lineup)
  if (!pitcherId) return
  const existing = await db.from('game_pitchers').select('id').eq('game_id', gameId).eq('team_side', side).limit(1)
  if (existing.error) throw existing.error
  if (existing.data?.length) return
  // Never retroactively assign a starter after this side has already pitched.
  let query = db.from('at_bats').select('id').eq('game_id', gameId).limit(1)
  query = side === 'home' ? query.eq('team_side', 'opponent') : query.or('team_side.eq.home,team_side.is.null')
  const appearances = await query
  if (appearances.error) throw appearances.error
  if (appearances.data?.length) return
  // Another tab may have picked the starter while these reads were in flight.
  const inserted = await db.from('game_pitchers').upsert({ game_id: gameId, team_side: side, pitcher_id: pitcherId, sequence: 1, from_inning: 1 },
    { onConflict: 'game_id,team_side,sequence', ignoreDuplicates: true })
  if (inserted.error) throw inserted.error
}
