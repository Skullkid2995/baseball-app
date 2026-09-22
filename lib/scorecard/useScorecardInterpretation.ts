'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { recognize, type Stroke, type Template } from '@/lib/handwriting/recognizer'
import { createRecognitionDelay } from '@/lib/handwriting/recognitionDelay'
import { interpretBox, type BoxAction } from './interpret'

export function useScorecardInterpretation(actions: BoxAction[], templates: Template[]) {
  const [settledInk, setSettledInk] = useState('[]')
  const [drawing, setDrawing] = useState(false)
  const delay = useMemo(() => createRecognitionDelay<string>(setSettledInk), [])
  // Counts, base paths, hit locations and out marks respond on every completed stroke.
  const { marks } = useMemo(() => interpretBox(actions, [],
    templates.filter(t => ['1', '2', '3'].includes(t.symbol))), [actions, templates])
  // Only notation ink belongs to the delayed read. Marking a ball or a base does
  // not invalidate a result already read from exactly the same ink.
  const ink = JSON.stringify(marks.ink)

  useEffect(() => {
    if (ink === '[]') setSettledInk(ink)
    else if (!drawing && ink !== settledInk) delay.schedule(ink)
    return delay.cancel
  }, [ink, settledInk, drawing, delay])

  const onDrawingChange = useCallback((active: boolean) => {
    // Cancel synchronously, so a timer cannot fire while the next stroke starts.
    if (active) delay.cancel()
    setDrawing(active)
  }, [delay])

  const tokenMatches = useMemo(() => settledInk === '[]' ? [] :
    recognize(JSON.parse(settledInk) as Stroke[], templates).slice(0, 3), [settledInk, templates])
  const waiting = ink !== '[]' && (drawing || ink !== settledInk)

  return {
    marks,
    tokenMatches: waiting || ink === '[]' ? [] : tokenMatches,
    waiting,
    onDrawingChange,
  }
}
