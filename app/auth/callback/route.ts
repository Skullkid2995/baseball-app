import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

const ALLOWED_EMAIL = 'jesus.contreras@group-u.com'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session?.user) {
      // Check if email matches allowed email
      if (data.session.user.email === ALLOWED_EMAIL) {
        // Redirect to home page
        return NextResponse.redirect(`${origin}/`)
      } else {
        // Email doesn't match - sign out and redirect to login with error
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=unauthorized`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

