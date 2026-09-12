/**
 * $P point-cloud recognizer (Vatavu, Anthony & Wobbrock 2012), adapted for the
 * scorecard vocabulary. Multi-stroke, stroke-order and direction invariant,
 * and it works with a handful of templates per token, which is why it suits a
 * closed vocabulary written by many different hands.
 *
 * Strokes are arrays of [x, y] points in box-relative units (0-100).
 */

export type Point = [number, number]
export type Stroke = Point[]

export interface Template {
  symbol: string
  cloud: Cloud
}

interface CloudPoint {
  x: number
  y: number
  id: number // stroke index, kept for completeness
}
type Cloud = CloudPoint[]

const N = 48 // points per normalized cloud

export function normalize(strokes: Stroke[]): Cloud {
  const pts: CloudPoint[] = []
  strokes.forEach((s, i) => s.forEach(([x, y]) => pts.push({ x, y, id: i })))
  if (pts.length < 2) return pts.length ? [{ ...pts[0] }] : []
  return translateToOrigin(scale(resample(pts, N)))
}

export interface Match {
  symbol: string
  /** 0 (no match) to 1 (identical). Values above ~0.7 are usually right. */
  score: number
}

/** Rank every symbol in the template set against the drawn strokes. */
export function recognize(strokes: Stroke[], templates: Template[]): Match[] {
  const cloud = normalize(strokes)
  if (cloud.length < 2 || templates.length === 0) return []
  const best = new Map<string, number>()
  for (const t of templates) {
    if (t.cloud.length < 2) continue
    const d = greedyCloudMatch(cloud, t.cloud)
    const prev = best.get(t.symbol)
    if (prev === undefined || d < prev) best.set(t.symbol, d)
  }
  return [...best.entries()]
    .map(([symbol, d]) => ({ symbol, score: Math.max(0, (2 - d) / 2) }))
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------

function pathLength(pts: CloudPoint[]): number {
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id === pts[i - 1].id) d += dist(pts[i - 1], pts[i])
  }
  return d
}

function resample(pts: CloudPoint[], n: number): CloudPoint[] {
  const I = pathLength(pts) / (n - 1)
  if (I === 0) return pts.slice(0, n)
  let D = 0
  const out: CloudPoint[] = [{ ...pts[0] }]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id === pts[i - 1].id) {
      let d = dist(pts[i - 1], pts[i])
      if (D + d >= I) {
        let first = pts[i - 1]
        while (D + d >= I) {
          const t = Math.min(Math.max((I - D) / d, 0), 1)
          const q: CloudPoint = {
            x: first.x + t * (pts[i].x - first.x),
            y: first.y + t * (pts[i].y - first.y),
            id: pts[i].id,
          }
          out.push(q)
          d = D + d - I
          D = 0
          first = q
        }
        D = d
      } else {
        D += d
      }
    }
  }
  while (out.length < n) out.push({ ...out[out.length - 1] })
  return out.slice(0, n)
}

function scale(pts: CloudPoint[]): CloudPoint[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
  }
  const s = Math.max(maxX - minX, maxY - minY) || 1
  return pts.map((p) => ({ x: (p.x - minX) / s, y: (p.y - minY) / s, id: p.id }))
}

function translateToOrigin(pts: CloudPoint[]): CloudPoint[] {
  let cx = 0, cy = 0
  for (const p of pts) { cx += p.x; cy += p.y }
  cx /= pts.length; cy /= pts.length
  return pts.map((p) => ({ x: p.x - cx, y: p.y - cy, id: p.id }))
}

function dist(a: CloudPoint, b: CloudPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function greedyCloudMatch(a: Cloud, b: Cloud): number {
  const n = Math.min(a.length, b.length)
  const e = 0.5
  const step = Math.max(1, Math.floor(Math.pow(n, 1 - e)))
  let min = Infinity
  for (let i = 0; i < n; i += step) {
    min = Math.min(min, cloudDistance(a, b, i), cloudDistance(b, a, i))
  }
  return min
}

function cloudDistance(a: Cloud, b: Cloud, start: number): number {
  const n = Math.min(a.length, b.length)
  const matched = new Array(n).fill(false)
  let sum = 0
  let i = start
  do {
    let index = -1
    let min = Infinity
    for (let j = 0; j < n; j++) {
      if (!matched[j]) {
        const d = dist(a[i], b[j])
        if (d < min) { min = d; index = j }
      }
    }
    matched[index] = true
    const weight = 1 - ((i - start + n) % n) / n
    sum += weight * min
    i = (i + 1) % n
  } while (i !== start)
  return sum
}
