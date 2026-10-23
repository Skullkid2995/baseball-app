import type { SupabaseClient } from '@supabase/supabase-js'
export interface Reserves { bench: string[]; bullpen: string[] }
export type ReserveSide = 'home' | 'opponent'
export interface ReservePlayer { id: string; positions?: string[] | null; is_active?: boolean | null }
export const isPitcher = (p: ReservePlayer) => (p.positions ?? []).some(pos => /^(?:P|PITCHER)$/i.test(pos.trim()) || /\(P\)\s*$/i.test(pos))
export function readReserves(value: unknown, side: ReserveSide): Reserves | null {
  if (!value || typeof value !== 'object') return null
  const row = (value as Record<string, unknown>)[side] as Partial<Reserves> | undefined
  return row && Array.isArray(row.bench) && Array.isArray(row.bullpen) && [...row.bench, ...row.bullpen].every(id => typeof id === 'string') ? { bench: [...new Set(row.bench)], bullpen: [...new Set(row.bullpen)].filter(id => !row.bench!.includes(id)) } : null
}
export function availableReservePlayers<T extends ReservePlayer>(roster: T[], selectedIds: string[] | null, used: string[], currentId?: string): T[] {
  return roster.filter(p => p.id === currentId || (p.is_active !== false && (!selectedIds || selectedIds.includes(p.id)) && !used.includes(p.id)))
}
export function eligibleReserves(roster: ReservePlayer[], starters: string[], selected: Reserves | null): Reserves {
  const eligible = roster.filter(p => p.is_active !== false && !starters.includes(p.id))
  if (!selected) return { bench: eligible.filter(p => !isPitcher(p)).map(p => p.id), bullpen: eligible.filter(isPitcher).map(p => p.id) }
  const ids = new Set(eligible.map(p => p.id))
  return { bench: [...new Set(selected.bench)].filter(id => ids.has(id)), bullpen: [...new Set(selected.bullpen)].filter(id => ids.has(id) && !selected.bench.includes(id)) }
}
/** Compare-and-swap preserves the other side when two lineup editors save together. */
export async function saveReserves(db: SupabaseClient, gameId: string, side: ReserveSide, selection: Reserves) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await db.from('games').select('roster_reserves,updated_at').eq('id', gameId).single()
    if (row.error) throw row.error
    const result = await db.from('games').update({ roster_reserves: { ...row.data.roster_reserves, [side]: selection } }).eq('id', gameId).eq('updated_at', row.data.updated_at).select('id')
    if (result.error) throw result.error
    if (result.data?.length) return
  }
  throw new Error('The game roster changed. Please retry / Cambió la banca del juego. Reintenta.')
}
