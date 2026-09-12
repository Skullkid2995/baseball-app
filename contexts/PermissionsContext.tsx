'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { can, isBootstrapAdmin, type AppUser, type ConfigurableRole, type PermissionMap, type Role } from '@/lib/permissions'

interface PermissionsState {
  loading: boolean
  email: string | null
  appUser: AppUser | null
  role: Role | null
  isSuperAdmin: boolean
  /** Team of a coach / player (own, or inherited from the linked player) */
  teamId: string | null
  /** League of a president / VP / treasurer (own, or inherited from the team) */
  leagueId: string | null
  perms: PermissionMap
  canView: (feature: string) => boolean
  canEdit: (feature: string) => boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsState | undefined>(undefined)

/**
 * Loads the signed-in user's role (app_users) and the permission matrix
 * (role_permissions) once, and answers canView / canEdit for every feature.
 * Super admins (owner accounts or role super_admin) can do everything.
 */
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [perms, setPerms] = useState<PermissionMap>({})
  const [teamId, setTeamId] = useState<string | null>(null)
  const [leagueId, setLeagueId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    const userEmail = data.user?.email ?? null
    setEmail(userEmail)
    if (!userEmail) {
      setAppUser(null)
      setPerms({})
      setLoading(false)
      return
    }
    const [userRes, permRes] = await Promise.all([
      supabase.from('app_users').select('id, email, display_name, role, player_id, active, team_id, league_id, created_at').ilike('email', userEmail).maybeSingle(),
      supabase.from('role_permissions').select('role, feature, can_view, can_edit'),
    ])
    const me = (userRes.data as AppUser | null) ?? null
    setAppUser(me)
    // Where the user belongs: own team, else the linked player's team; own league, else the team's league
    let tId = me?.team_id ?? null
    let lId = me?.league_id ?? null
    if (!tId && me?.player_id) {
      const { data: pl } = await supabase.from('players').select('team_id').eq('id', me.player_id).maybeSingle()
      tId = (pl?.team_id as string | null) ?? null
    }
    if (!lId && tId) {
      const { data: tm } = await supabase.from('teams').select('league_id').eq('id', tId).maybeSingle()
      lId = (tm?.league_id as string | null) ?? null
    }
    setTeamId(tId)
    setLeagueId(lId)
    const map: PermissionMap = {}
    for (const row of permRes.data ?? []) {
      const role = row.role as ConfigurableRole
      if (!map[role]) map[role] = {}
      map[role]![row.feature] = { view: !!row.can_view, edit: !!row.can_edit }
    }
    setPerms(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') load()
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const value = useMemo<PermissionsState>(() => {
    const isSuperAdmin = isBootstrapAdmin(email) || (!!appUser?.active && appUser.role === 'super_admin')
    const role: Role | null = isSuperAdmin ? 'super_admin' : appUser?.active ? appUser.role : null
    return {
      loading,
      email,
      appUser,
      role,
      isSuperAdmin,
      teamId,
      leagueId,
      perms,
      canView: (feature) => can(role, perms, feature, 'view'),
      canEdit: (feature) => can(role, perms, feature, 'edit'),
      refresh: load,
    }
  }, [loading, email, appUser, perms, teamId, leagueId, load])

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  if (ctx === undefined) throw new Error('usePermissions must be used within a PermissionsProvider')
  return ctx
}
