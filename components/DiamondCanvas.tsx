'use client'

import ClassicAtBatPad, { type ClassicAtBatPadProps } from './ClassicAtBatPad'
import type { ActiveRunner } from '@/lib/scorecard/runners'
export type { ActiveRunner, RunnerUpdate } from '@/lib/scorecard/runners'

/** One editor for touch, mouse and ink. Kept at the existing import path for scorebook callers. */
export default function DiamondCanvas({ activeRunners = [], ...props }: Omit<ClassicAtBatPadProps, 'activeRunners'> & { activeRunners?: ActiveRunner[] }) {
  return <ClassicAtBatPad {...props} activeRunners={activeRunners.map(r => ({ ...r, playerId: r.playerId ?? null }))} />
}
