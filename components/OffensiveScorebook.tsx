'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Player {
  id: string
  first_name: string
  last_name: string
  jersey_number: number
  positions: string[]
  batting_order?: number
  position?: string
}

interface AtBat {
  id: string
  player_id: string
  inning: number
  at_bat_number: number
  result: string
  rbi: number
  runs_scored: number
  stolen_bases: number
  players?: Player
}

interface Game {
  id: string
  opponent: string
  game_date: string
  our_score: number
  opponent_score: number
  innings_played: number
  game_status: string
}

const AT_BAT_RESULTS = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' },
  { value: 'home_run', label: 'Home Run' },
  { value: 'walk', label: 'Walk' },
  { value: 'strikeout', label: 'Strikeout' },
  { value: 'ground_out', label: 'Ground Out' },
  { value: 'fly_out', label: 'Fly Out' },
  { value: 'line_out', label: 'Line Out' },
  { value: 'pop_out', label: 'Pop Out' },
  { value: 'error', label: 'Error' },
  { value: 'hit_by_pitch', label: 'Hit by Pitch' },
  { value: 'sacrifice_fly', label: 'Sacrifice Fly' },
  { value: 'sacrifice_bunt', label: 'Sacrifice Bunt' }
]

export default function OffensiveScorebook({ game, onClose }: { game: Game, onClose: () => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [currentGame, setCurrentGame] = useState<Game>(game)
  const [currentInning, setCurrentInning] = useState(1)
  const [currentAtBat, setCurrentAtBat] = useState(1)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [atBatResult, setAtBatResult] = useState('')
  const [rbi, setRbi] = useState(0)
  const [runsScored, setRunsScored] = useState(0)
  const [stolenBases, setStolenBases] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchPlayers()
    fetchAtBats()
  }, [game.id])

  async function fetchPlayers() {
    try {
      // First, check if this game has a lineup template
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('lineup_template_id')
        .eq('id', game.id)
        .single()

      if (gameError) {
        console.error('Error fetching game lineup template:', gameError)
      }

      if (gameData?.lineup_template_id) {
        // Fetch players in batting order from lineup template
        const { data, error } = await supabase
          .from('lineup_template_players')
          .select(`
            batting_order,
            position,
            players (
              id,
              first_name,
              last_name,
              jersey_number,
              positions
            )
          `)
          .eq('template_id', gameData.lineup_template_id)
          .order('batting_order')

        if (error) {
          console.error('Error fetching lineup template players:', error)
        } else {
          // Convert to player array with batting order
          const orderedPlayers = (data || []).map(item => ({
            ...item.players,
            batting_order: item.batting_order,
            position: item.position
          })) as unknown as Player[]
          setPlayers(orderedPlayers)
          return
        }
      }

      // Fallback: fetch all players ordered by jersey number if no template
      const { data, error } = await supabase
        .from('players')
        .select('id, first_name, last_name, jersey_number, positions')
        .order('jersey_number')

      if (error) {
        console.error('Error fetching players:', error)
      } else {
        setPlayers(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch players:', err)
    }
  }

  async function fetchAtBats() {
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
        .eq('game_id', game.id)
        .order('inning, at_bat_number')

      if (error) {
        console.error('Error fetching at-bats:', error)
      } else {
        setAtBats(data || [])
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to fetch at-bats:', err)
      setLoading(false)
    }
  }

  async function addAtBat() {
    if (!selectedPlayer || !atBatResult) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('at_bats')
        .insert([{
          game_id: currentGame.id,
          player_id: selectedPlayer,
          inning: currentInning,
          at_bat_number: currentAtBat,
          result: atBatResult,
          rbi: rbi,
          runs_scored: runsScored,
          stolen_bases: stolenBases
        }])
        .select(`
          *,
          players (
            first_name,
            last_name,
            jersey_number
          )
        `)

      if (error) {
        console.error('Error adding at-bat:', error)
      } else {
        setAtBats([...atBats, data[0]])
        
        // Update game score if run was scored
        if (runsScored > 0) {
          await updateGameScore(runsScored)
        }
        
        setCurrentAtBat(currentAtBat + 1)
        setSelectedPlayer('')
        setAtBatResult('')
        setRbi(0)
        setRunsScored(0)
        setStolenBases(0)
      }
    } catch (err) {
      console.error('Failed to add at-bat:', err)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateGameScore(runsToAdd: number) {
    try {
      console.log('Updating game score:', runsToAdd, 'runs')
      
      const { data, error } = await supabase
        .from('games')
        .update({ 
          our_score: currentGame.our_score + runsToAdd,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentGame.id)
        .select()
      
      if (error) {
        console.error('Error updating game score:', error)
        return
      }
      
      // Update the local game state
      if (data && data[0]) {
        setCurrentGame(prev => ({
          ...prev,
          our_score: data[0].our_score
        }))
        console.log('Game score updated to:', data[0].our_score)
      }
    } catch (err) {
      console.error('Failed to update game score:', err)
    }
  }

  function nextInning() {
    setCurrentInning(currentInning + 1)
    setCurrentAtBat(1)
  }

  function getAtBatsForInning(inning: number) {
    return atBats.filter(ab => ab.inning === inning)
  }

  function getResultColor(result: string) {
    switch (result) {
      case 'single': return 'bg-green-100 text-green-800'
      case 'double': return 'bg-blue-100 text-blue-800'
      case 'triple': return 'bg-purple-100 text-purple-800'
      case 'home_run': return 'bg-yellow-100 text-yellow-800'
      case 'walk': return 'bg-gray-100 text-gray-800'
      case 'strikeout': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading scorebook...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900">vs {game.opponent}</h3>
            <p className="text-gray-600">{new Date(game.game_date).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {currentGame.our_score} - {currentGame.opponent_score}
            </div>
            <p className="text-sm text-gray-600">Inning {currentInning}</p>
          </div>
        </div>
      </div>

      {/* Add At-Bat Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Add At-Bat</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Player</label>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
            <select
              value={atBatResult}
              onChange={(e) => setAtBatResult(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select result</option>
              {AT_BAT_RESULTS.map((result) => (
                <option key={result.value} value={result.value}>
                  {result.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={addAtBat}
              disabled={!selectedPlayer || !atBatResult || submitting}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add At-Bat'}
            </button>
            <button
              onClick={nextInning}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Next Inning
            </button>
          </div>
        </div>
        
        {/* Additional Stats */}
        {(atBatResult === 'single' || atBatResult === 'double' || atBatResult === 'triple' || atBatResult === 'home_run') && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RBI</label>
              <input
                type="number"
                min="0"
                value={rbi}
                onChange={(e) => setRbi(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Runs Scored</label>
              <input
                type="number"
                min="0"
                value={runsScored}
                onChange={(e) => setRunsScored(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stolen Bases</label>
              <input
                type="number"
                min="0"
                value={stolenBases}
                onChange={(e) => setStolenBases(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Scorebook Grid */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Scorebook</h4>
        <div className="space-y-4">
          {Array.from({ length: Math.max(9, currentInning) }, (_, i) => i + 1).map((inning) => {
            const inningAtBats = getAtBatsForInning(inning)
            return (
              <div key={inning} className="border border-gray-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-700">Inning {inning}</h5>
                  <span className="text-sm text-gray-500">{inningAtBats.length} at-bats</span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {inningAtBats.map((atBat, index) => (
                    <div key={atBat.id} className="text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        #{atBat.players?.jersey_number} {atBat.players?.first_name?.charAt(0)}.{atBat.players?.last_name}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${getResultColor(atBat.result)}`}>
                        {atBat.result.replace('_', ' ')}
                      </div>
                      {(atBat.rbi > 0 || atBat.runs_scored > 0 || atBat.stolen_bases > 0) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {atBat.rbi > 0 && `RBI:${atBat.rbi}`}
                          {atBat.runs_scored > 0 && ` R:${atBat.runs_scored}`}
                          {atBat.stolen_bases > 0 && ` SB:${atBat.stolen_bases}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Close Button */}
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
        >
          Close Scorebook
        </button>
      </div>
    </div>
  )
}

