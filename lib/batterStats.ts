import type { SupabaseClient } from '@supabase/supabase-js'
import { scoringPlay } from './scorecard/plays'
import type { SprayAtBat } from '@/components/SprayChart'

const NO_AB = new Set(['walk', 'hit_by_pitch', 'sacrifice_fly', 'sacrifice_bunt', 'catcher_interference'])

export function battingLine(rows: { result: string }[]) {
  let hits = 0, atBats = 0
  for (const row of rows) {
    const play = scoringPlay(row.result)
    if (!play) continue
    if (play.group === 'hit') hits++
    if (!NO_AB.has(play.result)) atBats++
  }
  return { hits, atBats, label: `${hits}-${atBats}` }
}

export async function loadBatterHistory(client: SupabaseClient, batterId: string, pitcherId: string, gameId?: string): Promise<SprayAtBat[]> {
  const rows: SprayAtBat[] = []
  for (let offset = 0; ; offset += 500) {
    let query = client.from('at_bats').select('id, player_id, result, notation, hit_x, hit_y, field_zone, field_area')
      .eq('player_id', batterId).eq('pitcher_id', pitcherId).order('id').range(offset, offset + 499)
    if (gameId) query = query.eq('game_id', gameId)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 500) return rows
  }
}
