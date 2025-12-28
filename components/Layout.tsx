'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { User, Session } from '@supabase/supabase-js'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { createClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/contexts/LanguageContext'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { t } = useLanguage()

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then((response) => {
      if (response.data.user) {
        setUser(response.data.user)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-green-900 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          {/* User info, language switcher, and logout at top right */}
          {user && (
            <div className="flex justify-end items-center gap-3 mb-6">
              <LanguageSwitcher />
              <span className="text-blue-200 text-sm">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                {t.logout}
              </button>
            </div>
          )}
          {/* Title section */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">⚾ {t.appTitle}</h1>
            <p className="text-blue-200 text-lg">{t.appSubtitle}</p>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-xl mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <Link
                href="/teams"
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  pathname === '/teams'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.teams}
              </Link>
              <Link
                href="/games"
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  pathname === '/games'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.games}
              </Link>
            </nav>
          </div>

          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

