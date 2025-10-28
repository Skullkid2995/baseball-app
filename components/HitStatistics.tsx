'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AtBat {
  id: string
  player_id: string
  notation: string
  result: string
  field_area: string
  field_zone: string
  hit_distance: string
  hit_angle: string
  runs_scored: number
  rbi?: number
  base_runners: Record<string, unknown>
  players: {
    first_name: string
    last_name: string
    jersey_number: number
  }
}

interface HitStats {
  totalAtBats: number
  hits: number
  doubles: number
  triples: number
  homeRuns: number
  singles: number
  battingAverage: number
  sluggingPercentage: number
  totalRBIs: number
  fieldDistribution: { [key: string]: number }
  distanceDistribution: { [key: string]: number }
  angleDistribution: { [key: string]: number }
  zoneDistribution: { [key: string]: number }
}

export default function HitStatistics({ gameId, onClose }: { gameId: string, onClose: () => void }) {
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all')
  const [stats, setStats] = useState<HitStats | null>(null)

  useEffect(() => {
    fetchAtBats()
  }, [gameId])

  useEffect(() => {
    if (atBats.length > 0) {
      calculateStats()
    }
  }, [atBats, selectedPlayer])

  const fetchAtBats = async () => {
    try {
      const { data, error } = await supabase
        .from('at_bats')
        .select(`
          *,
          players (
            first_name,
            last_name,
            jersey_number
          )
        `)
        .eq('game_id', gameId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching at-bats:', error)
        return
      }

      setAtBats(data || [])
    } catch (err) {
      console.error('Failed to fetch at-bats:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const filteredAtBats = selectedPlayer === 'all' 
      ? atBats 
      : atBats.filter(ab => ab.player_id === selectedPlayer)

    const totalAtBats = filteredAtBats.length
    const hits = filteredAtBats.filter(ab => 
      ['single', 'double', 'triple', 'home_run'].includes(ab.result)
    )
    
    const singles = hits.filter(ab => ab.result === 'single').length
    const doubles = hits.filter(ab => ab.result === 'double').length
    const triples = hits.filter(ab => ab.result === 'triple').length
    const homeRuns = hits.filter(ab => ab.result === 'home_run').length
    const totalHits = hits.length
    const totalRBIs = filteredAtBats.reduce((sum, ab) => sum + (typeof ab.rbi === 'number' ? ab.rbi : 0), 0)

    const battingAverage = totalAtBats > 0 ? (totalHits / totalAtBats) : 0
    const sluggingPercentage = totalAtBats > 0 
      ? (singles + (doubles * 2) + (triples * 3) + (homeRuns * 4)) / totalAtBats 
      : 0

    // Field distribution
    const fieldDistribution: { [key: string]: number } = {}
    const distanceDistribution: { [key: string]: number } = {}
    const angleDistribution: { [key: string]: number } = {}
    const zoneDistribution: { [key: string]: number } = {}

    hits.forEach(hit => {
      // Field area distribution
      if (hit.field_area) {
        fieldDistribution[hit.field_area] = (fieldDistribution[hit.field_area] || 0) + 1
      }
      
      // Distance distribution
      if (hit.hit_distance) {
        distanceDistribution[hit.hit_distance] = (distanceDistribution[hit.hit_distance] || 0) + 1
      }
      
      // Angle distribution
      if (hit.hit_angle) {
        angleDistribution[hit.hit_angle] = (angleDistribution[hit.hit_angle] || 0) + 1
      }
      
      // Zone distribution
      if (hit.field_zone) {
        zoneDistribution[hit.field_zone] = (zoneDistribution[hit.field_zone] || 0) + 1
      }
    })

    setStats({
      totalAtBats,
      hits: totalHits,
      doubles,
      triples,
      homeRuns,
      singles,
      battingAverage,
      sluggingPercentage,
      totalRBIs,
      fieldDistribution,
      distanceDistribution,
      angleDistribution,
      zoneDistribution
    })
  }

  const getUniquePlayers = () => {
    const players = atBats.map(ab => ({
      id: ab.player_id,
      name: `${ab.players.first_name} ${ab.players.last_name}`,
      jersey: ab.players.jersey_number
    }))
    
    return players.filter((player, index, self) => 
      index === self.findIndex(p => p.id === player.id)
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-gray-500">
        No statistics available
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Hit Statistics & Analysis</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
        
        {/* Player Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Player:
          </label>
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Players</option>
            {getUniquePlayers().map(player => (
              <option key={player.id} value={player.id}>
                #{player.jersey} {player.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Basic Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.totalAtBats}</div>
          <div className="text-sm text-blue-800">Total At-Bats</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.hits}</div>
          <div className="text-sm text-green-800">Hits</div>
        </div>
        <div className="bg-pink-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-pink-600">{stats.totalRBIs}</div>
          <div className="text-sm text-pink-800">RBIs</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {stats.battingAverage.toFixed(3)}
          </div>
          <div className="text-sm text-yellow-800">Batting Average</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {stats.sluggingPercentage.toFixed(3)}
          </div>
          <div className="text-sm text-purple-800">Slugging %</div>
        </div>
      </div>

      {/* Hit Types Breakdown */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hit Types</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <div className="text-xl font-bold text-gray-700">{stats.singles}</div>
            <div className="text-sm text-gray-600">Singles</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <div className="text-xl font-bold text-orange-600">{stats.doubles}</div>
            <div className="text-sm text-orange-800">Doubles</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <div className="text-xl font-bold text-red-600">{stats.triples}</div>
            <div className="text-sm text-red-800">Triples</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg text-center">
            <div className="text-xl font-bold text-indigo-600">{stats.homeRuns}</div>
            <div className="text-sm text-indigo-800">Home Runs</div>
          </div>
        </div>
      </div>

      {/* Field Distribution */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Where Hits Land</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Field Areas</h4>
            <div className="space-y-2">
              {Object.entries(stats.fieldDistribution).map(([area, count]) => (
                <div key={area} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">
                    {area.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <div className="flex items-center">
                    <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${(count / stats.hits) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">Hit Distance</h4>
            <div className="space-y-2">
              {Object.entries(stats.distanceDistribution).map(([distance, count]) => (
                <div key={distance} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">{distance}</span>
                  <div className="flex items-center">
                    <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${(count / stats.hits) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hit Angle Analysis */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hit Direction</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Hit Angles</h4>
            <div className="space-y-2">
              {Object.entries(stats.angleDistribution).map(([angle, count]) => (
                <div key={angle} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">{angle}</span>
                  <div className="flex items-center">
                    <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full" 
                        style={{ width: `${(count / stats.hits) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">Specific Zones</h4>
            <div className="space-y-2">
              {Object.entries(stats.zoneDistribution).map(([zone, count]) => (
                <div key={zone} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">
                    {zone.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <div className="flex items-center">
                    <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full" 
                        style={{ width: `${(count / stats.hits) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent At-Bats Log */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent At-Bats</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Field Area
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Angle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RBIs
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {atBats.slice(-10).map((atBat) => (
                  <tr key={atBat.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{atBat.players.jersey_number} {atBat.players.first_name} {atBat.players.last_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        ['single', 'double', 'triple', 'home_run'].includes(atBat.result)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {atBat.notation || atBat.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {atBat.field_area ? atBat.field_area.replace(/_/g, ' ').toLowerCase() : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {atBat.hit_distance || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {atBat.hit_angle || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {typeof atBat.rbi === 'number' ? atBat.rbi : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
