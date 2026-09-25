import { describe, expect, it } from 'vitest'
import { battingLine, loadBatterHistory } from './batterStats'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('official batting line', () => {
  it('counts hits and official outs, including errors and choices', () => {
    expect(battingLine(['single', 'ground_out'].map(result => ({ result }))).label).toBe('1-2')
    expect(battingLine(['strikeout', 'fly_out'].map(result => ({ result }))).label).toBe('0-2')
    expect(battingLine(['error', 'fielders_choice', 'double_play'].map(result => ({ result }))).label).toBe('0-3')
  })
  it('excludes non-at-bats and unfinished entries', () => {
    expect(battingLine(['walk', 'intentional_walk', 'hit_by_pitch', 'sacrifice_fly', 'sacrifice_bunt', 'catcher_interference', '', 'DRAWING_SAVED'].map(result => ({ result }))).label).toBe('0-0')
  })
})

describe('pitcher history', () => {
  it('paginates and filters by both player identities and selected game', async () => {
    const filters: unknown[] = []
    const ranges: number[] = []
    const query = {
      select() { return this },
      eq(column: string, value: string) { filters.push([column, value]); return this },
      order() { return this },
      range(start: number) { ranges.push(start); return this },
      then(resolve: (value: unknown) => void) { resolve({ data: Array.from({ length: ranges.at(-1) === 0 ? 500 : 1 }, () => ({ result: 'single' })), error: null }) },
    }
    const client = { from: () => query } as unknown as SupabaseClient
    expect(await loadBatterHistory(client, 'batter', 'pitcher', 'game')).toHaveLength(501)
    expect(ranges).toEqual([0, 500])
    expect(filters).toContainEqual(['player_id', 'batter'])
    expect(filters).toContainEqual(['pitcher_id', 'pitcher'])
    expect(filters).toContainEqual(['game_id', 'game'])
  })
  it('does not report a failed lookup as empty history', async () => {
    const query = { select() { return this }, eq() { return this }, order() { return this }, range() { return Promise.resolve({ data: null, error: new Error('offline') }) } }
    await expect(loadBatterHistory({ from: () => query } as unknown as SupabaseClient, 'b', 'p')).rejects.toThrow('offline')
  })
})
