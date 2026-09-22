'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Template } from '@/lib/handwriting/recognizer'
import { createRecognitionDelay } from '@/lib/handwriting/recognitionDelay'
import { interpretBox, type BoxAction } from './interpret'

const EMPTY_ACTIONS: BoxAction[] = []

export function useScorecardInterpretation(actions: BoxAction[], templates: Template[]) {
  const [settledActions, setSettledActions] = useState<BoxAction[]>(EMPTY_ACTIONS)
  const [drawing, setDrawing] = useState(false)
  const delay = useMemo(() => createRecognitionDelay<BoxAction[]>(setSettledActions), [])

  useEffect(() => {
    if (!actions.length) setSettledActions(actions)
    else if (!drawing) delay.schedule(actions)
    return delay.cancel
  }, [actions, drawing, delay])

  const onDrawingChange = useCallback((active: boolean) => {
    // Cancel synchronously, so a timer cannot fire while the next stroke starts.
    if (active) delay.cancel()
    setDrawing(active)
  }, [delay])

  // Keep previous marks and paint new strokes as raw ink until the pause ends.
  // Undo/clear must never leave deleted marks or suggestions on the canvas.
  const hasSettledPrefix = settledActions.every((action, i) => action === actions[i])
  const visibleActions = hasSettledPrefix ? settledActions : EMPTY_ACTIONS
  const interpretation = useMemo(() => interpretBox(visibleActions, templates,
    templates.filter(t => ['1', '2', '3'].includes(t.symbol))), [visibleActions, templates])
  const waiting = drawing || (actions.length > 0 && actions !== settledActions)

  return {
    marks: interpretation.marks,
    tokenMatches: waiting ? [] : interpretation.tokenMatches,
    pendingActions: actions.slice(visibleActions.length),
    waiting,
    onDrawingChange,
  }
}
