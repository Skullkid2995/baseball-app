'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { BarChart3, X } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, FormField, LoadingState, Select } from '@/components/ui'

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
    team_id: string | null
  }
}

interface Game {
  id: string
  team_id: string | null
  opponent: string
}

interface Team {
  id: string
  name: string
  city: string
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
  totalStrikeouts: number
  fieldDistribution: { [key: string]: number }
  distanceDistribution: { [key: string]: number }
  angleDistribution: { [key: string]: number }
  zoneDistribution: { [key: string]: number }
}

export default function HitStatistics({ gameId, onClose }: { gameId: string, onClose: () => void }) {
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('our_team') // Default to Dodgers
  const [game, setGame] = useState<Game | null>(null)
  const [ourTeam, setOurTeam] = useState<Team | null>(null)
  const [stats, setStats] = useState<HitStats | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    // Reset filters when game changes
    setSelectedTeam('our_team') // Default to Dodgers for all games
    setSelectedPlayer('all')
    setGame(null)
    setOurTeam(null)
    setStats(null)
    setAtBats([])
    setLoading(true)
    
    fetchGame()
    fetchAtBats()
  }, [gameId])

  useEffect(() => {
    if (atBats.length > 0 && game) {
      calculateStats()
    } else if (atBats.length > 0) {
      // If no game data yet but we have at-bats, still calculate (will show all teams)
      calculateStats()
    }
  }, [atBats, selectedPlayer, selectedTeam, game])

  const fetchGame = async () => {
    try {
      // Try to fetch game with team_id first
      const { data, error } = await supabase
        .from('games')
        .select('id, opponent, team_id')
        .eq('id', gameId)
        .single()

      if (error) {
        // Check if it's a column error or empty error (might indicate column doesn't exist)
        const isColumnError = error.code === 'PGRST116' || 
                             error.message?.includes('column') || 
                             error.message?.includes('team_id') ||
                             (typeof error === 'object' && Object.keys(error).length === 0)

        if (isColumnError) {
          // Try without team_id column
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('games')
            .select('id, opponent')
            .eq('id', gameId)
            .single()

          if (fallbackError) {
            console.error('Error fetching game (fallback):', fallbackError)
            return
          }

          // Set game with team_id as null if column doesn't exist
          setGame({ ...fallbackData, team_id: null } as Game)
          return
        }
        
        // Other types of errors
        console.error('Error fetching game:', error)
        // Still try fallback in case it helps
        const { data: fallbackData } = await supabase
          .from('games')
          .select('id, opponent')
          .eq('id', gameId)
          .single()
        
        if (fallbackData) {
          setGame({ ...fallbackData, team_id: null } as Game)
        }
        return
      }

      // Success - ensure team_id is set (may be null if column exists but is null)
      const gameData = {
        id: data.id,
        opponent: data.opponent,
        team_id: data.team_id || null
      } as Game
      setGame(gameData)

      // Fetch team name if team_id exists
      if (gameData.team_id) {
        fetchTeamName(gameData.team_id)
      }
    } catch (err) {
      console.error('Failed to fetch game:', err)
      // Last resort fallback
      try {
        const { data: fallbackData } = await supabase
          .from('games')
          .select('id, opponent')
          .eq('id', gameId)
          .single()
        
        if (fallbackData) {
          setGame({ ...fallbackData, team_id: null } as Game)
        }
      } catch (fallbackErr) {
        console.error('Fallback fetch also failed:', fallbackErr)
      }
    }
  }

  const fetchTeamName = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, city')
        .eq('id', teamId)
        .single()

      if (error) {
        console.error('Error fetching team:', error)
        return
      }

      setOurTeam(data)
    } catch (err) {
      console.error('Failed to fetch team:', err)
    }
  }

  const fetchAtBats = async () => {
    try {
      const { data, error } = await supabase
        .from('at_bats')
        .select(`
          *,
          players (
            first_name,
            last_name,
            jersey_number,
            team_id
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
    let filteredAtBats = atBats

    // Filter by team - Dodgers is default
    if (game) {
      if (selectedTeam === 'our_team' && game.team_id) {
        // Filter for Dodgers players (player team_id matches game team_id)
        filteredAtBats = filteredAtBats.filter(ab => ab.players.team_id === game.team_id)
      } else if (selectedTeam === 'opponent') {
        // Filter for opponent players (player team_id doesn't match game team_id, or is null)
        filteredAtBats = filteredAtBats.filter(ab => 
          game.team_id ? ab.players.team_id !== game.team_id : true
        )
      } else if (selectedTeam === 'our_team' && !game.team_id) {
        // If no team_id, show all (Dodgers filter will be based on player team_id)
        // For now, we'll show all players if team_id is not available
      }
    }

    // Then filter by player
    if (selectedPlayer !== 'all') {
      filteredAtBats = filteredAtBats.filter(ab => ab.player_id === selectedPlayer)
    }

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
    const totalStrikeouts = filteredAtBats.filter(ab => ab.result === 'strikeout' || ab.notation === 'K').length

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
      totalStrikeouts,
      fieldDistribution,
      distanceDistribution,
      angleDistribution,
      zoneDistribution
    })
  }

  const getUniquePlayers = () => {
    let filteredAtBats = atBats

    // Filter by team - Dodgers is default
    if (game) {
      if (selectedTeam === 'our_team' && game.team_id) {
        filteredAtBats = filteredAtBats.filter(ab => ab.players.team_id === game.team_id)
      } else if (selectedTeam === 'opponent') {
        filteredAtBats = filteredAtBats.filter(ab => 
          game.team_id ? ab.players.team_id !== game.team_id : true
        )
      }
    }

    const players = filteredAtBats.map(ab => ({
      id: ab.player_id,
      name: `${ab.players.first_name} ${ab.players.last_name}`,
      jersey: ab.players.jersey_number
    }))
    
    return players.filter((player, index, self) => 
      index === self.findIndex(p => p.id === player.id)
    )
  }

  if (loading) {
    return <LoadingState />
  }

  if (!stats) {
    return <EmptyState icon={<BarChart3 />} title={t.noStatisticsAvailable} />
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{t.hitStatistics}</h2>
          <Button variant="outline" onClick={onClose}>
            <X />
            {t.close}
          </Button>
        </div>

        {/* Team and Player Filters */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label={<>{t.filterByTeam}:</>}>
            <Select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value)
                setSelectedPlayer('all') // Reset player filter when team changes
              }}
            >
              <option value="our_team">Dodgers</option>
              <option value="opponent">
                {game?.opponent || t.opponent}
              </option>
            </Select>
          </FormField>
          <FormField label={<>{t.filterByPlayer}:</>}>
            <Select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
            >
              <option value="all">{t.allPlayers}</option>
              {getUniquePlayers().map(player => (
                <option key={player.id} value={player.id}>
                  #{player.jersey} {player.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      {/* Basic Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="text-2xl font-bold tabular-nums text-primary">{stats.totalAtBats}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.totalAtBats}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold tabular-nums text-emerald-600">{stats.hits}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.hits}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold tabular-nums text-pink-600">{stats.totalRBIs}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.rbis}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold tabular-nums text-red-600">{stats.totalStrikeouts}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.strikeouts}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold tabular-nums text-amber-600">
            {stats.battingAverage.toFixed(3)}
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.battingAverage}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold tabular-nums text-violet-600">
            {stats.sluggingPercentage.toFixed(3)}
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.sluggingPercent}</div>
        </Card>
      </div>

      {/* Hit Types Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t.hitTypes}</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="p-4 text-center">
            <div className="text-xl font-bold tabular-nums text-slate-700">{stats.singles}</div>
            <div className="text-sm text-muted-foreground">{t.singles}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xl font-bold tabular-nums text-orange-600">{stats.doubles}</div>
            <div className="text-sm text-muted-foreground">{t.doubles}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xl font-bold tabular-nums text-red-600">{stats.triples}</div>
            <div className="text-sm text-muted-foreground">{t.triples}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xl font-bold tabular-nums text-indigo-600">{stats.homeRuns}</div>
            <div className="text-sm text-muted-foreground">{t.homeRuns}</div>
          </Card>
        </div>
      </div>

      {/* Field Distribution */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t.whereHitsLand}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.fieldAreas}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stats.fieldDistribution).map(([area, count]) => (
                <div key={area} className="flex items-center justify-between gap-3">
                  <span className="text-sm capitalize text-slate-700">
                    {area.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(count / stats.hits) * 100}%` }}
                      ></div>
                    </div>
                    <span className="min-w-6 text-right text-sm font-semibold tabular-nums">{count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.hitDistance}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stats.distanceDistribution).map(([distance, count]) => (
                <div key={distance} className="flex items-center justify-between gap-3">
                  <span className="text-sm capitalize text-slate-700">{distance}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${(count / stats.hits) * 100}%` }}
                      ></div>
                    </div>
                    <span className="min-w-6 text-right text-sm font-semibold tabular-nums">{count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hit Angle Analysis */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t.hitDirection}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.hitAngles}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stats.angleDistribution).map(([angle, count]) => (
                <div key={angle} className="flex items-center justify-between gap-3">
                  <span className="text-sm capitalize text-slate-700">{angle}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-violet-500"
                        style={{ width: `${(count / stats.hits) * 100}%` }}
                      ></div>
                    </div>
                    <span className="min-w-6 text-right text-sm font-semibold tabular-nums">{count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.specificZones}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stats.zoneDistribution).map(([zone, count]) => (
                <div key={zone} className="flex items-center justify-between gap-3">
                  <span className="text-sm capitalize text-slate-700">
                    {zone.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-orange-500"
                        style={{ width: `${(count / stats.hits) * 100}%` }}
                      ></div>
                    </div>
                    <span className="min-w-6 text-right text-sm font-semibold tabular-nums">{count}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent At-Bats Log */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t.recentAtBats}</h3>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  {t.player}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t.result}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t.fieldArea}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t.distance}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t.angle}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t.rbis}
                </th>
              </tr>
            </thead>
            <tbody>
              {atBats.slice(-10).map((atBat) => (
                <tr key={atBat.id} className="border-t border-border hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    #{atBat.players.jersey_number} {atBat.players.first_name} {atBat.players.last_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={
                      ['single', 'double', 'triple', 'home_run'].includes(atBat.result)
                        ? 'success'
                        : 'danger'
                    }>
                      {atBat.notation || atBat.result}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {atBat.field_area ? atBat.field_area.replace(/_/g, ' ').toLowerCase() : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {atBat.hit_distance || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {atBat.hit_angle || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {typeof atBat.rbi === 'number' ? atBat.rbi : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
