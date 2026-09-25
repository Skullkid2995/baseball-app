'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadPaperDraft, savePaperDraft, paperStorageKey, type PaperBox, type PaperDraft } from './paperDraft'

const contentsOf = ({actions,token,rbi,runnerOut,runnerActions,reviewed}: PaperDraft) => ({actions,token,rbi,runnerOut,runnerActions,reviewed})
const queues = new Map<string, Promise<void>>()
export function usePaperDraft(box: PaperBox | undefined, value: Omit<PaperDraft,'updatedAt'>, restore: (draft: PaperDraft) => void) {
  const [ready,setReady] = useState(!box)
  const [status,setStatus] = useState<'loading'|'saved'|'saving'|'local'>(box ? 'loading' : 'saved')
  const latest = useRef<PaperDraft | null>(null)
  const last = useRef('')
  const restoreRef = useRef(restore); restoreRef.current = restore
  const key = box ? paperStorageKey(box) : ''
  const boxRef = useRef(box); boxRef.current = box
  const serialized = JSON.stringify(value)
  const serializedRef=useRef(serialized); serializedRef.current=serialized
  const alive = useRef(true)
  useEffect(() => { alive.current=true; return () => { alive.current=false } }, [])
  useEffect(() => {
    if (!boxRef.current) return
    let cancelled=false
    setReady(false); setStatus('loading'); last.current=serializedRef.current
    const context=boxRef.current
    let local: PaperDraft | null=null
    try { local=JSON.parse(localStorage.getItem(key)||'null') } catch { /* device storage unavailable */ }
    loadPaperDraft(supabase,context).then(remote => {
      if (cancelled) return
      const draft = local && (!remote || local.updatedAt > remote.updatedAt) ? local : remote
      if (draft) { latest.current=draft; last.current=JSON.stringify(contentsOf(draft)); restoreRef.current(draft) }
      setStatus(local && draft===local && (!remote || local.updatedAt>remote.updatedAt) ? 'local' : 'saved')
    }).catch(() => {
      if (cancelled) return
      if (local) { latest.current=local; last.current=JSON.stringify(contentsOf(local)); restoreRef.current(local) }
      setStatus('local')
    }).finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled=true }
  }, [key])
  async function flush() {
    const context=boxRef.current, draft=latest.current
    if (!context || !draft) return
    if (alive.current) setStatus('saving')
    const job=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(()=>savePaperDraft(supabase,context,draft))
    queues.set(key,job)
    try { await job; if (alive.current && latest.current===draft) setStatus('saved') }
    catch (error) { if (alive.current) setStatus('local'); throw error }
    finally { if (queues.get(key)===job) queues.delete(key) }
  }
  const flushRef=useRef(flush); flushRef.current=flush
  useEffect(() => {
    if (!ready || !key || serialized===last.current) return
    last.current=serialized
    const draft={...JSON.parse(serialized),updatedAt:new Date().toISOString()} as PaperDraft
    latest.current=draft
    try { localStorage.setItem(key,JSON.stringify(draft)) } catch { /* server save still attempted */ }
    setStatus('saving')
    const timer=setTimeout(()=>{void flushRef.current().catch(()=>{})},450)
    return () => clearTimeout(timer)
  }, [ready,key,serialized])
  useEffect(() => () => { void flushRef.current().catch(()=>{}) }, [])
  return {ready,status,flush}
}
