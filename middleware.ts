import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'
import { getAccessStatus } from '@/lib/access'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // Recovery and public pages must remain reachable when authentication is down.
  // The OAuth callback performs its own session exchange and access check.
  if (pathname === '/login' || pathname === '/auth/callback' || pathname === '/write' || pathname.startsWith('/write/')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  const controller = new AbortController()

  const supabase = createServerClient(
    env.supabase.url,
    env.supabase.anonKey,
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const redirectToLogin = (error?: string) => {
    const redirect = NextResponse.redirect(new URL(error ? `/login?error=${error}` : '/login', request.url))
    // Keep refreshed/deleted session cookies when redirecting as well.
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    return redirect
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // One deadline covers session refresh and the access lookup, including SDK
    // retries. Fail closed, but show a reachable retry page before Vercel's 504.
    const unavailable = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('Authentication check timed out'))
      }, 8000)
    })
    return await Promise.race([
      (async () => {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error && error.name !== 'AuthSessionMissingError') {
          return redirectToLogin('service_unavailable')
        }
        if (!user) return redirectToLogin()

        const access = await getAccessStatus(supabase, user.email)
        if (access === 'unavailable') return redirectToLogin('service_unavailable')
        if (access === 'unauthorized') return redirectToLogin('unauthorized')
        return response
      })(),
      unavailable,
    ])
  } catch {
    return redirectToLogin('service_unavailable')
  } finally {
    clearTimeout(timer)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
