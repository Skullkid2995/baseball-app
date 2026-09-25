import type { BoxAction } from './interpret'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PaperDraft {
  actions: BoxAction[]; token: string; rbi: number; runnerOut: boolean
  runnerActions: Record<string, BoxAction[]>; reviewed: Record<string, string>
  updatedAt: string
}
export interface PaperBox {
  gameId: string; side: 'home' | 'opponent'; slot: number; inning: number; appearance: number; playerId: string; session?: string
}
export const paperBoxKey = (box: PaperBox) => `${box.session || 'legacy'}:${box.playerId}:${box.appearance}`
export const paperStorageKey = (box: PaperBox) => `scorebook-ink:${box.gameId}:${box.side}:${box.slot}:${box.inning}:${paperBoxKey(box)}`

export function mergePaperDraft(strokes: unknown, key: string, draft: PaperDraft) {
  const saved = strokes && typeof strokes === 'object' && !Array.isArray(strokes) ? strokes as Record<string, unknown> : {}
  return { ...saved, version: 2, ...(Array.isArray(strokes) ? { legacyStrokes: strokes } : {}),
    boxes: { ...((saved.boxes || {}) as Record<string, PaperDraft>), [key]: draft } }
}
export function readPaperDraft(strokes: unknown, key: string): PaperDraft | null {
  if (!strokes || typeof strokes !== 'object' || Array.isArray(strokes)) return null
  const draft = (strokes as {boxes?: Record<string, PaperDraft>}).boxes?.[key]
  return draft && Array.isArray(draft.actions) && typeof draft.token === 'string' && draft.runnerActions && draft.reviewed ? draft : null
}
const rowQuery = (db: SupabaseClient, box: PaperBox) => db.from('scorecard_ink').select('id,strokes,updated_at')
  .eq('game_id',box.gameId).eq('team_side',box.side).eq('batting_slot',box.slot).eq('inning',box.inning).maybeSingle()
export async function loadPaperDraft(db: SupabaseClient, box: PaperBox) {
  const result = await rowQuery(db,box)
  if (result.error) throw result.error
  return readPaperDraft(result.data?.strokes,paperBoxKey(box))
}
/** Merge appearances using optimistic concurrency; never replace another box's ink. */
export async function savePaperDraft(db: SupabaseClient, box: PaperBox, draft: PaperDraft) {
  for (let attempt=0; attempt<4; attempt++) {
    const row = await rowQuery(db,box)
    if (row.error) throw row.error
    const current = readPaperDraft(row.data?.strokes,paperBoxKey(box))
    if (current && current.updatedAt > draft.updatedAt) throw new Error('Newer ink exists for this box. Reopen it before continuing.')
    const strokes = mergePaperDraft(row.data?.strokes,paperBoxKey(box),draft)
    if (row.data) {
      const result = await db.from('scorecard_ink').update({strokes}).eq('id',row.data.id).eq('updated_at',row.data.updated_at).select('id')
      if (result.error) throw result.error
      if (result.data?.length) return
    } else {
      const result = await db.from('scorecard_ink').insert({game_id:box.gameId,team_side:box.side,batting_slot:box.slot,inning:box.inning,strokes})
      if (!result.error) return
      if (result.error.code !== '23505') throw result.error
    }
  }
  throw new Error('The scorebook changed on another device. Try saving the ink again.')
}
