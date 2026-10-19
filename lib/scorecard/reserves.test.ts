import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { availableReservePlayers, eligibleReserves, isPitcher, readReserves, saveReserves } from './reserves'
const roster = [{ id: 'starter', positions: ['LF'] }, { id: 'bench', positions: ['Catcher (C)'] }, { id: 'relief', positions: ['Lanzador (P)'] }, { id: 'starting-pitcher', positions: ['P'] }]
it('defaults unused position players to bench and unused pitchers to bullpen, excluding the DH-linked starter', () => {
  expect(eligibleReserves(roster, ['starter', 'starting-pitcher'], null)).toEqual({ bench: ['bench'], bullpen: ['relief'] })
  expect(isPitcher({ id: 'p', positions: ['Pitcher (P)'] })).toBe(true)
})
it('preserves explicitly empty selections and filters foreign, duplicate and newly starting players', () => {
  expect(eligibleReserves(roster, [], { bench: [], bullpen: [] })).toEqual({ bench: [], bullpen: [] })
  expect(eligibleReserves(roster, ['starter'], { bench: ['starter', 'foreign', 'bench', 'bench'], bullpen: ['bench', 'relief'] })).toEqual({ bench: ['bench'], bullpen: ['relief'] })
})
it('distinguishes legacy games from deliberately selected empty reserves', () => {
  expect(readReserves({}, 'home')).toBeNull()
  expect(readReserves({ home: { bench: [], bullpen: [] } }, 'home')).toEqual({ bench: [], bullpen: [] })
  expect(readReserves({ home: { bench: [2], bullpen: [] } }, 'home')).toBeNull()
})
it('only offers selected unused reserves, while retaining the current pitcher for context', () => {
  expect(availableReservePlayers(roster, ['bench'], ['starter', 'starting-pitcher']).map(p => p.id)).toEqual(['bench'])
  expect(availableReservePlayers(roster, [], ['starting-pitcher'], 'starting-pitcher').map(p => p.id)).toEqual(['starting-pitcher'])
  expect(availableReservePlayers(roster, ['relief'], ['relief'])).toEqual([])
  expect(availableReservePlayers(roster, null, ['starter'])).toHaveLength(3)
})
it('retries a concurrent write and keeps the opponent selection', async () => {
  const updates: unknown[] = [], rows = [
    { data: { roster_reserves: {}, updated_at: 'v1' }, error: null }, { data: [], error: null },
    { data: { roster_reserves: { opponent: { bench: ['other'], bullpen: [] } }, updated_at: 'v2' }, error: null }, { data: [{ id: 'game' }], error: null },
  ]
  const from = vi.fn(() => {
    const result = Promise.resolve(rows.shift()), chain: Record<string, unknown> = { then: result.then.bind(result), single: () => result }
    for (const name of ['select', 'eq']) chain[name] = () => chain
    chain.update = (payload: unknown) => { updates.push(payload); return chain }
    return chain
  })
  await saveReserves({ from } as unknown as SupabaseClient, 'game', 'home', { bench: ['bench'], bullpen: ['relief'] })
  expect(updates[1]).toEqual({ roster_reserves: { home: { bench: ['bench'], bullpen: ['relief'] }, opponent: { bench: ['other'], bullpen: [] } } })
})
