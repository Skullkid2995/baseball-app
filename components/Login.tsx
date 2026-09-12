'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/contexts/LanguageContext'
import { isAuthorizedEmail } from '@/lib/access'
import BaseballMark from '@/components/BaseballMark'
import { Alert, Button, Card } from '@/components/ui'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { t } = useLanguage()
  
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'unauthorized') {
      setError(t.accessDenied)
    } else if (errorParam === 'auth_failed') {
      setError(t.authFailed)
    }
  }, [searchParams, t])

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Check if email matches
        if (await isAuthorizedEmail(supabase, session.user.email)) {
          window.location.href = '/'
        } else {
          // User is logged in but email doesn't match
          supabase.auth.signOut()
        }
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        if (await isAuthorizedEmail(supabase, session.user.email)) {
          window.location.href = '/'
        } else {
          setError(t.accessDenied)
          supabase.auth.signOut()
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signInError) {
        // Check for specific error about provider not being enabled
        const errorMsg = signInError.message || ''
        const errorCode = (signInError as { error_code?: string; code?: string | number }).error_code || (signInError as { error_code?: string; code?: string | number }).code || ''
        
        if (errorCode === 'validation_failed' || errorCode === 400 || 
            errorMsg.includes('provider is not enabled') || 
            errorMsg.includes('Unsupported provider')) {
          setError('Google OAuth is not enabled in Supabase. Please enable it in your Supabase Dashboard under Authentication > Providers > Google. See AUTH_SETUP.md for detailed instructions.')
        } else {
          setError(errorMsg || t.authFailed)
        }
        setLoading(false)
      }
      // User will be redirected to Google, then back to callback
    } catch (err: unknown) {
      // Handle provider not enabled error from catch block
      const errorObj = err as { error_code?: string; code?: string | number; msg?: string; message?: string } | null
      const errorCode = errorObj?.error_code || errorObj?.code || ''
      const errorMsg = errorObj?.msg || errorObj?.message || ''
      
      if (errorCode === 'validation_failed' || errorCode === 400 || 
          errorMsg.includes('provider is not enabled') || 
          errorMsg.includes('Unsupported provider')) {
        setError('Google OAuth is not enabled in Supabase. Please enable it in your Supabase Dashboard under Authentication > Providers > Google. See AUTH_SETUP.md for detailed instructions.')
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
      setLoading(false)
    }
  }
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(29,78,216,0.14),transparent_60%)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-blue-900/20">
            <BaseballMark className="size-8" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{t.appTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.signInToAccess}</p>
        </div>

        <Card className="p-6">
          {error && (
            <Alert variant="error" className="mb-5">
              {error}
            </Alert>
          )}

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleGoogleLogin}
            loading={loading}
          >
            {!loading && (
              <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span>{loading ? t.signingIn : t.signInWithGoogle}</span>
          </Button>

          <p className="mt-5 text-center text-xs text-muted-foreground">{t.onlyAuthorizedUsers}</p>
        </Card>
      </div>
    </div>
  )
}
