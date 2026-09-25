import { scorebookProgress, type ScorebookPlay } from './basePath'
import { isBatterOut, scoringPlay } from './plays'
import type { RunnerEventType } from '../runnerEvents'

export interface SavedRunnerEvent {
  id: string; runner_at_bat_id: string; event_type: RunnerEventType
  from_base: string; to_base: string | null; is_out: boolean
  fielders?: string | null; created_at: string
}
export interface HistoryStep { code: string; from: number; to: number | null; out: boolean; inferred?: boolean }
const bases: Record<string, number> = { first: 1, second: 2, third: 3, home: 4 }
export const baseLabel = (base: number) => ['H', '1B', '2B', '3B', 'H'][base]

/** Never invent a stolen base or the target of an old runner out. */
export function playHistory(play: ScorebookPlay, events: SavedRunnerEvent[]): HistoryStep[] {
  const code = play.notation || scoringPlay(play.result)?.code || play.result
  const first = scoringPlay(play.result)?.base || 0
  const steps: HistoryStep[] = [{ code, from: 0, to: first, out: isBatterOut(play.result) }]
  let safe = first
  for (const event of [...events].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
    const from = bases[event.from_base]
    if (!from) continue
    if (from > safe) steps.push({ code: 'ADV', from: safe, to: from, out: false, inferred: true })
    const to = event.event_type === 'PK' ? from : event.to_base ? bases[event.to_base] : null
    steps.push({ code: [event.event_type, event.fielders].filter(Boolean).join(' '), from, to, out: event.is_out, ...(event.is_out && to === null ? { inferred: true } : {}) })
    safe = event.is_out ? from : to || from
  }
  const progress = scorebookProgress(play)
  if (progress.reached > safe) steps.push({ code: 'ADV', from: safe, to: progress.reached, out: false, inferred: true })
  if (progress.out && !steps.some(s => s.out)) steps.push({ code: 'OUT', from: progress.reached, to: null, out: true, inferred: true })
  return steps
}

export function stepLabel(step: HistoryStep) {
  return `${step.code}${step.to ? ` → ${baseLabel(step.to)}` : ''}${step.out && step.code !== 'OUT' ? ' · OUT' : ''}${step.inferred ? ' *' : ''}`
}
