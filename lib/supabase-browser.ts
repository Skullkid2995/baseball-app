import { createBrowserClient } from '@supabase/ssr'
import { env } from './env'

export function createClient() {
  // Validate environment variables
  if (!env.supabase.url || !env.supabase.anonKey) {
    throw new Error(
      'Supabase URL and anon key must be set. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    )
  }

  // Both key formats work with @supabase/supabase-js >= 2.5x:
  //   - legacy anon key: JWT starting with 'eyJ...'
  //   - new publishable key: 'sb_publishable_...' (default for projects created since 2025)
  // Any other prefix is almost certainly a copy/paste mistake (e.g. the secret/service key).
  const key = env.supabase.anonKey
  if (!key.startsWith('eyJ') && !key.startsWith('sb_publishable_')) {
    console.warn(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like an anon/publishable key. ' +
      'Use the anon (eyJ...) or publishable (sb_publishable_...) key from ' +
      'Supabase Dashboard -> Project Settings -> API Keys. Never put the secret/service_role key here.'
    )
  }

  try {
    return createBrowserClient(
      env.supabase.url,
      env.supabase.anonKey,
      {
        // Configure client options to handle errors more gracefully
        auth: {
          // Auto-refresh tokens, but handle errors gracefully
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    )
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    throw error
  }
}

