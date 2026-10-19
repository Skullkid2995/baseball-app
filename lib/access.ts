import type { SupabaseClient } from '@supabase/supabase-js'
import { isAllowedEmail } from '@/lib/auth'

/**
 * May this Google account use the app?
 * Owner accounts (lib/auth.ts) always can; everyone else needs an active row in
 * app_users, which super admins manage under Settings.
 */
export type AccessStatus = 'authorized' | 'unauthorized' | 'unavailable'

export async function getAccessStatus(supabase: SupabaseClient, email: string | null | undefined): Promise<AccessStatus> {
  if (!email) return 'unauthorized'
  if (isAllowedEmail(email)) return 'authorized'
  const { data, error } = await supabase
    .from('app_users')
    .select('id, active')
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .maybeSingle()
  if (error) {
    console.error('app_users lookup failed:', error.message)
    return 'unavailable'
  }
  return data?.active ? 'authorized' : 'unauthorized'
}

export async function isAuthorizedEmail(supabase: SupabaseClient, email: string | null | undefined): Promise<boolean> {
  return (await getAccessStatus(supabase, email)) === 'authorized'
}
