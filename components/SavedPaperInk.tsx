'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadPaperDraft, paperStorageKey, type PaperBox, type PaperDraft } from '@/lib/scorecard/paperDraft'
import { interpretBox } from '@/lib/scorecard/interpret'
import ScorecardBox from './ScorecardBox'
import { HOME } from '@/lib/scorecard/geometry'
import { validHitLocation } from '@/lib/scorecard/hitLocation'
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
  if (!draft || (!draft.actions.length && !validHitLocation(draft.hitLocation))) return null
  const marks = interpretBox(draft.actions,[]).marks
  return <details className="mt-3 border-t border-stone-300 pt-2"><summary className="cursor-pointer font-serif">{language==='es'?'Trazos originales y trayectoria':'Original pen strokes and trajectory'}</summary><ScorecardBox actions={draft.actions} marks={{ ...marks, hitLine: draft.hitLocationConfirmed && validHitLocation(draft.hitLocation) ? [HOME, draft.hitLocation] : marks.hitLine }} notation={draft.token} disabled onChange={()=>{}} /></details>
}
