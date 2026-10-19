import players from './players.json'

export interface MlbPlayer { id: number; name: string; team: string }
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** Match only explicitly linked MLB teams and full player names, never an amateur namesake. */
export function mlbPlayer(name = '', team = ''): MlbPlayer | null {
  const teamName = team.replace(/\s*·\s*PRUEBA\s*$/i, '')
  return players.find(p => normalized(p.name) === normalized(name) && normalized(p.team) === normalized(teamName)) ?? null
}
export const mlbPlayerById = (id: number) => players.find(p => p.id === id) ?? null

export interface BattingStats {
  hits: number; atBats: number; pa: number; walks: number; strikeouts: number; homeRuns: number
  avg: string | null; obp: string | null; ops: string | null
  hitPercent: number | null; walkPercent: number | null; strikeoutPercent: number | null
}
export interface PitchingStats { era: string | null; whip: string | null; innings: string | null; strikeouts: number; walks: number; battersFaced: number }
export interface DirectionShare { key: string; percent: number }
export interface MlbMatchup {
  batter: MlbPlayer; pitcher: MlbPlayer | null; season: number; fetchedAt: string
  regular: BattingStats | null; postseason: BattingStats | null
  versus: BattingStats | null; versusPostseason: BattingStats | null
  pitching: PitchingStats | null; pitchingCareer: PitchingStats | null; career: BattingStats | null; directions: DirectionShare[]; versusDirections: DirectionShare[]
  errors: string[]
}

type Stat = Record<string, unknown>
interface Split { stat?: Stat; team?: { id: number }; pitcher?: { id: number }; sport?: { id: number } }
interface StatsResponse { stats?: { type?: { displayName: string }; splits?: Split[] }[] }
const count = (s: Stat, key: string) => typeof s[key] === 'number' && Number.isFinite(s[key]) ? Math.max(0, s[key] as number) : 0
const rate = (n: number, d: number) => d > 0 ? (n / d).toFixed(3).replace(/^0/, '') : null
const percent = (n: number, d: number) => d > 0 ? Math.round(n / d * 1000) / 10 : null
const numericString = (v: unknown) => typeof v === 'string' && /^\d*\.\d+$/.test(v) ? v : null

/** MLB returns a combined total as well as team rows for traded players. Do not count both. */
export function totalStat(data: StatsResponse, type: string, pitcherId?: number): Stat | null {
  const splits = (data.stats?.find(g => g.type?.displayName === type)?.splits ?? [])
    .filter(s => (!s.sport || s.sport.id === 1) && (!pitcherId || s.pitcher?.id === pitcherId) && s.stat)
  if (!splits.length) return null
  const totals = splits.filter(s => !s.team)
  const rows = totals.length ? totals : splits
  if (rows.length === 1) return rows[0].stat!
  const sum: Stat = {}
  for (const key of ['hits', 'atBats', 'plateAppearances', 'baseOnBalls', 'strikeOuts', 'homeRuns', 'hitByPitch', 'sacFlies', 'totalBases', 'outs', 'earnedRuns', 'battersFaced']) {
    sum[key] = rows.reduce((n, row) => n + count(row.stat!, key), 0)
  }
  const outs = count(sum, 'outs')
  if (outs) sum.inningsPitched = `${Math.floor(outs / 3)}.${outs % 3}`
  return sum
}

export function battingStats(stat: Stat | null): BattingStats | null {
  if (!stat) return null
  const hits = count(stat, 'hits'), atBats = count(stat, 'atBats'), pa = count(stat, 'plateAppearances')
  const walks = count(stat, 'baseOnBalls'), strikeouts = count(stat, 'strikeOuts'), hbp = count(stat, 'hitByPitch')
  const obp = (hits + walks + hbp) / (atBats + walks + hbp + count(stat, 'sacFlies'))
  const slg = atBats ? count(stat, 'totalBases') / atBats : NaN
  return { hits, atBats, pa, walks, strikeouts, homeRuns: count(stat, 'homeRuns'),
    avg: rate(hits, atBats), obp: numericString(stat.obp) ?? (Number.isFinite(obp) ? obp.toFixed(3).replace(/^0/, '') : null),
    ops: numericString(stat.ops) ?? (Number.isFinite(obp + slg) ? (obp + slg).toFixed(3).replace(/^0/, '') : null),
    hitPercent: percent(hits, atBats), walkPercent: percent(walks, pa), strikeoutPercent: percent(strikeouts, pa) }
}

export function pitchingStats(stat: Stat | null): PitchingStats | null {
  if (!stat) return null
  const outs = count(stat, 'outs')
  return { era: numericString(stat.era) ?? (outs ? (count(stat, 'earnedRuns') * 27 / outs).toFixed(2) : null),
    whip: numericString(stat.whip) ?? (outs ? ((count(stat, 'baseOnBalls') + count(stat, 'hits')) * 3 / outs).toFixed(2) : null),
    innings: numericString(stat.inningsPitched), strikeouts: count(stat, 'strikeOuts'), walks: count(stat, 'baseOnBalls'), battersFaced: count(stat, 'battersFaced') }
}
export function directionShares(data: StatsResponse): DirectionShare[] {
  const stat = data.stats?.find(g => g.type?.displayName === 'sprayChart')?.splits?.[0]?.stat
  if (!stat) return []
  const values = ['leftField', 'leftCenterField', 'centerField', 'rightCenterField', 'rightField'].map(key => ({ key, percent: count(stat, key) }))
  const sum = values.reduce((n, v) => n + v.percent, 0)
  // MLB publishes directional shares, not individual coordinates or hit counts.
  return sum > 95 && sum < 105 && values.every(v => v.percent <= 100) ? values : []
}

type FetchStats = (url: string) => Promise<StatsResponse>
export async function loadMlbMatchup(batter: MlbPlayer, pitcher: MlbPlayer | null, season: number, get: FetchStats): Promise<MlbMatchup> {
  const url = (id: number, stats: string, group: string, gameType: string, opponent?: number) => {
    const q = new URLSearchParams({ stats, group, season: String(season), gameType, sportIds: '1' })
    if (opponent) q.set('opposingPlayerId', String(opponent))
    return `https://statsapi.mlb.com/api/v1/people/${id}/stats?${q}`
  }
  const tasks: [string, string][] = [
    ['regular', url(batter.id, pitcher ? 'season,vsPlayerTotal' : 'season', 'hitting', 'R', pitcher?.id)],
    ['postseason', url(batter.id, pitcher ? 'season,vsPlayerTotal' : 'season', 'hitting', 'P', pitcher?.id)],
    ['directions', url(batter.id, 'sprayChart', 'hitting', 'R')],
    ['career', url(batter.id, 'career', 'hitting', 'R')],
    ...(pitcher ? [['pitching', url(pitcher.id, 'season,career', 'pitching', 'R')], ['versusDirections', url(batter.id, 'sprayChart', 'hitting', 'R', pitcher.id)]] as [string, string][] : []),
  ]
  const results = await Promise.allSettled(tasks.map(([, request]) => get(request)))
  const data: Record<string, StatsResponse> = {}, errors: string[] = []
  results.forEach((r, i) => { if (r.status === 'fulfilled') data[tasks[i][0]] = r.value; else errors.push(tasks[i][0]) })
  if (!Object.keys(data).length) throw new Error('MLB statistics are temporarily unavailable')
  return { batter, pitcher, season, fetchedAt: new Date().toISOString(), errors,
    regular: battingStats(totalStat(data.regular ?? {}, 'season')),
    postseason: battingStats(totalStat(data.postseason ?? {}, 'season')),
    versus: pitcher ? battingStats(totalStat(data.regular ?? {}, 'vsPlayerTotal', pitcher.id)) : null,
    versusPostseason: pitcher ? battingStats(totalStat(data.postseason ?? {}, 'vsPlayerTotal', pitcher.id)) : null,
    pitching: pitchingStats(totalStat(data.pitching ?? {}, 'season')),
    pitchingCareer: pitchingStats(totalStat(data.pitching ?? {}, 'career')),
    career: battingStats(totalStat(data.career ?? {}, 'career')),
    directions: directionShares(data.directions ?? {}), versusDirections: directionShares(data.versusDirections ?? {}) }
}

export function averageFromLine(line: string): string {
  const match = /^(\d+)[-–](\d+)$/.exec(line)
  return match ? rate(Number(match[1]), Number(match[2])) ?? '—' : '—'
}
export function historyDrag(dy: number, dx: number): 'open' | 'close' | null {
  return Math.abs(dy) >= 24 && Math.abs(dy) > Math.abs(dx) ? dy > 0 ? 'open' : 'close' : null
}
