'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DiamondCanvas from './DiamondCanvas'
import OpponentLineupEntry from './OpponentLineupEntry'

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
  team_side?: 'home' | 'opponent'
  base_runners?: { first: boolean, second: boolean, third: boolean, home: boolean }
  base_runner_outs?: { first: boolean, second: boolean, third: boolean, home: boolean }
  notation?: string
  players?: Player
  created_at?: string
}

export default function TraditionalScorebook({ game, onClose }: { game: Game, onClose: () => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [opponentPlayers, setOpponentPlayers] = useState<Player[]>([])
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [currentGame, setCurrentGame] = useState<Game>(game)
  const [currentTeamSide, setCurrentTeamSide] = useState<'home' | 'opponent'>('home') // Track which team is batting
  const [homeTeamName, setHomeTeamName] = useState<string>('Dodgers') // Default to "Dodgers" until we fetch it
  const [gameInfo, setGameInfo] = useState({
    opponent: game.opponent,
    date: game.game_date,
    startTime: '',
    field: '',
    length: '',
    umpire: ''
  })
  const [loading, setLoading] = useState(true)
  const [selectedCell, setSelectedCell] = useState<{playerId: string, inning: number, playerName: string, teamSide?: 'home' | 'opponent'} | null>(null)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [isLocked, setIsLocked] = useState(game.game_status === 'completed')
  const [showOpponentLineupModal, setShowOpponentLineupModal] = useState(false)
  const [showHomeAwayModal, setShowHomeAwayModal] = useState(false)
  const [opponentLineupChecked, setOpponentLineupChecked] = useState(false)
  const [homeAwayChecked, setHomeAwayChecked] = useState(false)
  const [bothLineupsValid, setBothLineupsValid] = useState(false)
  const [lineupValidationMessage, setLineupValidationMessage] = useState<string>('')

  useEffect(() => {
    validateBothLineups()
    fetchPlayers()
    fetchAtBats()
  }, [game.id])

  // Validate that both lineups exist before allowing scorebook access
  async function validateBothLineups() {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('lineup_template_id, opponent_lineup_template_id')
        .eq('id', game.id)
        .single()

      if (error) {
        console.error('Error validating lineups:', error)
        setBothLineupsValid(false)
        setLineupValidationMessage('Error checking lineups')
        return
      }

      const hasHomeLineup = !!data?.lineup_template_id
      const hasOpponentLineup = !!data?.opponent_lineup_template_id

      if (!hasHomeLineup && !hasOpponentLineup) {
        setBothLineupsValid(false)
        setLineupValidationMessage('Both team lineups must be saved before accessing the scorebook. Please select lineups for Dodgers (home team) and the opponent team.')
      } else if (!hasHomeLineup) {
        setBothLineupsValid(false)
        setLineupValidationMessage('Dodgers lineup must be saved. Please select a lineup for Dodgers (home team).')
      } else if (!hasOpponentLineup) {
        setBothLineupsValid(false)
        setLineupValidationMessage('Opponent team lineup must be saved. Please select a lineup for the opponent team.')
      } else {
        setBothLineupsValid(true)
        setLineupValidationMessage('')
      }
    } catch (err) {
      console.error('Failed to validate lineups:', err)
      setBothLineupsValid(false)
      setLineupValidationMessage('Error validating lineups')
    }
  }

  // Refetch game data when currentGame changes to ensure score is up to date
  useEffect(() => {
    const refreshGame = async () => {
      const { data, error } = await supabase
        .from('games')
        .select()
        .eq('id', game.id)
        .single()
      
      if (!error && data) {
        setCurrentGame(data)
      }
    }
    
    // Refresh game data after a short delay to allow database updates to propagate
    const timeoutId = setTimeout(() => {
      refreshGame()
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [atBats.length]) // Refresh when at-bats change

  // Check if we need to show home/away modal when scorebook first opens
  useEffect(() => {
    // Only check once, and only if game is not completed
    if (homeAwayChecked || game.game_status === 'completed' || loading) return
    
    // If there are no at-bats and opponent lineup exists, show home/away modal
    // This determines who bats first
    if (atBats.length === 0 && opponentPlayers.length > 0 && !showOpponentLineupModal) {
      setHomeAwayChecked(true)
      // Small delay to ensure UI is ready
      setTimeout(() => {
        setShowHomeAwayModal(true)
      }, 300)
    }
  }, [atBats.length, opponentPlayers.length, showOpponentLineupModal, homeAwayChecked, game.game_status, loading])

  async function fetchPlayers() {
    try {
      setLoading(true)
      // Fetch our team's lineup from lineup template
      const { data: gameData } = await supabase
        .from('games')
        .select('lineup_template_id, opponent_lineup_template_id, team_id')
        .eq('id', game.id)
        .single()
      
      console.log('=== FETCHING PLAYERS ===')
      console.log('Game data:', gameData)
      console.log('Current team side:', currentTeamSide)

      // Check if opponent lineup exists, if not show modal to create it
      // Only check once to prevent loops
      if (!opponentLineupChecked && game.game_status !== 'completed') {
        setOpponentLineupChecked(true)
        
        // Also check if there's an opponent team with a lineup template (in case linking failed)
        let hasOpponentLineup = !!gameData?.opponent_lineup_template_id
        
        if (!hasOpponentLineup) {
          // Check if opponent team exists and has a lineup template
          const { data: opponentTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('name', game.opponent)
            .limit(1)
            .maybeSingle()
          
          if (opponentTeam?.id) {
            const { data: opponentTemplate } = await supabase
              .from('lineup_templates')
              .select('id')
              .eq('team_id', opponentTeam.id)
              .limit(1)
            hasOpponentLineup = !!opponentTemplate && opponentTemplate.length > 0
          }
          
          if (!hasOpponentLineup) {
            setShowOpponentLineupModal(true)
            // Don't check for home/away yet - wait for opponent lineup to be created
            return
          }
        }
      }

      if (gameData?.lineup_template_id) {
        // Fetch our team's players from lineup template and get team name
        const { data: ourLineupTemplate, error: templateError } = await supabase
          .from('lineup_templates')
          .select(`
            id,
            team_id,
            teams (
              id,
              name
            )
          `)
          .eq('id', gameData.lineup_template_id)
          .single()

        console.log('Lineup template data:', ourLineupTemplate)
        console.log('Template error:', templateError)

        if (ourLineupTemplate?.teams) {
          const team = Array.isArray(ourLineupTemplate.teams) 
            ? ourLineupTemplate.teams[0] 
            : ourLineupTemplate.teams
          if (team && typeof team === 'object' && 'name' in team) {
            const teamName = (team as { name: string }).name
            console.log('Setting home team name to:', teamName)
            setHomeTeamName(teamName || 'Dodgers')
          }
        } else {
          console.log('No teams data found in lineup template')
          // Try to get team name directly from team_id if available
          if (ourLineupTemplate?.team_id) {
            const { data: teamData } = await supabase
              .from('teams')
              .select('name')
              .eq('id', ourLineupTemplate.team_id)
              .single()
            
            if (teamData?.name) {
              console.log('Found team name from team_id:', teamData.name)
              setHomeTeamName(teamData.name)
            }
          }
        }

        const { data: ourLineupPlayers } = await supabase
          .from('lineup_template_players')
          .select(`
            player_id,
            batting_order,
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

        if (ourLineupPlayers) {
          const ourPlayers: Player[] = ourLineupPlayers
            .map(lp => {
              const player = lp.players
              if (player && typeof player === 'object' && !Array.isArray(player) && 'id' in player) {
                return {
                  ...(player as Player),
                  batting_order: lp.batting_order // Preserve batting order
                } as Player & { batting_order: number }
              }
              return null
            })
            .filter((p): p is Player & { batting_order: number } => p !== null)
            // Remove duplicates by player ID (in case same player appears multiple times)
            .filter((p, index, self) => index === self.findIndex((pl) => pl.id === p.id))
            .sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0)) // Sort by batting order to ensure correct sequence
            .slice(0, 9) // Limit to first 9 batters
          setPlayers(ourPlayers)
          console.log('Home team players loaded in batting order:', ourPlayers.map((p, idx) => `${idx + 1}. ${p.first_name} ${p.last_name} (order: ${(p as Player & { batting_order?: number }).batting_order})`))
          setLoading(false)
        } else {
          console.log('No home team lineup template found')
          setPlayers([])
          setLoading(false)
        }
      } else {
        // Fallback: fetch all players (limit to 9)
        const { data, error } = await supabase
          .from('players')
          .select('id, first_name, last_name, jersey_number, positions')
          .order('jersey_number')
          .limit(9)

        if (!error && data) {
          setPlayers(data)
        }
      }

      // Fetch opponent's lineup from lineup template
      // First try using opponent_lineup_template_id from game
      let opponentTemplateId = gameData?.opponent_lineup_template_id
      
      // If not linked to game, try to find it by opponent team name
      if (!opponentTemplateId) {
        const { data: opponentTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('name', game.opponent)
          .limit(1)
          .maybeSingle()
        
        if (opponentTeam?.id) {
          const { data: opponentTemplate } = await supabase
            .from('lineup_templates')
            .select('id')
            .eq('team_id', opponentTeam.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (opponentTemplate?.id) {
            opponentTemplateId = opponentTemplate.id
          }
        }
      }
      
      if (opponentTemplateId) {
        const { data: opponentLineupPlayers } = await supabase
          .from('lineup_template_players')
          .select(`
            player_id,
            batting_order,
            players (
              id,
              first_name,
              last_name,
              jersey_number,
              positions
            )
          `)
          .eq('template_id', opponentTemplateId)
          .order('batting_order')

        if (opponentLineupPlayers) {
          const oppPlayers: Player[] = opponentLineupPlayers
            .map(lp => {
              const player = lp.players
              if (player && typeof player === 'object' && !Array.isArray(player) && 'id' in player) {
                return {
                  ...(player as Player),
                  batting_order: lp.batting_order // Preserve batting order
                } as Player & { batting_order: number }
              }
              return null
            })
            .filter((p): p is Player & { batting_order: number } => p !== null)
            // Remove duplicates by player ID (in case same player appears multiple times)
            .filter((p, index, self) => index === self.findIndex((pl) => pl.id === p.id))
            .sort((a, b) => (a.batting_order || 0) - (b.batting_order || 0)) // Sort by batting order to ensure correct sequence
            .slice(0, 9) // Limit to first 9 batters
          setOpponentPlayers(oppPlayers)
          console.log('Opponent players loaded in batting order:', oppPlayers.map((p, idx) => `${idx + 1}. ${p.first_name} ${p.last_name} (order: ${(p as Player & { batting_order?: number }).batting_order})`))
        } else {
          console.log('No opponent lineup players found for template:', opponentTemplateId)
          setOpponentPlayers([])
        }
      } else {
        console.log('No opponent lineup template found')
        setOpponentPlayers([])
      }
      
      console.log('=== PLAYERS FETCH COMPLETE ===')
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
        .order('inning', { ascending: true })
        .order('at_bat_number', { ascending: true })

      if (error) {
        console.error('Error fetching at-bats:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        setLoading(false)
        return
      } else {
        setAtBats(data || [])
        
        // Always recalculate total score from all saved at-bats to ensure accuracy
        const totalRunsScored = (data || []).reduce((sum, ab) => sum + (ab.runs_scored || 0), 0)
        
        // Debug: Log which at-bats have runs_scored
        const atBatsWithRuns = (data || []).filter(ab => (ab.runs_scored || 0) > 0)
        console.log(`=== SCORE RECALCULATION ===`)
        console.log(`Total at-bats: ${data?.length || 0}`)
        console.log(`At-bats with runs: ${atBatsWithRuns.length}`)
        atBatsWithRuns.forEach(ab => {
          console.log(`  - Player: ${ab.players?.first_name} ${ab.players?.last_name}, Inning: ${ab.inning}, Runs: ${ab.runs_scored}`)
        })
        console.log(`Calculated total runs: ${totalRunsScored}`)
        console.log(`Current game score: ${currentGame.our_score}`)
        console.log(`===========================`)
        
        // Always update the game score to match the sum of all at-bats (ensures accuracy)
        const { data: updatedGame, error: scoreError } = await supabase
          .from('games')
          .update({ 
            our_score: totalRunsScored,
            updated_at: new Date().toISOString()
          })
          .eq('id', game.id)
          .select()
        
        if (scoreError) {
          console.error('Error updating game score:', scoreError)
        } else if (updatedGame && updatedGame[0]) {
          setCurrentGame(updatedGame[0])
          console.log('Game score recalculated and updated to:', totalRunsScored)
        }
        
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to fetch at-bats:', err)
      setLoading(false)
    }
  }

  function getAtBatForPlayer(playerId: string, inning: number) {
    return atBats.find(ab => 
      ab.player_id === playerId && 
      ab.inning === inning &&
      (ab.team_side === currentTeamSide || (!ab.team_side && currentTeamSide === 'home'))
    )
  }

  function getAtBatForPlayerNth(playerId: string, inning: number, n: number) {
    const matches = atBats
      .filter(ab => ab.player_id === playerId && ab.inning === inning)
      .sort((a, b) => (a.at_bat_number || 1) - (b.at_bat_number || 1))
    return matches[n - 1] || null
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

  // Determine if we should add a duplicate column for the active inning
  function getInningColumns(): { inning: number, isDuplicate: boolean }[] {
    const baseCols = Array.from({ length: 10 }, (_, i) => ({ inning: i + 1, isDuplicate: false }))
    if (players.length === 0 || atBats.length === 0) return baseCols
    const current = getCurrentBatter()
    if (!current) return baseCols
    const inningNumber = current.inning
    // Only consider duplicate if this inning has fewer than 3 outs and the next batter is the first batter
    const threeOuts = hasThreeOutsInInning(inningNumber)
    const isFirstBatterUp = players[0] && current.playerId === players[0].id
    if (!threeOuts && isFirstBatterUp) {
      const idx = inningNumber - 1
      // Insert a duplicate column immediately after the active inning
      baseCols.splice(idx + 1, 0, { inning: inningNumber, isDuplicate: true })
    }
    return baseCols
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
    // Filter at-bats for current team side in this inning
    const inningAtBats = atBats.filter(ab => 
      ab.inning === inning &&
      (ab.team_side === currentTeamSide || (!ab.team_side && currentTeamSide === 'home'))
    )
    const outsInInning = inningAtBats.filter(ab => 
      (ab.base_runner_outs && (ab.base_runner_outs.first || ab.base_runner_outs.second || ab.base_runner_outs.third || ab.base_runner_outs.home)) ||
      (ab.result && ['strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out'].includes(ab.result))
    ).length
    return outsInInning >= 3
  }

  // Check if a specific team (home or opponent) has 3 outs in an inning
  function hasThreeOutsForTeam(inning: number, teamSide: 'home' | 'opponent') {
    // Filter at-bats for the specific team in this inning
    // Only count at-bats that explicitly belong to this team
    const inningAtBats = atBats.filter(ab => {
      if (ab.inning !== inning) return false
      
      // If team_side is explicitly set, use it
      if (ab.team_side) {
        return ab.team_side === teamSide
      }
      
      // If team_side is not set (legacy data), only count as 'home' if checking for 'home'
      // Don't count legacy data as 'opponent' - be strict about opponent team
      if (teamSide === 'home') {
        return true // Legacy at-bats default to home
      } else {
        return false // Don't count legacy at-bats as opponent
      }
    })
    
    const outsInInning = inningAtBats.filter(ab => 
      (ab.base_runner_outs && (ab.base_runner_outs.first || ab.base_runner_outs.second || ab.base_runner_outs.third || ab.base_runner_outs.home)) ||
      (ab.result && ['strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out'].includes(ab.result))
    ).length
    
    return outsInInning >= 3
  }

  function hasPlayerBattedInInning(playerId: string, inning: number) {
    return atBats.some(ab => 
      ab.player_id === playerId && 
      ab.inning === inning &&
      (ab.team_side === currentTeamSide || (!ab.team_side && currentTeamSide === 'home'))
    )
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
    const teamSide = selectedCell.teamSide || currentTeamSide || 'home'
    
    // Log the at-bat data when Save is clicked
    console.log('=== AT-BAT SAVED ===')
    console.log('Player:', selectedCell.playerName)
    console.log('Inning:', selectedCell.inning)
    console.log('Team Side:', teamSide)
    console.log('Notation:', notation)
    console.log('Result:', result)
    console.log('Base Runners:', baseRunners)
    console.log('Runs Scored:', runsScored)
    console.log('==================')
    
    try {
      // Check if this is an existing at-bat (for this team and inning)
      const existingAtBat = atBats.find(ab => 
        ab.player_id === selectedCell.playerId && 
        ab.inning === selectedCell.inning &&
        (ab.team_side === teamSide || (!ab.team_side && teamSide === 'home'))
      )
      
      if (existingAtBat) {
        // Update existing at-bat
        console.log('Updating existing at-bat:', existingAtBat.id)
        
        // Calculate the difference in runs scored
        const oldRunsScored = existingAtBat.runs_scored || 0
        const runsDifference = runsScored - oldRunsScored
        
          const updateData = {
            notation: notation, // Save original notation
            result: result,
            runs_scored: runsScored,
            team_side: teamSide,
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
        
        // Update game score only by the difference (if there is a change)
        if (runsDifference !== 0) {
          await updateGameScore(runsDifference)
        }
      } else {
        // Create new at-bat
        console.log('Creating new at-bat')
        
          const insertData: {
            game_id: string
            player_id: string
            inning: number
            at_bat_number: number
            notation: string
            result: string
            rbi: number
            runs_scored: number
            stolen_bases: number
            base_runners: { first: boolean; second: boolean; third: boolean; home: boolean }
            base_runner_outs?: { first: boolean; second: boolean; third: boolean; home: boolean }
            out_type?: string
            field_area?: string
            field_zone?: string
            hit_distance?: string
            hit_angle?: string
            x_coordinate?: number
            y_coordinate?: number
            team_side?: string
          } = {
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
            field_area: (fieldLocationData?.fieldArea ? String(fieldLocationData.fieldArea) : ''),
            field_zone: (fieldLocationData?.fieldZone ? String(fieldLocationData.fieldZone) : ''),
            hit_distance: (fieldLocationData?.hitDistance ? String(fieldLocationData.hitDistance) : ''),
            hit_angle: (fieldLocationData?.hitAngle ? String(fieldLocationData.hitAngle) : '')
          }
        
        // Try inserting without team_side first (in case column doesn't exist)
        // We'll add team_side in a separate update if the column exists
        const { team_side, ...insertDataWithoutTeamSide } = insertData
        
        let finalData = null
        let insertError = null
        
        // First attempt: try without team_side
        const { data: dataWithoutTeamSide, error: errorWithoutTeamSide } = await supabase
          .from('at_bats')
          .insert([insertDataWithoutTeamSide])
          .select(`
            *,
            players (
              first_name,
              last_name,
              jersey_number
            )
          `)
        
        if (errorWithoutTeamSide) {
          console.error('Error creating at-bat (without team_side):', errorWithoutTeamSide)
          console.error('Error details:', JSON.stringify(errorWithoutTeamSide, null, 2))
          insertError = errorWithoutTeamSide
        } else {
          finalData = dataWithoutTeamSide[0]
          console.log('At-bat created successfully (without team_side):', finalData)
          
          // If we have team_side and the insert succeeded, try to update it
          if (teamSide && finalData?.id) {
            const { error: updateError } = await supabase
              .from('at_bats')
              .update({ team_side: teamSide })
              .eq('id', finalData.id)
            
            if (updateError) {
              // Column doesn't exist, that's okay - just log it
              console.log('team_side column does not exist, skipping update:', updateError.message)
            } else {
              // Update successful, refresh the data
              const { data: updatedData } = await supabase
                .from('at_bats')
                .select(`
                  *,
                  players (
                    first_name,
                    last_name,
                    jersey_number
                  )
                `)
                .eq('id', finalData.id)
                .single()
              
              if (updatedData) {
                finalData = updatedData
              }
            }
          }
        }
        
        if (insertError) {
          console.error('Insert data attempted:', JSON.stringify(insertDataWithoutTeamSide, null, 2))
          const errorMessage = insertError?.message || insertError?.details || 'Unknown error occurred'
          alert(`Error creating at-bat: ${errorMessage}. Please check console for details.`)
          return
        }
        
        if (finalData) {
          // Success
          setAtBats(prev => [...prev, finalData])
          console.log('At-bat successfully created:', finalData)
        }
      }

      // Recalculate total score from all at-bats (more accurate than incrementing)
      // This ensures we don't double-count runs
      const allAtBats = await supabase
        .from('at_bats')
        .select('runs_scored')
        .eq('game_id', game.id)
      
      if (!allAtBats.error && allAtBats.data) {
        const totalRunsScored = allAtBats.data.reduce((sum, ab) => sum + (ab.runs_scored || 0), 0)
        console.log(`Recalculating score after save. Total runs from all at-bats: ${totalRunsScored}`)
        
        // Update game score to match the sum of all at-bats
        const { data: updatedGame, error: scoreError } = await supabase
          .from('games')
          .update({ 
            our_score: totalRunsScored,
            updated_at: new Date().toISOString()
          })
          .eq('id', game.id)
          .select()
        
        if (!scoreError && updatedGame && updatedGame[0]) {
          setCurrentGame(updatedGame[0])
          console.log('Game score recalculated after save to:', totalRunsScored)
        }
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

  // Show validation message if both lineups are not saved
  if (!bothLineupsValid) {
    return (
      <div className="bg-white p-6 max-w-2xl mx-auto">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-red-800 mb-2">Lineups Required</h3>
          <p className="text-red-700 mb-4">{lineupValidationMessage}</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 max-w-7xl mx-auto">
      {/* Game Information Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">vs {game.opponent}</h2>
            <div className="mt-2">
              <div className={`inline-block px-4 py-2 text-white rounded-lg font-semibold text-lg ${
                currentTeamSide === 'home' ? 'bg-blue-600' : 'bg-red-600'
              }`}>
                {currentTeamSide === 'home' ? homeTeamName : game.opponent}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {currentGame.our_score} - {currentGame.opponent_score}
            </div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
        </div>

        {/* Team Switcher - Voltear Hoja Button */}
        <div className="mb-4 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-lg p-3">
          <button
            onClick={() => setCurrentTeamSide(currentTeamSide === 'home' ? 'opponent' : 'home')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center space-x-2 shadow-md"
            title="Voltear Hoja - Cambiar de equipo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="text-lg">Voltear Hoja</span>
          </button>
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
              {getInningColumns().map((col, i) => (
                <th key={`inning-${i}`} className="border border-gray-400 px-1 py-1 w-16 text-center">
                  {col.inning}
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
            {Array.from({ length: 9 }, (_, rowIndex) => {
              const activePlayers = currentTeamSide === 'home' ? players : opponentPlayers
              const player = activePlayers[rowIndex]
              const stats = player ? getPlayerStats(player.id) : { hits: 0, walks: 0, runs: 0, rbi: 0, errors: 0 }
              
              // Debug logging for first row only
              if (rowIndex === 0) {
                console.log('Displaying scorebook:', {
                  currentTeamSide,
                  homePlayersCount: players.length,
                  opponentPlayersCount: opponentPlayers.length,
                  activePlayersCount: activePlayers.length,
                  firstPlayer: activePlayers[0] ? `${activePlayers[0].first_name} ${activePlayers[0].last_name}` : 'none'
                })
              }
              
              return (
                <tr key={rowIndex} className="h-12">
                  {/* Batting Order Number */}
                  <td className="border border-gray-400 px-2 py-1 text-center font-bold">
                    {player ? (rowIndex + 1) : ''}
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
                  {getInningColumns().map((col, inningIndex) => {
                    const atBat = player ? getAtBatForPlayerNth(player.id, col.inning, col.isDuplicate ? 2 : 1) : null
                    const currentBatter = getCurrentBatter()
                    const isCurrentBatter = currentBatter && player && currentBatter.playerId === player.id && currentBatter.inning === col.inning && !col.isDuplicate
                    
                    // Check if this cell should be locked
                    // Lock cells only for the team being viewed if that team has 3 outs in this inning
                    // Don't lock cells for the other team, even if they have 3 outs (they're next to bat)
                    const inningNumber = col.inning
                    
                    // Only lock if:
                    // 1. The team being viewed has 3 outs in this inning
                    // 2. AND this specific player hasn't batted in this inning
                    // 3. AND there are actually at-bats for this team in this inning (to prevent locking empty innings)
                    const threeOutsForViewedTeam = hasThreeOutsForTeam(inningNumber, currentTeamSide)
                    const playerBatted = player ? hasPlayerBattedInInning(player.id, inningNumber) : false
                    
                    // Check if there are any at-bats for the viewed team in this inning
                    const hasAtBatsForTeam = atBats.some(ab => {
                      if (ab.inning !== inningNumber) return false
                      if (ab.team_side) {
                        return ab.team_side === currentTeamSide
                      }
                      // Legacy data defaults to home
                      return !ab.team_side && currentTeamSide === 'home'
                    })
                    
                    // Only lock if team has 3 outs AND player hasn't batted AND there are at-bats for this team
                    const isLockedCell = threeOutsForViewedTeam && !playerBatted && hasAtBatsForTeam
                    
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
                              // For duplicate columns, force creation of a new at-bat (pass undefined)
                              handleCellClick(
                                player.id,
                                inningNumber,
                                `${player.first_name} ${player.last_name}`,
                                col.isDuplicate ? undefined : (atBat as unknown as Record<string, unknown> || undefined)
                              )
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

      {/* Opponent Lineup Entry Modal */}
      {showOpponentLineupModal && (
        <OpponentLineupEntry
          gameId={game.id}
          opponentName={game.opponent}
          onClose={async () => {
            setShowOpponentLineupModal(false)
            // Refresh players to get opponent lineup (but don't check for opponent lineup again)
            await fetchPlayers()
            // After saving opponent lineup, ask about home/away team
            // Use a small delay to ensure state is updated
            setTimeout(() => {
              setHomeAwayChecked(true)
              setShowHomeAwayModal(true)
            }, 300)
          }}
        />
      )}

      {/* Home/Away Team Selection Modal */}
      {showHomeAwayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              ¿Quién batea primero?
            </h3>
            <p className="text-sm text-gray-600 mb-6 text-center">
              Selecciona el equipo que batea primero
            </p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => {
                  // Opponent bats first
                  setCurrentTeamSide('opponent')
                  setHomeAwayChecked(true)
                  setShowHomeAwayModal(false)
                }}
                className="px-6 py-4 bg-red-600 text-white rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors"
              >
                {game.opponent}
              </button>
              <button
                onClick={() => {
                  // Home team (Dodgers) bats first
                  setCurrentTeamSide('home')
                  setHomeAwayChecked(true)
                  setShowHomeAwayModal(false)
                }}
                className="px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
              >
                {homeTeamName}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
