// Environment configuration for Supabase
export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uzbupbtrmbmmmkztmrtl.supabase.co',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6YnVwYnRybWJtbW1renRtcnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNjUyMjAsImV4cCI6MjA2NjY0MTIyMH0.rCR1cmQ4itYa7S0PVY9PKdOuO57jJ4PAJO-7w53L50Y',
    // Expo/React Native compatibility
    expoUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uzbupbtrmbmmmkztmrtl.supabase.co',
    expoKey: process.env.EXPO_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6YnVwYnRybWJtbW1renRtcnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNjUyMjAsImV4cCI6MjA2NjY0MTIyMH0.rCR1cmQ4itYa7S0PVY9PKdOuO57jJ4PAJO-7w53L50Y',
  }
} as const
