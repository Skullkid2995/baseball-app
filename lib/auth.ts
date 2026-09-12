// Single source of truth for who may sign in.
// Used by middleware.ts (route protection), app/auth/callback/route.ts (OAuth exchange)
// and components/Login.tsx (client-side check).
export const ALLOWED_EMAILS: readonly string[] = [
  'jesus.contreras@group-u.com',
  'skullkid2995@gmail.com',
]

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && ALLOWED_EMAILS.includes(email.toLowerCase())
}
