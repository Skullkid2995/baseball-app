import { playerOuts } from './plays'

type TeamSide = 'home' | 'opponent'
interface BattingRow {
  player_id: string
  inning: number
  at_bat_number: number
  result: string
  notation?: string
  base_runner_outs?: { first: boolean; second: boolean; third: boolean; home: boolean }
  team_side?: TeamSide
  created_at?: string
}
export interface AtBatCell {
  playerId: string
  inning: number
  appearance: number
  teamSide: TeamSide
}

/** The one unsaved appearance that is next in this side's batting order. */
export function nextAtBat(lineup: { id: string }[], atBats: BattingRow[], teamSide: TeamSide): AtBatCell | null {
  if (!lineup.length) return null
  const rows = atBats.filter(ab => (ab.team_side || 'home') === teamSide)
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.at_bat_number - b.at_bat_number)
  const last = rows[rows.length - 1]
  if (!last) return { playerId: lineup[0].id, inning: 1, appearance: 1, teamSide }
  const inningOuts = rows.filter(ab => ab.inning === last.inning).reduce((n, ab) => n + playerOuts(ab), 0)
  const nextIndex = (lineup.findIndex(p => p.id === last.player_id) + 1) % lineup.length
  const playerId = lineup[nextIndex].id
  const inning = last.inning + (inningOuts >= 3 ? 1 : 0)
  const appearance = 1 + rows.filter(ab => ab.player_id === playerId && ab.inning === inning).length
  return { playerId, inning, appearance, teamSide }
}

export function canScoreCell(cell: AtBatCell, current: AtBatCell | null, locked: boolean): boolean {
  return !locked && current !== null && cell.playerId === current.playerId && cell.inning === current.inning &&
    cell.appearance === current.appearance && cell.teamSide === current.teamSide
}
