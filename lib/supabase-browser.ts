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

  // Check if user is using a publishable key instead of anon key
  const key = env.supabase.anonKey
  if (key.startsWith('sb_publishable_')) {
    console.warn(
      '⚠️  You are using a publishable key (sb_publishable_...). ' +
      'For Next.js web apps, you should use the anon key (JWT format starting with eyJ...). ' +
      'Publishable keys are for mobile apps and may cause auth issues. ' +
      'Get your anon key from: Supabase Dashboard → Settings → API → Project API keys → anon/public'
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

