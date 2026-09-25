'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadPaperDraft, paperStorageKey, type PaperBox, type PaperDraft } from '@/lib/scorecard/paperDraft'
import { interpretBox } from '@/lib/scorecard/interpret'
import ScorecardBox from './ScorecardBox'
export default function SavedPaperInk({box, language}: {box:PaperBox;language:'en'|'es'}) {
  const [draft,setDraft]=useState<PaperDraft|null>(null)
  const key=paperStorageKey(box)
  useEffect(()=>{
    let active=true
    setDraft(null)
    loadPaperDraft(supabase,box).then(saved=>{if(active)setDraft(saved)}).catch(()=>{})
    return ()=>{active=false}
  // The key contains every field used by the database lookup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key])
  if (!draft?.actions.length) return null
  return <details className="mt-3 border-t border-stone-300 pt-2"><summary className="cursor-pointer font-serif">{language==='es'?'Trazos originales':'Original pen strokes'}</summary><ScorecardBox actions={draft.actions} marks={interpretBox(draft.actions,[]).marks} notation={draft.token} disabled onChange={()=>{}} /></details>
}
