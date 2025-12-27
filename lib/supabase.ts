// This file provides backward compatibility for components that use the old supabase client
// For new client-side code, use @/lib/supabase-browser instead
import { createClient as createBrowserClient } from '@/lib/supabase-browser'

// Lazy initialization to prevent SSR issues and "Failed to fetch" errors
// The client is only created when first accessed in the browser
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

function getSupabaseClient() {
  // Only create client in browser environment
  // This prevents "Failed to fetch" errors during SSR
  if (typeof window === 'undefined') {
    // During SSR, we can't create a browser client
    // Components should use this only in 'use client' components
    throw new Error(
      'Supabase browser client cannot be used during SSR. ' +
      'Make sure you are using this in a client component (with "use client" directive). ' +
      'For server components, use @/lib/supabase-server instead.'
    )
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient()
  }
  
  return supabaseInstance
}

// Export a getter function that lazily creates the client
// This ensures the client is only created in browser context
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    const client = getSupabaseClient()
    const value = client[prop as keyof typeof client]
    // Bind functions to maintain correct 'this' context
    return typeof value === 'function' ? value.bind(client) : value
  }
})
