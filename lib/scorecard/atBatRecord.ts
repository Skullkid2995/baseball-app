import type { AtBatCell } from './battingOrder'

/** Every insert must identify its team; the database's legacy default is home. */
export function atBatIdentity(gameId: string, cell: AtBatCell) {
  return { game_id: gameId, player_id: cell.playerId, inning: cell.inning, at_bat_number: cell.appearance, team_side: cell.teamSide }
}
