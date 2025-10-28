'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DiamondCanvas from './DiamondCanvas'

interface Player {
  id: string
  first_name: string
  last_name: string
  jersey_number: number
  positions: string[]
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

interface AtBat {
  id: string
  player_id: string
  inning: number
  at_bat_number: number
  result: string
  rbi: number
  runs_scored: number
  stolen_bases: number
  base_runners?: { first: boolean, second: boolean, third: boolean, home: boolean }
  base_runner_outs?: { first: boolean, second: boolean, third: boolean, home: boolean }
  notation?: string
  players?: Player
}

export default function TraditionalScorebook({ game, onClose }: { game: Game, onClose: () => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [currentGame, setCurrentGame] = useState<Game>(game)
  const [gameInfo, setGameInfo] = useState({
    opponent: game.opponent,
    date: game.game_date,
    startTime: '',
    field: '',
    length: '',
    umpire: ''
  })
  const [loading, setLoading] = useState(true)
  const [selectedCell, setSelectedCell] = useState<{playerId: string, inning: number, playerName: string} | null>(null)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [isLocked, setIsLocked] = useState(game.game_status === 'completed')

  useEffect(() => {
    fetchPlayers()
    fetchAtBats()
  }, [game.id])

  async function fetchPlayers() {
    try {
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

  function getAtBatForPlayer(playerId: string, inning: number) {
    return atBats.find(ab => ab.player_id === playerId && ab.inning === inning)
  }

  function getCurrentBatter() {
    if (players.length === 0) return null

    // If no at-bats yet, first player is up
    if (atBats.length === 0) {
      return { playerId: players[0].id, inning: 1 }
    }

    // Find the highest inning with at-bats
    const maxInning = Math.max(...atBats.map(ab => ab.inning))
    
    // Count outs in the current inning (assuming 3 outs per inning)
    const currentInningAtBats = atBats.filter(ab => ab.inning === maxInning)
    const outsInCurrentInning = currentInningAtBats.filter(ab => 
      (ab.base_runner_outs && (ab.base_runner_outs.first || ab.base_runner_outs.second || ab.base_runner_outs.third || ab.base_runner_outs.home)) ||
      (ab.result && ['strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out'].includes(ab.result))
    ).length

    // If 3 outs, move to next inning
    const currentInning = outsInCurrentInning >= 3 ? maxInning + 1 : maxInning
    
    // Find the last at-bat in the max inning by batting order position
    // Sort by player's position in the batting order (0-8), highest index = last batter
    const lastAtBatInMaxInning = currentInningAtBats.sort((a, b) => {
      const aIndex = players.findIndex(p => p.id === a.player_id)
      const bIndex = players.findIndex(p => p.id === b.player_id)
      return bIndex - aIndex
    })[0]
    
    if (lastAtBatInMaxInning) {
      const lastPlayerIndex = players.findIndex(p => p.id === lastAtBatInMaxInning.player_id)
      // Next player in batting order (1-9, wraps to 1 after 9)
      const nextPlayerIndex = (lastPlayerIndex + 1) % players.length
      return { playerId: players[nextPlayerIndex].id, inning: currentInning }
    }
    
    // Fallback: first player
    return { playerId: players[0].id, inning: currentInning }
  }

  function getPlayerStats(playerId: string) {
    const playerAtBats = atBats.filter(ab => ab.player_id === playerId)
    return {
      hits: playerAtBats.filter(ab => ['single', 'double', 'triple', 'home_run'].includes(ab.result)).length,
      walks: playerAtBats.filter(ab => ab.result === 'walk').length,
      runs: playerAtBats.reduce((sum, ab) => sum + (ab.runs_scored || 0), 0),
      rbi: playerAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0),
      errors: playerAtBats.filter(ab => ab.result === 'error').length
    }
  }

  function hasThreeOutsInInning(inning: number) {
    const inningAtBats = atBats.filter(ab => ab.inning === inning)
    const outsInInning = inningAtBats.filter(ab => 
      (ab.base_runner_outs && (ab.base_runner_outs.first || ab.base_runner_outs.second || ab.base_runner_outs.third || ab.base_runner_outs.home)) ||
      (ab.result && ['strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out'].includes(ab.result))
    ).length
    return outsInInning >= 3
  }

  function hasPlayerBattedInInning(playerId: string, inning: number) {
    return atBats.some(ab => ab.player_id === playerId && ab.inning === inning)
  }

  function handleCellClick(playerId: string, inning: number, playerName: string, existingAtBat?: Record<string, unknown>) {
    // Allow viewing (but not editing) when locked
    setSelectedCell({ playerId, inning, playerName })
    setShowCanvasModal(true)
  }

  async function saveScorebook() {
    if (!confirm('Are you sure you want to save and lock the scorebook? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('games')
        .update({ game_status: 'completed' })
        .eq('id', game.id)
      
      if (error) {
        console.error('Error updating game status:', error)
        alert('Error saving scorebook')
        return
      }
      
      setIsLocked(true)
      alert('Scorebook saved and locked! All data is now read-only.')
    } catch (err) {
      console.error('Failed to save scorebook:', err)
      alert('Error saving scorebook')
    }
  }

  function interpretHandwriting(input: string) {
    const cleanInput = input.trim().toUpperCase()
    
    // Simplified baseball notation mapping - only use values that exist in database constraint
    const notationMap: { [key: string]: string } = {
      // Simple categories
      'HIT': 'single', // Default hit to single
      'OUT': 'ground_out', // Default out to ground out
      
        // Basic hits
        '1B': 'single',
        '2B': 'double', 
        '3B': 'triple',
        'HR': 'home_run',
        'HOMER': 'home_run',
        'HOMERUN': 'home_run',
        'H1': 'single', // Hit single
        'H2': 'double', // Hit double
        'H3': 'triple', // Hit triple
        
        // Infield hits and bunts
        'BUNT': 'single', // Bunt single
        'BUNT_SINGLE': 'single',
        'INFIELD_HIT': 'single',
        'INFIELD_SINGLE': 'single',
      
      // Walks and hit by pitch
      'BB': 'walk',
      'WALK': 'walk',
      'HBP': 'hit_by_pitch',
      'HIT_BY_PITCH': 'hit_by_pitch',
      
      // Strikeouts
      'K': 'strikeout',
      'SO': 'strikeout',
      'STRIKEOUT': 'strikeout',
      
        // Ground outs (fielder to first base)
        'GO': 'ground_out',
        'GROUND_OUT': 'ground_out',
        'BUNT_OUT': 'ground_out', // Bunt out
        'BUNT_GROUND_OUT': 'ground_out',
      '1-3': 'ground_out', // Pitcher to first
      '2-3': 'ground_out', // Catcher to first
      '3-1': 'ground_out', // First to pitcher
      '4-3': 'ground_out', // Second to first
      '5-3': 'ground_out', // Third to first
      '6-3': 'ground_out', // Shortstop to first
      '7-3': 'ground_out', // Left field to first
      '8-3': 'ground_out', // Center field to first
      '9-3': 'ground_out', // Right field to first
      
      // Fly outs (fielder catches ball)
      'FO': 'fly_out',
      'FLY_OUT': 'fly_out',
      'F-1': 'fly_out', // Pitcher catches
      'F-2': 'fly_out', // Catcher catches
      'F-3': 'fly_out', // First baseman catches
      'F-4': 'fly_out', // Second baseman catches
      'F-5': 'fly_out', // Third baseman catches
      'F-6': 'fly_out', // Shortstop catches
      'F-7': 'fly_out', // Left fielder catches
      'F-8': 'fly_out', // Center fielder catches
      'F-9': 'fly_out', // Right fielder catches
      
      // Line outs
      'LO': 'line_out',
      'LINE_OUT': 'line_out',
      'L-1': 'line_out', // Line drive to pitcher
      'L-2': 'line_out', // Line drive to catcher
      'L-3': 'line_out', // Line drive to first
      'L-4': 'line_out', // Line drive to second
      'L-5': 'line_out', // Line drive to third
      'L-6': 'line_out', // Line drive to shortstop
      'L-7': 'line_out', // Line drive to left field
      'L-8': 'line_out', // Line drive to center field
      'L-9': 'line_out', // Line drive to right field
      
      // Pop outs
      'PO': 'pop_out',
      'POP_OUT': 'pop_out',
      'P-1': 'pop_out', // Pop up to pitcher
      'P-2': 'pop_out', // Pop up to catcher
      'P-3': 'pop_out', // Pop up to first
      'P-4': 'pop_out', // Pop up to second
      'P-5': 'pop_out', // Pop up to third
      'P-6': 'pop_out', // Pop up to shortstop
      'P-7': 'pop_out', // Pop up to left field
      'P-8': 'pop_out', // Pop up to center field
      'P-9': 'pop_out', // Pop up to right field
      
      // Errors
      'E': 'error',
      'ERROR': 'error',
      'E-1': 'error', // Error by pitcher
      'E-2': 'error', // Error by catcher
      'E-3': 'error', // Error by first baseman
      'E-4': 'error', // Error by second baseman
      'E-5': 'error', // Error by third baseman
      'E-6': 'error', // Error by shortstop
      'E-7': 'error', // Error by left fielder
      'E-8': 'error', // Error by center fielder
      'E-9': 'error', // Error by right fielder
      
      // Sacrifice plays
      'SF': 'sacrifice_fly',
      'SAC_FLY': 'sacrifice_fly',
      'SACRIFICE_FLY': 'sacrifice_fly',
      'SAC': 'sacrifice_bunt',
      'SAC_BUNT': 'sacrifice_bunt',
      'SACRIFICE_BUNT': 'sacrifice_bunt',
      
        // Fielders choice (mapped to ground_out)
        'FC': 'ground_out',
        'FIELDERS_CHOICE': 'ground_out',
        'FIELDER_CHOICE': 'ground_out',
        'FIELDERS_CHOICE_OUT': 'ground_out',
      
      // Wild pitch and passed ball (mapped to walk)
      'WP': 'walk',
      'WILD_PITCH': 'walk',
      'PB': 'walk',
      'PASSED_BALL': 'walk',
      
      // Balk (mapped to walk)
      'BK': 'walk',
      'BALK': 'walk',
      
      // Interference (mapped to walk)
      'INT': 'walk',
      'INTERFERENCE': 'walk',
      
      // Unassisted plays
      'U-1': 'ground_out', // Unassisted by pitcher
      'U-3': 'ground_out', // Unassisted by first baseman
      'U-4': 'ground_out', // Unassisted by second baseman
      'U-5': 'ground_out', // Unassisted by third baseman
      'U-6': 'ground_out', // Unassisted by shortstop
      
      // Force outs
      'FO-1': 'ground_out', // Force out at first
      'FO-2': 'ground_out', // Force out at second
      'FO-3': 'ground_out', // Force out at third
      'FO-H': 'ground_out', // Force out at home
    }
    
    const result = notationMap[cleanInput] || 'ground_out' // Default to ground_out if not recognized
    console.log(`Interpreted "${cleanInput}" as "${result}"`)
    return result
  }

  async function updateGameScore(runsToAdd: number) {
    try {
      const newScore = currentGame.our_score + runsToAdd
      
      const { data, error } = await supabase
        .from('games')
        .update({ 
          our_score: newScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', game.id)
        .select()
      
      if (error) {
        console.error('Error updating game score:', error)
        return
      }
      
      // Update the local game state
      if (data && data[0]) {
        setCurrentGame(data[0])
        console.log('Game score updated to:', data[0].our_score)
      }
    } catch (err) {
      console.error('Failed to update game score:', err)
    }
  }

  async function saveAtBat(notation: string, baseRunners?: { first: boolean, second: boolean, third: boolean, home: boolean }, fieldLocationData?: Record<string, unknown>, baseRunnerOuts?: { first: boolean, second: boolean, third: boolean, home: boolean }, baseRunnerOutTypes?: { first: string, second: string, third: string, home: string }, rbi?: number) {
    if (!selectedCell) return

    const result = interpretHandwriting(notation)
    const runsScored = baseRunners?.home ? 1 : 0
    
    // Log the at-bat data when Save is clicked
    console.log('=== AT-BAT SAVED ===')
    console.log('Player:', selectedCell.playerName)
    console.log('Inning:', selectedCell.inning)
    console.log('Notation:', notation)
    console.log('Result:', result)
    console.log('Base Runners:', baseRunners)
    console.log('Runs Scored:', runsScored)
    console.log('==================')
    
    try {
      // Check if this is an existing at-bat
      const existingAtBat = getAtBatForPlayer(selectedCell.playerId, selectedCell.inning)
      
      if (existingAtBat) {
        // Update existing at-bat
        console.log('Updating existing at-bat:', existingAtBat.id)
        
          const updateData = {
            notation: notation, // Save original notation
            result: result,
            runs_scored: runsScored,
            base_runners: baseRunners || { first: false, second: false, third: false, home: false },
            base_runner_outs: baseRunnerOuts || { first: false, second: false, third: false, home: false },
            out_type: baseRunnerOutTypes ? Object.values(baseRunnerOutTypes).find(type => type !== '') || '' : '',
            field_area: fieldLocationData?.fieldArea || '',
            field_zone: fieldLocationData?.fieldZone || '',
            hit_distance: fieldLocationData?.hitDistance || '',
            hit_angle: fieldLocationData?.hitAngle || '',
            rbi: rbi || 0
          }
        
        const { data, error } = await supabase
          .from('at_bats')
          .update(updateData)
          .eq('id', existingAtBat.id)
          .select(`
            *,
            players (
              first_name,
              last_name,
              jersey_number
            )
          `)
        
          if (error) {
            console.error('Error updating at-bat:', error)
            console.error('Full error details:', JSON.stringify(error, null, 2))
            return
          }
        
        // Update the local state
        setAtBats(prev => prev.map(ab => 
          ab.id === existingAtBat.id ? { ...ab, ...updateData } : ab
        ))
        
        console.log('At-bat successfully updated:', data[0])
      } else {
        // Create new at-bat
        console.log('Creating new at-bat')
        
          const insertData = {
            game_id: game.id,
            player_id: selectedCell.playerId,
            inning: selectedCell.inning,
            at_bat_number: 1, // We'll calculate this properly later
            notation: notation, // Save original notation
            result: result,
            rbi: rbi || 0,
            runs_scored: runsScored,
            stolen_bases: 0,
            base_runners: baseRunners || { first: false, second: false, third: false, home: false },
            base_runner_outs: baseRunnerOuts || { first: false, second: false, third: false, home: false },
            out_type: baseRunnerOutTypes ? Object.values(baseRunnerOutTypes).find(type => type !== '') || '' : '',
            field_area: fieldLocationData?.fieldArea || '',
            field_zone: fieldLocationData?.fieldZone || '',
            hit_distance: fieldLocationData?.hitDistance || '',
            hit_angle: fieldLocationData?.hitAngle || ''
          }
        
        const { data, error } = await supabase
          .from('at_bats')
          .insert([insertData])
          .select(`
            *,
            players (
              first_name,
              last_name,
              jersey_number
            )
          `)
        
        if (error) {
          console.error('Error creating at-bat:', error)
          console.error('Full error details:', JSON.stringify(error, null, 2))
          return
        }
        
        // Add to local state
        setAtBats(prev => [...prev, data[0]])
        console.log('At-bat successfully created:', data[0])
      }

      // Update game score if run was scored
      if (runsScored > 0) {
        await updateGameScore(runsScored)
      }

      // Close the modal after successful save
      setShowCanvasModal(false)
      setSelectedCell(null)
    } catch (err) {
      console.error('Failed to save at-bat:', err)
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
    <div className="bg-white p-6 max-w-7xl mx-auto">
      {/* Game Information Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">vs {game.opponent}</h2>
            <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {currentGame.our_score} - {currentGame.opponent_score}
            </div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
        </div>
        
        <div style={{display: 'none'}} className="grid grid-cols-6 gap-4 text-sm">
          <div>
            <label className="block text-gray-600 mb-1">Date:</label>
            <input
              type="date"
              value={gameInfo.date}
              onChange={(e) => setGameInfo({...gameInfo, date: e.target.value})}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Start Time:</label>
            <input
              type="time"
              value={gameInfo.startTime}
              onChange={(e) => setGameInfo({...gameInfo, startTime: e.target.value})}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Field:</label>
            <input
              type="text"
              value={gameInfo.field}
              onChange={(e) => setGameInfo({...gameInfo, field: e.target.value})}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Length:</label>
            <input
              type="text"
              value={gameInfo.length}
              onChange={(e) => setGameInfo({...gameInfo, length: e.target.value})}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Umpire:</label>
            <input
              type="text"
              value={gameInfo.umpire}
              onChange={(e) => setGameInfo({...gameInfo, umpire: e.target.value})}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex items-end">
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">
                {game.our_score} - {game.opponent_score}
              </div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scorebook Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-400 text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1 w-8">#</th>
              <th className="border border-gray-400 px-2 py-1 whitespace-nowrap">Batter</th>
              <th className="border border-gray-400 px-1 py-1 w-6"></th>
              {Array.from({ length: 10 }, (_, i) => (
                <th key={i} className="border border-gray-400 px-1 py-1 w-16 text-center">
                  {i + 1}
                </th>
              ))}
              <th className="border border-gray-400 px-1 py-1 w-8 text-center">H</th>
              <th className="border border-gray-400 px-1 py-1 w-8 text-center">BB</th>
              <th className="border border-gray-400 px-1 py-1 w-8 text-center">R</th>
              <th className="border border-gray-400 px-1 py-1 w-8 text-center">RBI</th>
              <th className="border border-gray-400 px-1 py-1 w-8 text-center">E</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, rowIndex) => {
              const player = players[rowIndex]
              const stats = player ? getPlayerStats(player.id) : { hits: 0, walks: 0, runs: 0, rbi: 0, errors: 0 }
              
              return (
                <tr key={rowIndex} className="h-12">
                  {/* Jersey Number */}
                  <td className="border border-gray-400 px-2 py-1 text-center">
                    {player ? player.jersey_number : ''}
                  </td>
                  
                  {/* Player Name */}
                  <td className="border border-gray-400 px-2 py-1 whitespace-nowrap">
                    {player ? `${player.first_name} ${player.last_name}` : ''}
                  </td>
                  
                  {/* Diagonal Line Column */}
                  <td className="border border-gray-400 px-1 py-1 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-px bg-gray-400 transform rotate-45"></div>
                    </div>
                  </td>
                  
                  {/* Inning Columns with Diamond Grids */}
                  {Array.from({ length: 10 }, (_, inningIndex) => {
                    const atBat = player ? getAtBatForPlayer(player.id, inningIndex + 1) : null
                    const currentBatter = getCurrentBatter()
                    const isCurrentBatter = currentBatter && player && currentBatter.playerId === player.id && currentBatter.inning === inningIndex + 1
                    
                    // Check if this cell should be locked
                    const inningNumber = inningIndex + 1
                    const threeOuts = hasThreeOutsInInning(inningNumber)
                    const playerBatted = player ? hasPlayerBattedInInning(player.id, inningNumber) : false
                    const isLockedCell = threeOuts && !playerBatted
                    
                    return (
                      <td key={inningIndex} className="border border-gray-400 px-1 py-1 relative">
                        <div 
                          className={`w-full h-full flex items-center justify-center transition-colors ${
                            isLockedCell 
                              ? 'cursor-not-allowed bg-gray-200' 
                              : 'cursor-pointer hover:bg-blue-50 active:bg-blue-100'
                          }`}
                          onClick={() => {
                            if (!isLockedCell && player) {
                              handleCellClick(player.id, inningIndex + 1, `${player.first_name} ${player.last_name}`, atBat as unknown as Record<string, unknown> || undefined)
                            }
                          }}
                        >
                          {/* Diamond Shape */}
                          <div className="relative w-8 h-8">
                            <div className={`absolute inset-0 border border-gray-300 transform rotate-45 ${
                              atBat?.base_runners?.home ? 'bg-blue-600' : '' // Only blue if run scored (home = true)
                            }`}></div>
                            
                            {/* Base highlighting - show which base the runner is on */}
                            {atBat?.base_runners && (
                              <>
                                {/* First base highlight (right side) */}
                                {atBat.base_runners.first && (
                                  <div className="absolute top-1/2 right-0 w-2 h-2 bg-yellow-400 transform rotate-45 -translate-y-1/2 translate-x-1/2"></div>
                                )}
                                {/* Second base highlight (top) */}
                                {atBat.base_runners.second && (
                                  <div className="absolute top-0 left-1/2 w-2 h-2 bg-yellow-400 transform rotate-45 -translate-x-1/2 -translate-y-1/2"></div>
                                )}
                                {/* Third base highlight (left side) */}
                                {atBat.base_runners.third && (
                                  <div className="absolute top-1/2 left-0 w-2 h-2 bg-yellow-400 transform rotate-45 -translate-y-1/2 -translate-x-1/2"></div>
                                )}
                                {/* Home plate highlight (bottom) - only if not run scored (blue diamond) */}
                                {atBat.base_runners.home && (
                                  <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-yellow-400 transform rotate-45 -translate-x-1/2 translate-y-1/2"></div>
                                )}
                              </>
                            )}
                            
                            {/* Red dot indicator for outs - show if base runner out OR result is an out */}
                            {atBat && (
                              (atBat?.base_runner_outs && (atBat.base_runner_outs.first || atBat.base_runner_outs.second || atBat.base_runner_outs.third || atBat.base_runner_outs.home)) ||
                              (atBat.result && ['strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out'].includes(atBat.result))
                            ) && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></div>
                            )}
                            
                            {/* Green circle indicator for current batter - only show if no out recorded */}
                            {isCurrentBatter && !atBat && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white"></div>
                            )}
                            
                            {/* At-bat result notation - only show if not run scored (blue diamond) */}
                            {atBat && !atBat.base_runners?.home && (
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold z-10">
                                {atBat.result === 'single' && '1B'}
                                {atBat.result === 'double' && '2B'}
                                {atBat.result === 'triple' && '3B'}
                                {atBat.result === 'home_run' && 'HR'}
                                {atBat.result === 'walk' && 'BB'}
                                {atBat.result === 'strikeout' && 'K'}
                                {atBat.result === 'ground_out' && 'GO'}
                                {atBat.result === 'fly_out' && 'FO'}
                                {atBat.result === 'line_out' && 'LO'}
                                {atBat.result === 'pop_out' && 'PO'}
                                {atBat.result === 'error' && 'E'}
                                {atBat.result === 'hit_by_pitch' && 'HBP'}
                                {atBat.result === 'sacrifice_fly' && 'SF'}
                                {atBat.result === 'sacrifice_bunt' && 'SAC'}
                              </div>
                            )}
                            
                            {/* Touch indicator when empty */}
                            {!atBat && player && (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                                +
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                  
                  {/* Summary Statistics */}
                  <td className="border border-gray-400 px-1 py-1 text-center font-bold">
                    {stats.hits}
                  </td>
                  <td className="border border-gray-400 px-1 py-1 text-center font-bold">
                    {stats.walks}
                  </td>
                  <td className="border border-gray-400 px-1 py-1 text-center font-bold">
                    {stats.runs}
                  </td>
                  <td className="border border-gray-400 px-1 py-1 text-center font-bold">
                    {stats.rbi}
                  </td>
                  <td className="border border-gray-400 px-1 py-1 text-center font-bold">
                    {stats.errors}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="mt-6">
        <div className="text-sm text-gray-600 mb-4">
          {isLocked ? (
            <p className="text-orange-600 font-bold">🔒 Scorebook LOCKED - View only mode</p>
          ) : (
            <>
              <p>• Tap diamond cells to draw on the diamond</p>
              <p>• Draw notation with finger or stylus (K, 6-3, arrows, etc.)</p>
              <p>• Summary columns auto-calculate totals</p>
            </>
          )}
        </div>
        <div className="flex flex-col gap-3 items-stretch sm:flex-row sm:justify-end sm:gap-3">
          {!isLocked && (
            <button
              onClick={saveScorebook}
              className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 w-full sm:w-auto"
            >
              💾 Save Scorebook
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-6 py-2.5 rounded-lg hover:bg-gray-700 w-full sm:w-auto"
          >
            Close Scorebook
          </button>
        </div>
      </div>

      {/* Canvas Drawing Modal */}
      {showCanvasModal && selectedCell && (
        <DiamondCanvas
          onSave={(notation, baseRunners, fieldLocationData, baseRunnerOuts, baseRunnerOutTypes, rbi) => {
            saveAtBat(notation, baseRunners, fieldLocationData, baseRunnerOuts, baseRunnerOutTypes, rbi)
          }}
          onClose={() => {
            setShowCanvasModal(false)
            setSelectedCell(null)
          }}
          playerName={selectedCell.playerName}
          inning={selectedCell.inning}
          existingAtBat={getAtBatForPlayer(selectedCell.playerId, selectedCell.inning) as unknown as Record<string, unknown>}
          isLocked={isLocked}
        />
      )}
    </div>
  )
}
