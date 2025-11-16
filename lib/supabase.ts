// This file provides backward compatibility for components that use the old supabase client
// For new client-side code, use @/lib/supabase-browser instead
import { createClient } from '@/lib/supabase-browser'

export const supabase = createClient()
