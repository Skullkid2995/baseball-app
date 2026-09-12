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
      supabase.from('app_users').select('id, email, display_name, role, player_id, active, created_at').ilike('email', userEmail).maybeSingle(),
      supabase.from('role_permissions').select('role, feature, can_view, can_edit'),
    ])
    setAppUser((userRes.data as AppUser | null) ?? null)
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
      perms,
      canView: (feature) => can(role, perms, feature, 'view'),
      canEdit: (feature) => can(role, perms, feature, 'edit'),
      refresh: load,
    }
  }, [loading, email, appUser, perms, load])

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  if (ctx === undefined) throw new Error('usePermissions must be used within a PermissionsProvider')
  return ctx
}
