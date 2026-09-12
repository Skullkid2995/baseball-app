// Supabase configuration. Values come ONLY from environment variables
// (.env.local locally, Project Settings -> Environment Variables on Vercel).
// There are deliberately no hard-coded fallbacks: a missing variable fails fast
// instead of silently pointing the app at the wrong project.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env.local and fill in the values from ' +
    'Supabase Dashboard -> Project Settings -> API Keys.'
  )
}

export const env = {
  supabase: { url, anonKey },
} as const
