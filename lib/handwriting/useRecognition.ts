'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createRecognitionDelay } from './recognitionDelay'
import { recognizeFor, type RecognitionScope } from './templates'
import type { Stroke, Template } from './recognizer'
export function useRecognition(strokes: Stroke[], templates: Template[], scope: RecognitionScope) {
  const [settledInk, setSettledInk] = useState('[]')
  const [drawing, setDrawing] = useState(false)
  const delay = useMemo(() => createRecognitionDelay<string>(setSettledInk), [])
  const ink = JSON.stringify(strokes)
  useEffect(() => {
    if (ink === '[]') setSettledInk(ink)
    else if (!drawing && ink !== settledInk) delay.schedule(ink)
    return delay.cancel
  }, [ink, settledInk, drawing, delay])
  const onDrawingChange = useCallback((active: boolean) => {
    if (active) delay.cancel()
    setDrawing(active)
  }, [delay])
  const matches = useMemo(() => settledInk === '[]' ? [] :
    recognizeFor(JSON.parse(settledInk) as Stroke[], templates, scope), [settledInk, templates, scope])
  const waiting = drawing || (ink !== '[]' && ink !== settledInk)
  return { matches: waiting || ink === '[]' ? [] : matches, waiting, onDrawingChange }
}
