import type { SupabaseClient } from '@supabase/supabase-js'
import { isAllowedEmail } from '@/lib/auth'

/**
 * May this Google account use the app?
 * Owner accounts (lib/auth.ts) always can; everyone else needs an active row in
 * app_users, which super admins manage under Settings.
 */
export async function isAuthorizedEmail(supabase: SupabaseClient, email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  if (isAllowedEmail(email)) return true
  const { data, error } = await supabase
    .from('app_users')
    .select('id, active')
    .ilike('email', email)
    .maybeSingle()
  if (error) {
    console.error('app_users lookup failed:', error.message)
    return false
  }
  return !!data?.active
}
