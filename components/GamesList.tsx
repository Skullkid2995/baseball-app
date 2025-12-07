'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TraditionalScorebook from './TraditionalScorebook'
import HitStatistics from './HitStatistics'
import LineupSelection from './LineupSelection'
import OpponentLineupEntry from './OpponentLineupEntry'
import { useLanguage } from '@/contexts/LanguageContext'

interface Game {
  id: string
  opponent: string
  game_date: string
  game_time: string
  stadium: string
  weather_conditions: string
  our_score: number
  opponent_score: number
  innings_played: number
  game_status: string
  team_id?: string
  created_at: string
}

interface Team {
  id: string
  name: string
  city: string
}

export default function GamesList() {
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { t } = useLanguage()
  const [showNewGameForm, setShowNewGameForm] = useState(false)
  const [showScorebook, setShowScorebook] = useState<string | null>(null)
  const [showStatistics, setShowStatistics] = useState<string | null>(null)
  const [showLineupSelection, setShowLineupSelection] = useState<string | null>(null)
  const [showOpponentLineup, setShowOpponentLineup] = useState<string | null>(null)
  const [gameCreationStep, setGameCreationStep] = useState<'info' | 'ourLineup' | 'opponentLineup'>('info')
  const [newGameId, setNewGameId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    opponent: '',
    game_date: '',
    game_time: '',
    stadium: '',
    weather_conditions: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [gamesLineupStatus, setGamesLineupStatus] = useState<Record<string, {
    homeTeamSaved: boolean
    opponentTeamSaved: boolean
    homeTeamName: string
    opponentTeamName: string
  }>>({}) // Track lineup status for each game with team details

  useEffect(() => {
    fetchGames()
    fetchTeams()
  }, [])

  // Check lineup status for all games
  useEffect(() => {
    async function checkStatus() {
      if (games.length > 0) {
        await updateLineupStatusForAllGames()
      }
    }
    checkStatus()
  }, [games.length])

  async function fetchGames() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('game_date', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setGames(data || [])
      }
    } catch (err) {
      setError('Failed to fetch games')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTeams() {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, city')
        .order('name')

      if (error) {
        console.error('Error fetching teams:', error)
      } else {
        setTeams(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err)
    }
  }

  // Check lineup status for each team in a game
  async function checkLineupStatus(gameId: string): Promise<{
    homeTeamSaved: boolean
    opponentTeamSaved: boolean
    homeTeamName: string
    opponentTeamName: string
  }> {
    const defaultStatus = {
      homeTeamSaved: false,
      opponentTeamSaved: false,
      homeTeamName: 'Dodgers',
      opponentTeamName: 'Oponente'
    }

    try {
      // First try to get all fields
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (error) {
        // Check if it's a column error (columns don't exist)
        const errorMessage = error?.message || ''
        const errorCode = error?.code || ''
        
        if (errorMessage.includes('column') || errorCode === '42703') {
          // Columns don't exist, try alternative approach
          const { data: gameData } = await supabase
            .from('games')
            .select('opponent, team_id')
            .eq('id', gameId)
            .single()
          
          if (!gameData) return defaultStatus
          
          // Get team names
          const { data: dodgersTeam } = await supabase
            .from('teams')
            .select('id, name')
            .eq('name', 'Dodgers')
            .maybeSingle()
          
          const homeTeamId = gameData.team_id || dodgersTeam?.id
          let opponentTeamId: string | undefined
          let opponentTeamName = gameData.opponent || 'Oponente'
          
          if (gameData.opponent) {
            const { data: opponentTeam } = await supabase
              .from('teams')
              .select('id, name')
              .eq('name', gameData.opponent)
              .maybeSingle()
            opponentTeamId = opponentTeam?.id
            opponentTeamName = opponentTeam?.name || gameData.opponent
          }
          
          // Check if templates exist for both teams
          let hasHomeLineup = false
          let hasOpponentLineup = false
          
          if (homeTeamId) {
            const { data: homeTemplate } = await supabase
              .from('lineup_templates')
              .select('id')
              .eq('team_id', homeTeamId)
              .limit(1)
            hasHomeLineup = !!homeTemplate && homeTemplate.length > 0
          }
          
          if (opponentTeamId) {
            const { data: opponentTemplate } = await supabase
              .from('lineup_templates')
              .select('id')
              .eq('team_id', opponentTeamId)
              .limit(1)
            hasOpponentLineup = !!opponentTemplate && opponentTemplate.length > 0
          }
          
          return {
            homeTeamSaved: hasHomeLineup,
            opponentTeamSaved: hasOpponentLineup,
            homeTeamName: 'Dodgers',
            opponentTeamName: opponentTeamName
          }
        } else {
          console.error('Error checking lineups:', error)
          return defaultStatus
        }
      }

      // Check if columns exist in the data
      const gameData = data as { lineup_template_id?: string; opponent_lineup_template_id?: string; opponent?: string }
      const homeLineupId = gameData?.lineup_template_id
      const opponentLineupId = gameData?.opponent_lineup_template_id
      
      // Get team names
      const homeTeamName = 'Dodgers'
      let opponentTeamName = gameData?.opponent || 'Oponente'
      
      if (opponentTeamName && opponentTeamName !== 'Oponente') {
        const { data: opponentTeam } = await supabase
          .from('teams')
          .select('name')
          .eq('name', opponentTeamName)
          .maybeSingle()
        if (opponentTeam) {
          opponentTeamName = opponentTeam.name
        }
      }

      return {
        homeTeamSaved: !!homeLineupId,
        opponentTeamSaved: !!opponentLineupId,
        homeTeamName: homeTeamName,
        opponentTeamName: opponentTeamName
      }
    } catch (err) {
      console.error('Failed to check lineups:', err)
      return defaultStatus
    }
  }

  // Check if both lineups are saved for a game (for backward compatibility)
  async function checkBothLineupsSaved(gameId: string): Promise<boolean> {
    try {
      // First try to get all fields
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (error) {
        // Check if it's a column error (columns don't exist)
        const errorMessage = error?.message || ''
        const errorCode = error?.code || ''
        
        if (errorMessage.includes('column') || errorCode === '42703') {
          // Columns don't exist, try alternative approach
          console.log('Lineup template columns not found, checking via lineup_templates table...')
          
          // Try to find lineups by checking if templates exist for the game's teams
          const { data: gameData } = await supabase
            .from('games')
            .select('opponent, team_id')
            .eq('id', gameId)
            .single()
          
          if (!gameData) return false
          
          // Check for Dodgers lineup (home team)
          const { data: dodgersTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('name', 'Dodgers')
            .maybeSingle()
          
          const homeTeamId = gameData.team_id || dodgersTeam?.id
          
          // Check for opponent lineup
          let opponentTeamId: string | undefined
          if (gameData.opponent) {
            const { data: opponentTeam } = await supabase
              .from('teams')
              .select('id')
              .eq('name', gameData.opponent)
              .maybeSingle()
            opponentTeamId = opponentTeam?.id
          }
          
          // Check if templates exist for both teams
          let hasHomeLineup = false
          let hasOpponentLineup = false
          
          if (homeTeamId) {
            const { data: homeTemplate } = await supabase
              .from('lineup_templates')
              .select('id')
              .eq('team_id', homeTeamId)
              .limit(1)
            hasHomeLineup = !!homeTemplate && homeTemplate.length > 0
          }
          
          if (opponentTeamId) {
            const { data: opponentTemplate } = await supabase
              .from('lineup_templates')
              .select('id')
              .eq('team_id', opponentTeamId)
              .limit(1)
            hasOpponentLineup = !!opponentTemplate && opponentTemplate.length > 0
          }
          
          return hasHomeLineup && hasOpponentLineup
        } else {
          console.error('Error checking lineups:', error)
          return false
        }
      }

      // Check if columns exist in the data
      const gameData = data as { lineup_template_id?: string; opponent_lineup_template_id?: string }
      const hasHomeLineup = !!gameData?.lineup_template_id
      const hasOpponentLineup = !!gameData?.opponent_lineup_template_id

      // If columns don't exist in response, try alternative check
      if (hasHomeLineup === undefined && hasOpponentLineup === undefined) {
        // Fallback: check via lineup_templates table
        const { data: gameData } = await supabase
          .from('games')
          .select('opponent, team_id')
          .eq('id', gameId)
          .single()
        
        if (!gameData) return false
        
        const { data: dodgersTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('name', 'Dodgers')
          .maybeSingle()
        
        const homeTeamId = gameData.team_id || dodgersTeam?.id
        
        let opponentTeamId: string | undefined
        if (gameData.opponent) {
          const { data: opponentTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('name', gameData.opponent)
            .maybeSingle()
          opponentTeamId = opponentTeam?.id
        }
        
        let hasHome = false
        let hasOpponent = false
        
        if (homeTeamId) {
          const { data: homeTemplate } = await supabase
            .from('lineup_templates')
            .select('id')
            .eq('team_id', homeTeamId)
            .limit(1)
          hasHome = !!homeTemplate && homeTemplate.length > 0
        }
        
        if (opponentTeamId) {
          const { data: opponentTemplate } = await supabase
            .from('lineup_templates')
            .select('id')
            .eq('team_id', opponentTeamId)
            .limit(1)
          hasOpponent = !!opponentTemplate && opponentTemplate.length > 0
        }
        
        return hasHome && hasOpponent
      }

      // Both lineups must exist
      return hasHomeLineup && hasOpponentLineup
    } catch (err) {
      console.error('Failed to check lineups:', err)
      return false
    }
  }
  
  // Check lineup status for all games
  async function updateLineupStatusForAllGames() {
    if (games.length > 0) {
      const statusPromises = games.map(async (game) => {
        const status = await checkLineupStatus(game.id)
        return { gameId: game.id, status }
      })
      
      const results = await Promise.all(statusPromises)
      const newStatus: Record<string, {
        homeTeamSaved: boolean
        opponentTeamSaved: boolean
        homeTeamName: string
        opponentTeamName: string
      }> = {}
      
      results.forEach(({ gameId, status }) => {
        newStatus[gameId] = status
      })
      
      setGamesLineupStatus(newStatus)
    }
  }

  // Handle scorebook access with validation
  async function handleScorebookAccess(gameId: string) {
    const bothLineupsSaved = await checkBothLineupsSaved(gameId)
    
    if (!bothLineupsSaved) {
      alert('Both team lineups must be saved before starting the scorebook. Please select lineups for Dodgers (home team) and the opponent team first.')
      return
    }

    setShowScorebook(gameId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      // Find or get Dodgers team ID
      let dodgersTeamId: string | null = null
      
      // First, try to find Dodgers team
      const { data: dodgersTeam, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('name', 'Dodgers')
        .maybeSingle()

      if (teamError) {
        console.error('Error finding Dodgers team:', teamError)
      } else if (dodgersTeam) {
        dodgersTeamId = dodgersTeam.id
      } else {
        // Create Dodgers team if it doesn't exist
        const { data: newDodgersTeam, error: createError } = await supabase
          .from('teams')
          .insert([{
            name: 'Dodgers',
            city: 'Los Angeles'
          }])
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating Dodgers team:', createError)
          setError('Failed to create Dodgers team. Please ensure Dodgers team exists.')
          setSubmitting(false)
          return
        } else if (newDodgersTeam) {
          dodgersTeamId = newDodgersTeam.id
        }
      }

      // Create game with Dodgers as the home team
      const gameData: {
        opponent: string
        game_date: string
        game_time: string
        stadium: string
        weather_conditions: string
        our_score: number
        opponent_score: number
        innings_played: number
        game_status: string
        team_id?: string
      } = {
        ...formData,
        our_score: 0,
        opponent_score: 0,
        innings_played: 0,
        game_status: 'scheduled'
      }

      // Add team_id if the column exists
      if (dodgersTeamId) {
        gameData.team_id = dodgersTeamId
      }

      const { data, error } = await supabase
        .from('games')
        .insert([gameData])
        .select('*')

      if (error) {
        // If team_id column doesn't exist, try without it
        if (error.message.includes('column') || error.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('games')
            .insert([{
              ...formData,
              our_score: 0,
              opponent_score: 0,
              innings_played: 0,
              game_status: 'scheduled'
            }])
            .select('*')

          if (fallbackError) {
            setError(fallbackError.message)
            setSubmitting(false)
            return
          } else {
            setNewGameId(fallbackData[0].id)
            setGameCreationStep('ourLineup')
            setShowLineupSelection(fallbackData[0].id)
            setSubmitting(false)
            return
          }
        } else {
          setError(error.message)
          setSubmitting(false)
          return
        }
      } else {
        // Store the new game ID and move to lineup selection step
        setNewGameId(data[0].id)
        setGameCreationStep('ourLineup')
        setShowLineupSelection(data[0].id)
        setSubmitting(false)
        // Don't close the form yet - wait for lineups to be selected
      }
    } catch (err) {
      setError('Failed to create game')
      setSubmitting(false)
    }
  }

  async function handleLineupSelected(gameId: string, isOpponent: boolean = false) {
    if (isOpponent) {
      // Opponent lineup selected, finish game creation
      await fetchGames()
      setFormData({
        opponent: '',
        game_date: '',
        game_time: '',
        stadium: '',
        weather_conditions: ''
      })
      setShowNewGameForm(false)
      setShowLineupSelection(null)
      setShowOpponentLineup(null)
      setGameCreationStep('info')
      setNewGameId(null)
    } else {
      // Our lineup selected, now show opponent lineup
      setGameCreationStep('opponentLineup')
      setShowLineupSelection(null)
      setShowOpponentLineup(gameId)
    }
  }

  async function updateGameStatus(gameId: string, status: string) {
    try {
      const { error } = await supabase
        .from('games')
        .update({ game_status: status })
        .eq('id', gameId)

      if (error) {
        console.error('Error updating game status:', error)
        alert('Error al actualizar el estado del juego')
        return
      }

      // Refresh games list
      await fetchGames()
    } catch (error) {
      console.error('Error updating game status:', error)
      alert('Error al actualizar el estado del juego')
    }
  }

  async function clearGameData(gameId: string) {
    if (!confirm('¿Estás seguro de que quieres limpiar todos los datos del juego? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      // Delete all at-bats for this game
      const { error: atBatsError } = await supabase
        .from('at_bats')
        .delete()
        .eq('game_id', gameId)

      if (atBatsError) {
        console.error('Error clearing at-bats:', atBatsError)
        alert('Error al limpiar los datos del juego')
        return
      }

      // Reset game scores, status, lineups, and home/away assignment
      const { error: gameError } = await supabase
        .from('games')
        .update({
          our_score: 0,
          opponent_score: 0,
          innings_played: 0,
          game_status: 'scheduled',
          lineup_template_id: null,
          opponent_lineup_template_id: null,
          home_team_id: null,
          away_team_id: null
        })
        .eq('id', gameId)

      if (gameError) {
        console.error('Error resetting game:', gameError)
        alert('Error al resetear el juego')
        return
      }

      // Refresh games list
      await fetchGames()
      alert('Datos del juego limpiados exitosamente')
    } catch (err) {
      console.error('Error clearing game data:', err)
      alert('Error al limpiar los datos del juego')
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'postponed': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function formatGameTime(time: string) {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading games...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800">{t.gamesCount} ({games.length})</h3>
        <button
          onClick={() => setShowNewGameForm(!showNewGameForm)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm w-full sm:w-auto"
        >
          {showNewGameForm ? t.cancel : t.newGame}
        </button>
      </div>

      {showNewGameForm && gameCreationStep === 'info' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-6">
          <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">{t.createNewGame}</h4>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">{t.opponent} *</label>
                <input
                  type="text"
                  required
                  value={formData.opponent}
                  onChange={(e) => setFormData({...formData, opponent: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Yankees, Red Sox, etc."
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">{t.gameDate} *</label>
                <input
                  type="date"
                  required
                  value={formData.game_date}
                  onChange={(e) => setFormData({...formData, game_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">{t.gameTime}</label>
                <input
                  type="time"
                  value={formData.game_time}
                  onChange={(e) => setFormData({...formData, game_time: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">{t.stadium}</label>
                <input
                  type="text"
                  value={formData.stadium}
                  onChange={(e) => setFormData({...formData, stadium: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Yankee Stadium"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">{t.weather}</label>
                <input
                  type="text"
                  value={formData.weather_conditions}
                  onChange={(e) => setFormData({...formData, weather_conditions: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Sunny, 75°F"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewGameForm(false)
                  setGameCreationStep('info')
                  setNewGameId(null)
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? t.creating : t.nextSelectLineup}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step indicator when in lineup selection */}
      {(gameCreationStep === 'ourLineup' || gameCreationStep === 'opponentLineup') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-base sm:text-lg font-semibold text-gray-800">
              {gameCreationStep === 'ourLineup' ? t.step2SelectLineup : t.step3EnterOpponent}
            </h4>
            <button
              onClick={() => {
                setShowNewGameForm(false)
                setShowLineupSelection(null)
                setShowOpponentLineup(null)
                setGameCreationStep('info')
                setNewGameId(null)
              }}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
          <div className="flex space-x-2 mb-2">
            <div className={`flex-1 h-2 rounded ${gameCreationStep === 'ourLineup' ? 'bg-blue-600' : 'bg-green-600'}`}></div>
            <div className={`flex-1 h-2 rounded ${gameCreationStep === 'opponentLineup' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          </div>
        </div>
      )}

      {games.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">{t.noItemsFound} {t.gamesCount.toLowerCase()}. {t.addFirstItem}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => (
            <div key={game.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-6 shadow-sm">
              <div className="mb-3 sm:mb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2">
                  <div className="flex-1 mb-2 sm:mb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-2">
                      <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-0">
                        vs {game.opponent}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded w-fit ${getStatusColor(game.game_status)}`}>
                        {game.game_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                      <p>{t.date}: {new Date(game.game_date).toLocaleDateString()}</p>
                      {game.game_time && <p>{t.time}: {formatGameTime(game.game_time)}</p>}
                      {game.stadium && <p>{t.stadium}: {game.stadium}</p>}
                      {game.weather_conditions && <p>{t.weather}: {game.weather_conditions}</p>}
                    </div>
                  </div>
                  <div className="text-center sm:text-right">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                      {game.our_score} - {game.opponent_score}
                    </div>
                    {game.game_status === 'scheduled' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={async () => {
                          const bothLineupsSaved = await checkBothLineupsSaved(game.id)
                          if (!bothLineupsSaved) {
                            alert('Ambas alineaciones deben estar guardadas antes de iniciar la anotación. Por favor selecciona las alineaciones para Dodgers (equipo local) y el equipo visitante primero.')
                            return
                          }
                          updateGameStatus(game.id, 'in_progress')
                          setShowScorebook(game.id)
                        }}
                        disabled={!gamesLineupStatus[game.id]?.homeTeamSaved || !gamesLineupStatus[game.id]?.opponentTeamSaved}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs w-full sm:w-auto"
                        title={
                          !gamesLineupStatus[game.id]?.homeTeamSaved || !gamesLineupStatus[game.id]?.opponentTeamSaved
                            ? "Ambas alineaciones deben estar guardadas"
                            : "Iniciar anotación"
                        }
                      >
                        {t.startScoring}
                      </button>
                      <button
                        onClick={() => setShowLineupSelection(game.id)}
                        className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-xs w-full sm:w-auto"
                      >
                        {t.selectLineup}
                      </button>
                    </div>
                  )}
                  
                  {/* Lineup Status Section - Compact - Below buttons */}
                  {game.game_status === 'scheduled' && gamesLineupStatus[game.id] && (
                    <div className="mt-2 flex justify-center sm:justify-end">
                      <div className="flex items-center gap-3 text-xs">
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                          gamesLineupStatus[game.id]?.homeTeamSaved 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-red-50 text-red-700'
                        }`}>
                          <span className="text-xs font-bold">
                            {gamesLineupStatus[game.id]?.homeTeamSaved ? '✓' : '✗'}
                          </span>
                          <span className="font-medium">
                            {gamesLineupStatus[game.id]?.homeTeamName || 'Dodgers'}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                          gamesLineupStatus[game.id]?.opponentTeamSaved 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-red-50 text-red-700'
                        }`}>
                          <span className="text-xs font-bold">
                            {gamesLineupStatus[game.id]?.opponentTeamSaved ? '✓' : '✗'}
                          </span>
                          <span className="font-medium">
                            {gamesLineupStatus[game.id]?.opponentTeamName || 'Oponente'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {game.game_status === 'in_progress' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={async () => {
                          const bothLineupsSaved = await checkBothLineupsSaved(game.id)
                          if (!bothLineupsSaved) {
                            alert('Both team lineups must be saved before accessing the scorebook. Please select lineups for Dodgers (home team) and the opponent team first.')
                            return
                          }
                          setShowScorebook(game.id)
                        }}
                        className="bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 text-xs w-full sm:w-auto"
                      >
                        {t.continueScoring}
                      </button>
                      <button
                        onClick={() => setShowStatistics(game.id)}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-xs w-full sm:w-auto"
                      >
                        {t.viewStatistics}
                      </button>
                      <button
                        onClick={() => clearGameData(game.id)}
                        className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 text-xs w-full sm:w-auto"
                      >
                        {t.clearGameData}
                      </button>
                    </div>
                  )}
                  {game.game_status === 'completed' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={async () => {
                          const bothLineupsSaved = await checkBothLineupsSaved(game.id)
                          if (!bothLineupsSaved) {
                            alert('Both team lineups must be saved before viewing the scorebook. Please select lineups for both teams first.')
                            return
                          }
                          setShowScorebook(game.id)
                        }}
                        className="bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 text-xs w-full sm:w-auto"
                      >
                        {t.viewScorebook}
                      </button>
                      <button
                        onClick={() => setShowStatistics(game.id)}
                        className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-xs w-full sm:w-auto"
                      >
                        {t.viewStatistics}
                      </button>
                      <button
                        onClick={() => clearGameData(game.id)}
                        className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 text-xs w-full sm:w-auto"
                      >
                        {t.clearData}
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Digital Scorebook Modal */}
      {showScorebook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg w-full h-[95vh] overflow-y-auto">
            <div className="p-4">
              <TraditionalScorebook 
                game={games.find(g => g.id === showScorebook)!} 
                onClose={() => setShowScorebook(null)} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Statistics Modal */}
      {showStatistics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg w-full h-[95vh] overflow-y-auto">
            <div className="p-4">
              <HitStatistics 
                gameId={showStatistics} 
                onClose={() => setShowStatistics(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Our Team Lineup Selection Modal */}
      {showLineupSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{t.selectOurLineup}</h3>
                <button
                  onClick={() => {
                    setShowLineupSelection(null)
                    if (newGameId) {
                      setGameCreationStep('info')
                      setNewGameId(null)
                    }
                  }}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
              <LineupSelection 
                gameId={showLineupSelection}
                onClose={() => {
                  // When lineup is saved, move to opponent lineup (only for new games)
                  if (newGameId === showLineupSelection) {
                    handleLineupSelected(showLineupSelection, false)
                  } else {
                    setShowLineupSelection(null)
                  }
                }}
                onStartScoring={() => {
                  // Start scoring when both lineups are saved
                  if (showLineupSelection) {
                    setShowLineupSelection(null)
                    setShowScorebook(showLineupSelection)
                  }
                }}
                onLineupSaved={async () => {
                  // Refresh lineup status when a lineup is saved
                  if (showLineupSelection) {
                    const status = await checkLineupStatus(showLineupSelection)
                    setGamesLineupStatus(prev => ({ ...prev, [showLineupSelection]: status }))
                  }
                  // Also refresh all games status
                  await updateLineupStatusForAllGames()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Opponent Lineup Entry Modal */}
      {showOpponentLineup && (
        <OpponentLineupEntry
          gameId={showOpponentLineup}
          opponentName={games.find(g => g.id === showOpponentLineup)?.opponent || formData.opponent}
          onClose={() => {
            if (newGameId === showOpponentLineup) {
              handleLineupSelected(showOpponentLineup, true)
            } else {
              setShowOpponentLineup(null)
            }
          }}
        />
      )}
    </div>
  )
}
