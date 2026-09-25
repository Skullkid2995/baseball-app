import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mergePaperDraft, readPaperDraft, paperStorageKey, savePaperDraft, type PaperDraft } from './paperDraft'
const draft:PaperDraft={actions:[{type:'tap',point:[50,50]}],token:'H1',rbi:0,runnerOut:false,runnerActions:{},reviewed:{},updatedAt:'2026-09-25'}
it('keeps separate appearances and substitutions in the same inning',()=>{
  const first=mergePaperDraft([], 'starter:1',draft)
  const second=mergePaperDraft(first,'substitute:2',{...draft,token:'K'})
  expect(readPaperDraft(second,'starter:1')).toEqual(draft)
  expect(readPaperDraft(second,'substitute:2')?.token).toBe('K')
  expect(readPaperDraft(second,'starter:2')).toBeNull()
})
it('preserves legacy pen strokes and distinguishes team sides',()=>{
  expect(mergePaperDraft([[1,2]],'p:1',draft).legacyStrokes).toEqual([[1,2]])
  const box={gameId:'g',side:'home' as const,slot:4,inning:1,appearance:1,playerId:'p'}
  expect(paperStorageKey(box)).not.toBe(paperStorageKey({...box,side:'opponent'}))
  expect(paperStorageKey({...box,session:'old-starter'})).not.toBe(paperStorageKey({...box,session:'new-starter'}))
})

function database(results: unknown[]) {
  const update=vi.fn()
  const from=vi.fn(()=>{
    const result=Promise.resolve(results.shift())
    const chain:Record<string,unknown>={then:result.then.bind(result),maybeSingle:()=>result}
    for(const method of ['select','eq']) chain[method]=()=>chain
    chain.update=(payload:unknown)=>{update(payload);return chain}
    return chain
  })
  return {db:{from} as unknown as SupabaseClient,update,from}
}
it('retries a concurrent update without dropping another appearance',async()=>{
  const other=mergePaperDraft({},'other:1',draft)
  const {db,update}=database([
    {data:{id:'row',strokes:{},updated_at:'old'},error:null},{data:[],error:null},
    {data:{id:'row',strokes:other,updated_at:'new'},error:null},{data:[{id:'row'}],error:null},
  ])
  await savePaperDraft(db,{gameId:'g',side:'home',slot:1,inning:1,appearance:2,playerId:'p'},draft)
  expect(update).toHaveBeenCalledTimes(2)
  const saved=update.mock.calls[1][0].strokes
  expect(readPaperDraft(saved,'other:1')).toEqual(draft)
  expect(readPaperDraft(saved,'legacy:p:2')).toEqual(draft)
})
it('stops on read failure instead of overwriting unseen ink',async()=>{
  const {db,update}=database([{data:null,error:new Error('offline')}])
  await expect(savePaperDraft(db,{gameId:'g',side:'home',slot:1,inning:1,appearance:1,playerId:'p'},draft)).rejects.toThrow('offline')
  expect(update).not.toHaveBeenCalled()
})
it('rejects an older draft instead of replacing newer ink from another device',async()=>{
  const newer=mergePaperDraft({},'legacy:p:1',{...draft,updatedAt:'2026-09-26'})
  const {db,update}=database([{data:{id:'row',strokes:newer,updated_at:'new'},error:null}])
  await expect(savePaperDraft(db,{gameId:'g',side:'home',slot:1,inning:1,appearance:1,playerId:'p'},draft)).rejects.toThrow('Newer ink')
  expect(update).not.toHaveBeenCalled()
})
