/**
 * Which games a user "owns" for the quick views, by hierarchy:
 *   super admin        -> every league
 *   president/VP/treas -> their league
 *   coach / player     -> their team (their league is available as informative)
 * Anything unset falls back one level up so nobody sees an empty screen.
 */
import type { Role } from '@/lib/permissions'

export type ScopeLevel = 'team' | 'league' | 'all'

export interface ScopeUser {
  role: Role | null
  isSuperAdmin: boolean
  teamId: string | null
  leagueId: string | null
}

export interface ScopedGame {
  id: string
  opponent: string
  team_id?: string | null
  opponent_team_id?: string | null
  league_id?: string | null
}

export interface ScopedTeam {
  id: string
  name: string
  league_id?: string | null
}

/** Scopes the user may switch between, most specific first */
export function allowedScopes(u: ScopeUser): ScopeLevel[] {
  if (u.isSuperAdmin || u.role === 'super_admin') return ['all']
  if (u.role === 'board') return u.leagueId ? ['league'] : ['all']
  // coach / player
  const out: ScopeLevel[] = []
  if (u.teamId) out.push('team')
  if (u.leagueId) out.push('league')
  if (out.length === 0) out.push('all')
  return out
}

export function defaultScope(u: ScopeUser): ScopeLevel {
  return allowedScopes(u)[0]
}

/** Is this game inside the scope? Games belong to their team (and its opponent's team when we know it). */
export function gameInScope(game: ScopedGame, level: ScopeLevel, u: ScopeUser, teams: ScopedTeam[]): boolean {
  if (level === 'all') return true
  const byId = new Map(teams.map((t) => [t.id, t]))
  const ours = game.team_id ? byId.get(game.team_id) : undefined
  const theirs = (game.opponent_team_id ? byId.get(game.opponent_team_id) : undefined) ?? teams.find((t) => t.name.toLowerCase() === game.opponent.toLowerCase())
  if (level === 'team') {
    if (!u.teamId) return true
    return ours?.id === u.teamId || theirs?.id === u.teamId
  }
  // league
  if (!u.leagueId) return true
  if (game.league_id) return game.league_id === u.leagueId
  return ours?.league_id === u.leagueId || theirs?.league_id === u.leagueId
}
