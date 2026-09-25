export type ChangeKind = 'pinch_hitter' | 'pinch_runner' | 'defensive' | 'position'
export interface LineupPlayer {
  id: string; first_name: string; last_name: string; jersey_number: number | null; positions?: string[] | null
}
export interface PlayerChange {
  id: string; team_side: 'home' | 'opponent'; kind: ChangeKind
  out_player_id: string; in_player_id: string; position: string
  runner_at_bat_id: string | null; incoming: LineupPlayer
}

/** Keep a slot's earlier batters attached to its current player, without changing recorded at-bats. */
export function changedLineup(initial: LineupPlayer[], changes: PlayerChange[], side: 'home' | 'opponent') {
  const slots = initial.map(p => ({ ...p, positions: p.positions || [], members: [p.id] }))
  for (const change of changes.filter(c => c.team_side === side)) {
    const slot = slots.find(p => p.id === change.out_player_id)
    if (!slot) continue
    if (change.kind === 'position') {
      const other = slots.find(p => p.id !== slot.id && p.positions[0] === change.position)
      if (other) other.positions = slot.positions
      slot.positions = [change.position]
    } else {
      const members = [...slot.members, change.in_player_id]
      Object.assign(slot, change.incoming, { positions: [change.position], members })
    }
  }
  return slots
}

export function slotRows<T extends { player_id: string; team_side?: 'home' | 'opponent' }>(rows: T[], slots: { id: string; members: string[] }[], side: 'home' | 'opponent'): T[] {
  return rows.map(row => (row.team_side || 'home') === side
    ? { ...row, player_id: slots.find(s => s.members.includes(row.player_id))?.id || row.player_id }
    : row)
}

export function runnerIdentity(atBatId: string, batterId: string, changes: PlayerChange[]) {
  return changes.filter(c => c.kind === 'pinch_runner' && c.runner_at_bat_id === atBatId).at(-1)?.in_player_id || batterId
}
