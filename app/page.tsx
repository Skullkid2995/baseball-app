'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User, Session } from '@supabase/supabase-js'
import TeamsList from '@/components/TeamsList'
import PlayersList from '@/components/PlayersList'
import GamesList from '@/components/GamesList'
import { createClient } from '@/lib/supabase-browser'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'teams' | 'players' | 'games'>('teams')
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const supabase = createClient()

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
        <header className="text-center mb-12 relative">
          <h1 className="text-4xl font-bold text-white mb-4">⚾ Baseball Management System</h1>
          <p className="text-blue-200 text-lg">Manage teams, players, and live games</p>
          {user && (
            <div className="absolute top-0 right-0 flex items-center gap-3">
              <span className="text-blue-200 text-sm">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          )}
        </header>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-xl mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('teams')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'teams'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Teams
              </button>
              <button
                onClick={() => setActiveTab('players')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'players'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Players
              </button>
              <button
                onClick={() => setActiveTab('games')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'games'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Games
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'teams' && <TeamsList />}
            {activeTab === 'players' && <PlayersList />}
            {activeTab === 'games' && <GamesList />}
          </div>
        </div>
      </div>
    </div>
  )
}