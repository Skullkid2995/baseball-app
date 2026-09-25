import { classifyStroke, type BoxAction } from './interpret'
import { BASE_PATH, dist, type Pt } from './geometry'
import { NO_BASES, runnerUpdateFor, type ActiveRunner, type RunnerMove } from './runners'

export const RUNNER_DIAMOND: Pt[] = [[50,88],[88,50],[50,12],[12,50],[50,88]]
export const RUNNER_OUT: Pt = [88,88]
const names = ['first','second','third','home'] as const
const fieldPoint = ([x,y]: Pt): Pt => [50 + (x-50)*16/38, 74 + (y-50)*16/38]

/** Replay only this play's additions over an immutable existing base path. */
export function runnerDrawing(runner: ActiveRunner, actions: BoxAction[]) {
  const initial = names.indexOf(runner.base) + 1
  let reached = initial, out = false
  for (const action of actions) {
    const points = action.type === 'tap' ? [action.point] : action.points
    if (!points.length) continue
    if (points.every(p => dist(p, RUNNER_OUT) < 12)) { out = action.type === 'tap' ? !out : true; continue }
    if (action.type === 'tap') {
      const target = RUNNER_DIAMOND.findIndex(p => dist(p, action.point) < 9)
      if (target === 0 || dist(action.point, [50,50]) < 12) reached = 4
      else if (target > reached) reached = target
      continue
    }
    // Shading the diamond is the paper-scorecard gesture for a run.
    if (points.length >= 4 && points.every(p => Math.abs(p[0]-50)+Math.abs(p[1]-50) < 28)
      && points.reduce((n,p,i) => n + (i ? dist(points[i-1],p) : 0),0) > 20) { reached = 4; continue }
    const mapped = points.map(fieldPoint)
    const kind = classifyStroke(mapped)
    const startsOnReachedPath = BASE_PATH.slice(0, reached + 1).some(p => dist(p, mapped[0]) < 8)
    if (kind.kind === 'base_path' && startsOnReachedPath) reached = Math.max(reached, kind.toBase)
  }
  const move: RunnerMove = out ? 'out' : reached === initial ? 'stay' : names[reached-1] as 'second' | 'third' | 'home'
  const bases = { ...NO_BASES }
  for (let i=0; i<reached; i++) bases[names[i]] = true
  return { reached, out, move, bases, scored: reached === 4 && !out }
}

export function drawnRunnerUpdate(runner: ActiveRunner, actions: BoxAction[], result: string) {
  const drawing = runnerDrawing(runner, actions)
  const update = runnerUpdateFor(runner, drawing.move, result)
  // Keep the path already completed when a runner is retired while advancing.
  if (drawing.out) {
    update.base_runners = { ...drawing.bases, home: false }
    update.base_runner_outs = { ...NO_BASES, [names[Math.min(drawing.reached,3)-1]]: true }
  }
  return update
}
