'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/contexts/LanguageContext'

const ALLOWED_EMAILS = ['jesus.contreras@group-u.com', 'skullkid2995@gmail.com']

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Check if email matches
        if (session.user.email && ALLOWED_EMAILS.includes(session.user.email)) {
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (session.user.email && ALLOWED_EMAILS.includes(session.user.email)) {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-green-900 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">⚾ {t.appTitle}</h1>
          <p className="text-gray-600">{t.signInToAccess}</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
                <span>{t.signingIn}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                <span>{t.signInWithGoogle}</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>{t.onlyAuthorizedUsers}</p>
        </div>
      </div>
    </div>
  )
}

