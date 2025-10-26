'use client'

import { useState } from 'react'
import TeamsList from '@/components/TeamsList'
import PlayersList from '@/components/PlayersList'
import GamesList from '@/components/GamesList'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'teams' | 'players' | 'games'>('teams')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-green-900 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">⚾ Baseball Management System</h1>
          <p className="text-blue-200 text-lg">Manage teams, players, and live games</p>
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