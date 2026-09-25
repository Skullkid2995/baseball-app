'use client'
import { useMemo } from 'react'
import type { Template } from '@/lib/handwriting/recognizer'
import { useRecognition } from '@/lib/handwriting/useRecognition'
import type { RecognitionScope } from '@/lib/handwriting/templates'
import { interpretBox, type BoxAction } from './interpret'
export function useScorecardInterpretation(actions: BoxAction[], templates: Template[], scope: RecognitionScope = 'batting') {
  const interpretation = useMemo(() => interpretBox(actions, [],
    templates.filter(t => ['1', '2', '3'].includes(t.symbol))), [actions, templates])
  const { matches, waiting, onDrawingChange } = useRecognition(interpretation.marks.ink, templates, scope)
  return { ...interpretation, tokenMatches: matches, waiting, onDrawingChange }
}
