'use client'

import { useMemo } from 'react'
import FieldSvg from './FieldSvg'
import { HOME, pointForZone, type Pt } from '@/lib/scorecard/geometry'

export interface SprayAtBat {
  id: string
  result: string
  notation?: string | null
  hit_x?: number | string | null
  hit_y?: number | string | null
  field_zone?: string | null
  field_area?: string | null
  player_id: string
  players?: { first_name: string; last_name: string } | null
}

type Kind = 'hit' | 'out' | 'other'

const HITS = new Set(['single', 'double', 'triple', 'home_run'])
const OUTS = new Set(['ground_out', 'fly_out', 'line_out', 'pop_out', 'sacrifice_fly', 'sacrifice_bunt'])
const NO_BALL = new Set(['strikeout', 'walk', 'hit_by_pitch'])

const COLOR: Record<Kind, string> = { hit: '#16a34a', out: '#dc2626', other: '#64748b' }

function kindOf(result: string): Kind | null {
  if (NO_BALL.has(result)) return null
  if (HITS.has(result)) return 'hit'
  if (OUTS.has(result)) return 'out'
  return 'other' // error, fielder's choice...
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Landing point: exact when recorded, else approximated from the zone name. */
export function landingPoint(ab: SprayAtBat): { p: Pt; exact: boolean } | null {
  const x = num(ab.hit_x)
  const y = num(ab.hit_y)
  if (x !== null && y !== null && (x !== 0 || y !== 0)) return { p: [x, y], exact: true }
  const zone = ab.field_zone || ab.field_area || ''
  const p = pointForZone(zone, ab.id)
  return p ? { p, exact: false } : null
}

interface SprayChartProps {
  atBats: SprayAtBat[]
  lang: 'es' | 'en'
  className?: string
}

/**
 * Every batted ball drawn as the line the scorer registered: home plate to
 * where it landed. Green = hit, red = out, gray = reached some other way
 * (error, fielder's choice). Older at-bats without exact coordinates are
 * placed by their zone (dashed).
 */
export default function SprayChart({ atBats, lang, className }: SprayChartProps) {
  const lines = useMemo(() => {
    const out: { id: string; p: Pt; kind: Kind; exact: boolean; label: string }[] = []
    for (const ab of atBats) {
      const kind = kindOf(ab.result)
      if (!kind) continue
      const lp = landingPoint(ab)
      if (!lp) continue
      const who = ab.players ? `${ab.players.first_name} ${ab.players.last_name}` : ''
      out.push({ id: ab.id, p: lp.p, kind, exact: lp.exact, label: `${who} · ${ab.notation || ab.result}` })
    }
    return out
  }, [atBats])

  const counts = {
    hit: lines.filter((l) => l.kind === 'hit').length,
    out: lines.filter((l) => l.kind === 'out').length,
    other: lines.filter((l) => l.kind === 'other').length,
    approx: lines.filter((l) => !l.exact).length,
  }
  const es = lang === 'es'

  return (
    <div className={className}>
      <div className="relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-2xl border border-slate-300 bg-[#fffdf7] shadow-inner">
        <FieldSvg className="absolute inset-0 h-full w-full" view="full" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {(['other', 'out', 'hit'] as Kind[]).map((k) =>
            lines
              .filter((l) => l.kind === k)
              .map((l) => (
                <g key={l.id}>
                  <line
                    x1={HOME[0]}
                    y1={HOME[1]}
                    x2={l.p[0]}
                    y2={l.p[1]}
                    stroke={COLOR[l.kind]}
                    strokeWidth={l.kind === 'other' ? 0.6 : 0.8}
                    strokeOpacity={0.75}
                    strokeLinecap="round"
                    strokeDasharray={l.exact ? undefined : '1.6 1.2'}
                  />
                  <circle cx={l.p[0]} cy={l.p[1]} r={1.5} fill={COLOR[l.kind]} stroke="#ffffff" strokeWidth={0.4}>
                    <title>{l.label}</title>
                  </circle>
                </g>
              ))
          )}
        </svg>
        {lines.length === 0 && (
          <div className="absolute inset-x-0 top-3 text-center text-xs font-medium text-slate-500">
            {es ? 'Sin batazos con ubicación en este filtro' : 'No batted balls with a location in this filter'}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1 w-5 rounded" style={{ background: COLOR.hit }} /> {es ? 'Hits' : 'Hits'} ({counts.hit})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1 w-5 rounded" style={{ background: COLOR.out }} /> {es ? 'Outs' : 'Outs'} ({counts.out})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1 w-5 rounded" style={{ background: COLOR.other }} /> {es ? 'Error / FC' : 'Error / FC'} ({counts.other})
        </span>
        {counts.approx > 0 && (
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <span className="inline-block h-0 w-5 border-t border-dashed border-slate-500" />{' '}
            {es ? `${counts.approx} por zona (sin punto exacto)` : `${counts.approx} by zone (no exact point)`}
          </span>
        )}
      </div>
    </div>
  )
}
