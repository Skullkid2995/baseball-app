import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureStartingPitcher, startingPitcherId } from './startingPitcher'
const lineup = [{ player_id: 'pitcher', position: 'P' }]
describe('starting pitcher from lineup', () => {
  it('uses the assigned position, not a player roster preference', () => {
    expect(startingPitcherId(lineup)).toBe('pitcher')
    expect(startingPitcherId([{player_id:'catcher',position:'C'}])).toBeNull()
  })
  it('uses the pitcher linked to a DH, not the DH himself', () => {
    expect(startingPitcherId([{player_id:'dh',position:'DH',batting_for:'pitcher'}])).toBe('pitcher')
  })
  it('leaves missing or ambiguous assignments for the scorer', () => {
    expect(startingPitcherId([{player_id:'dh',position:'DH'}])).toBeNull()
    expect(startingPitcherId([...lineup,{player_id:'other',position:'P'}])).toBeNull()
  })
  function database(existing: boolean, played: boolean) {
    const upsert = vi.fn().mockResolvedValue({error:null})
    const from = vi.fn((table: string) => {
      const result = {data: (table === 'game_pitchers' ? existing : played) ? [{id:'existing'}] : [], error:null}
      const chain: Record<string, unknown> = {then: Promise.resolve(result).then.bind(Promise.resolve(result)),upsert}
      for (const key of ['select','eq','or','limit']) chain[key] = () => chain
      return chain
    })
    return {db:{from} as unknown as SupabaseClient,upsert}
  }
  it('preserves an existing starter or reliever', async () => {
    const {db,upsert}=database(true,false)
    await ensureStartingPitcher(db,'game','home',lineup)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('does not rewrite the pitching history of a game already scored', async () => {
    const {db,upsert}=database(false,true)
    await ensureStartingPitcher(db,'game','opponent',lineup)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('starts in inning one and never overwrites a concurrent selection', async () => {
    const {db,upsert}=database(false,false)
    await ensureStartingPitcher(db,'game','opponent',lineup)
    expect(upsert).toHaveBeenCalledWith({game_id:'game',team_side:'opponent',pitcher_id:'pitcher',sequence:1,from_inning:1}, {onConflict:'game_id,team_side,sequence',ignoreDuplicates:true})
  })
})
