'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Team {
  id: string
  name: string
  city: string
  lineup?: string[]
  players?: Player[]
}

interface Player {
  id: string
  first_name: string
  last_name: string
  jersey_number: number
  positions: string[]
}

interface LineupEntry {
  playerId: string
  position: string
}

interface LineupSelectionProps {
  teamId?: string
  gameId?: string
  onClose: () => void
  onStartScoring?: (gameId: string) => void
}

interface GameInfo {
  id: string
  opponent: string
  team_id?: string | null  // Optional - may not exist in all database schemas
  lineup_template_id?: string | null
  opponent_lineup_template_id?: string | null
  batting_first?: 'home' | 'opponent' | null
}

export default function LineupSelection({ teamId, gameId, onClose, onStartScoring }: LineupSelectionProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [gameTeams, setGameTeams] = useState<{ ourTeam: Team | null, opponentTeam: Team | null }>({ ourTeam: null, opponentTeam: null })
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [lineupEntries, setLineupEntries] = useState<LineupEntry[]>([])
  const [hasDH, setHasDH] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'select' | 'create'>('select') // New mode for template selection
  const [homeTeam, setHomeTeam] = useState<'our' | 'opponent' | null>(null)
  interface LineupTemplatePlayer {
    player_id: string
    position: string
    batting_order: number
    players?: { id: string; first_name: string; last_name: string; jersey_number: number }
  }
  
  interface LineupTemplate {
    id: string
    name: string
    team_id?: string
    lineup_template_players?: LineupTemplatePlayer[]
  }
  
  const [savedTemplates, setSavedTemplates] = useState<LineupTemplate[]>([]) // Store saved templates from database

  const fieldPositions = [
    'Lanzador (P)',
    'Receptor (C)', 
    'Primera Base (1B)',
    'Segunda Base (2B)',
    'Tercera Base (3B)',
    'Campo Corto (SS)',
    'Jardinero Izquierdo (LF)',
    'Jardinero Central (CF)',
    'Jardinero Derecho (RF)',
    'Bateador Designado (DH)'
  ]

  useEffect(() => {
    if (gameId) {
      fetchGameInfo()
    } else {
      fetchTeams()
    }
    if (selectedTeam) {
      fetchSavedTemplates()
    }
  }, [selectedTeam, gameId])
  
  // Debug: Log when gameInfo changes
  useEffect(() => {
    if (gameInfo) {
      console.log('🔄 gameInfo state changed:', {
        lineup_template_id: gameInfo.lineup_template_id,
        opponent_lineup_template_id: gameInfo.opponent_lineup_template_id,
        batting_first: gameInfo.batting_first
      })
    }
  }, [gameInfo])

  useEffect(() => {
    if (teamId && teams.length > 0) {
      selectTeam(teamId)
      // If gameId is provided, start in select mode
      if (gameId) {
        setMode('select')
      }
    }
    // If no teamId but gameId is provided, we'll show team selection first
  }, [teamId, teams, gameId])

  async function fetchGameInfo() {
    if (!gameId) return
    
    try {
      setLoading(true)
      
      // First try with all possible fields
      let gameData: any = null
      let gameError: any = null
      
      const { data, error } = await supabase
        .from('games')
        .select('id, opponent, lineup_template_id, opponent_lineup_template_id, batting_first')
        .eq('id', gameId)
        .single()
      
      if (error) {
        // If error, try with just basic fields
        console.log('Error with full query, trying basic fields:', error.message)
        const { data: basicData, error: basicError } = await supabase
          .from('games')
          .select('id, opponent')
          .eq('id', gameId)
          .single()
        
        if (basicError) {
          console.error('Error fetching game (basic):', JSON.stringify(basicError, null, 2))
          setError(`Error al cargar la información del juego: ${basicError.message || 'Unknown error'}`)
          setLoading(false)
          return
        }
        
        // Set basic data and explicitly set optional fields to null
        gameData = {
          ...basicData,
          lineup_template_id: null,
          opponent_lineup_template_id: null,
          batting_first: null
        }
      } else {
        gameData = data
      }
      
      if (!gameData) {
        setError('Juego no encontrado')
        setLoading(false)
        return
      }
      
      setGameInfo(gameData as GameInfo)
      
      // Fetch all teams to find our team and opponent team
      const { data: allTeams, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          city,
          players (
            id,
            first_name,
            last_name,
            jersey_number,
            positions
          )
        `)
        .order('name')
      
      if (teamsError) {
        console.error('Error fetching teams:', teamsError)
        setError('Error al cargar los equipos')
        setLoading(false)
        return
      }
      
      // Find our team (by team_id or find team that's not the opponent)
      let ourTeam: Team | null = null
      let opponentTeam: Team | null = null
      
      if (gameData?.team_id) {
        ourTeam = (allTeams || []).find(t => t.id === gameData.team_id) || null
      }
      
      // If no team_id or team not found, find team that's NOT the opponent
      // Prefer teams with more players (likely our main team)
      if (!ourTeam) {
        const nonOpponentTeams = (allTeams || []).filter(t => t.name !== gameData?.opponent)
        // Sort by number of players (descending) and take the first one
        ourTeam = nonOpponentTeams.sort((a, b) => (b.players?.length || 0) - (a.players?.length || 0))[0] || null
      }
      
      // Find opponent team by matching name
      opponentTeam = (allTeams || []).find(t => t.name === gameData.opponent) || null
      
      setGameTeams({ ourTeam, opponentTeam })
      
      // Set teams array to only include the 2 teams playing
      const gameTeamsArray: Team[] = []
      if (ourTeam) gameTeamsArray.push(ourTeam)
      if (opponentTeam) gameTeamsArray.push(opponentTeam)
      setTeams(gameTeamsArray)
      
      // Set home team based on batting_first
      if (gameData.batting_first === 'home') {
        setHomeTeam('our')
      } else if (gameData.batting_first === 'opponent') {
        setHomeTeam('opponent')
      }
      
    } catch (err) {
      console.error('Failed to fetch game info:', err)
      setError('Error al cargar la información del juego')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTeams() {
    try {
      // First try to fetch teams with lineup field
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          city,
          lineup,
          players (
            id,
            first_name,
            last_name,
            jersey_number,
            positions
          )
        `)
        .order('name')

      // If lineup field doesn't exist, fetch without it
      if (error && error.message.includes('lineup')) {
        console.log('Lineup field not found, fetching without it...')
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('teams')
          .select(`
            id,
            name,
            city,
            players (
              id,
              first_name,
              last_name,
              jersey_number,
              positions
            )
          `)
          .order('name')
        
        if (fallbackError) {
          console.error('Error fetching teams (fallback):', fallbackError)
          setError('Error al cargar los equipos')
        } else {
          // Add empty lineup field to each team
          const teamsWithLineup = (fallbackData || []).map(team => ({
            ...team,
            lineup: []
          }))
          setTeams(teamsWithLineup)
        }
      } else if (error) {
        console.error('Error fetching teams:', error)
        setError('Error al cargar los equipos')
      } else {
        setTeams(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err)
      setError('Error al cargar los equipos')
    } finally {
      setLoading(false)
    }
  }

  async function selectTeam(teamId: string) {
    const team = teams.find(t => t.id === teamId)
    if (team) {
      setSelectedTeam(teamId)
      
      // If gameId is provided, check if this team has a saved lineup
      if (gameId && gameInfo) {
        const isOurTeam = teamId === gameTeams.ourTeam?.id
        const isOpponentTeam = teamId === gameTeams.opponentTeam?.id
        const templateId = isOurTeam ? gameInfo.lineup_template_id : 
                          isOpponentTeam ? gameInfo.opponent_lineup_template_id : null
        
        if (templateId) {
          // Load existing lineup from database
          try {
            const { data: templatePlayers, error } = await supabase
              .from('lineup_template_players')
              .select(`
                player_id,
                position,
                batting_order,
                players (
                  id,
                  first_name,
                  last_name,
                  jersey_number
                )
              `)
              .eq('template_id', templateId)
              .order('batting_order')
            
            if (!error && templatePlayers) {
              const loadedEntries: LineupEntry[] = templatePlayers.map((tp: any) => ({
                playerId: tp.player_id,
                position: getPositionFromDb(tp.position)
              }))
              setLineupEntries(loadedEntries)
              
              // Check if DH is in the lineup
              const hasDHInLineup = loadedEntries.some(entry => 
                entry.position === 'Bateador Designado (DH)'
              )
              setHasDH(hasDHInLineup)
              
              // If mode is 'create', we're editing, so stay in create mode
              // Otherwise, switch to select mode to show templates
              if (mode !== 'create') {
                setMode('select')
              }
              return
            }
          } catch (err) {
            console.error('Error loading saved lineup from database:', err)
          }
        }
      }
      
      // Try to load existing lineup from localStorage as fallback
      const savedLineup = localStorage.getItem(`lineup_${teamId}`)
      if (savedLineup) {
        try {
          const lineupData = JSON.parse(savedLineup)
          if (lineupData.lineup && Array.isArray(lineupData.lineup)) {
            setLineupEntries(lineupData.lineup)
            // Check if DH is in the lineup
            const hasDHInLineup = lineupData.lineup.some((entry: LineupEntry) => 
              entry.position === 'Bateador Designado (DH)'
            )
            setHasDH(hasDHInLineup)
            return
          }
        } catch (error) {
          console.log('Error loading saved lineup:', error)
        }
      }
      
      // Initialize empty lineup entries - create 9 or 10 entries based on DH
      const initialEntries: LineupEntry[] = []
      const maxEntries = hasDH ? 10 : 9
      for (let i = 0; i < maxEntries; i++) {
        initialEntries.push({ playerId: '', position: '' })
      }
      setLineupEntries(initialEntries)
    }
  }

  function updatePlayerInLineup(index: number, playerId: string) {
    const newEntries = [...lineupEntries]
    newEntries[index] = { ...newEntries[index], playerId }
    setLineupEntries(newEntries)
  }

  function updatePositionInLineup(index: number, position: string) {
    const newEntries = [...lineupEntries]
    newEntries[index] = { ...newEntries[index], position }
    setLineupEntries(newEntries)
    
    // Check if DH is selected to show/hide 10th row
    const hasDHSelected = position === 'Bateador Designado (DH)'
    setHasDH(hasDHSelected)
    
    // If DH is removed, hide 10th row
    if (!hasDHSelected && lineupEntries.length === 10) {
      const newEntriesWithoutDH = newEntries.slice(0, 9)
      setLineupEntries(newEntriesWithoutDH)
    }
  }

  function getAvailablePlayers() {
    if (!selectedTeam) return []
    const team = teams.find(t => t.id === selectedTeam)
    if (!team?.players) return []
    
    const usedPlayerIds = lineupEntries.map(entry => entry.playerId).filter(id => id !== '')
    return team.players.filter(player => !usedPlayerIds.includes(player.id))
  }

  function getAvailablePositions(currentIndex: number) {
    const usedPositions = lineupEntries
      .map((entry, index) => index !== currentIndex ? entry.position : '')
      .filter(position => position !== '')
    
    return fieldPositions.filter(position => !usedPositions.includes(position))
  }

  async function fetchSavedTemplates() {
    if (!selectedTeam) return
    
    try {
      // Fetch lineup templates from database for this team
      const { data: templates, error: templateError } = await supabase
        .from('lineup_templates')
        .select(`
          id,
          name,
          team_id,
          lineup_template_players (
            player_id,
            batting_order,
            position,
            players (
              id,
              first_name,
              last_name,
              jersey_number
            )
          )
        `)
        .eq('team_id', selectedTeam)
        .order('updated_at', { ascending: false })

      if (templateError) {
        console.error('Error fetching templates:', templateError)
        // Fallback to localStorage
        const savedLineup = localStorage.getItem(`lineup_${selectedTeam}`)
        if (savedLineup) {
          try {
            const lineupData = JSON.parse(savedLineup)
            if (lineupData.lineup && Array.isArray(lineupData.lineup)) {
              // Convert local storage format to template format
              const template: LineupTemplate = {
                id: 'local',
                name: 'Local Lineup',
                lineup_template_players: lineupData.lineup.map((entry: { playerId: string; position: string }, index: number) => ({
                  player_id: entry.playerId,
                  position: entry.position,
                  batting_order: index + 1
                }))
              }
              setSavedTemplates([template])
            }
          } catch (error) {
            console.log('Error parsing saved lineup:', error)
          }
        }
      } else {
        // Cast templates to LineupTemplate[] - Supabase returns the correct structure
        // Note: players comes as array from Supabase but we use the first element
        setSavedTemplates((templates as unknown as LineupTemplate[]) || [])
      }
    } catch (err) {
      console.error('Failed to fetch saved templates:', err)
    }
  }

  function getPositionFromDb(dbPosition: string): string {
    const positionMap: { [key: string]: string } = {
      'P': 'Lanzador (P)',
      'C': 'Receptor (C)',
      '1B': 'Primera Base (1B)',
      '2B': 'Segunda Base (2B)',
      '3B': 'Tercera Base (3B)',
      'SS': 'Campo Corto (SS)',
      'LF': 'Jardinero Izquierdo (LF)',
      'CF': 'Jardinero Central (CF)',
      'RF': 'Jardinero Derecho (RF)',
      'DH': 'Bateador Designado (DH)'
    }
    return positionMap[dbPosition] || dbPosition
  }

  function getSavedLineupTemplates(teamId: string) {
    const savedLineup = localStorage.getItem(`lineup_${teamId}`)
    if (savedLineup) {
      try {
        const lineupData = JSON.parse(savedLineup)
        if (lineupData.lineup && Array.isArray(lineupData.lineup)) {
          return lineupData.lineup
        }
      } catch (error) {
        console.log('Error parsing saved lineup:', error)
      }
    }
    return null
  }

  function getAllSavedTemplates() {
    const templates = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('lineup_')) {
        const teamId = key.replace('lineup_', '')
        const team = teams.find(t => t.id === teamId)
        if (team) {
          const template = getSavedLineupTemplates(teamId)
          if (template) {
            templates.push({
              teamId,
              teamName: team.name,
              template,
              timestamp: new Date().toISOString() // We could store this when saving
            })
          }
        }
      }
    }
    return templates
  }

  function selectLineupTemplate(template: LineupEntry[]) {
    setLineupEntries(template)
    // Check if DH is in the template
    const hasDHInTemplate = template.some(entry => entry.position === 'Bateador Designado (DH)')
    setHasDH(hasDHInTemplate)
    setMode('create') // Switch to create mode to allow editing
  }

  async function saveLineup() {
    if (!selectedTeam) return

    // If in select mode and gameId is provided, just link the game to the team
    if (mode === 'select' && gameId) {
      setSaving(true)
      try {
        // Link game to team (with fallback to localStorage)
        try {
          const { error: gameError } = await supabase
            .from('games')
            .update({ team_id: selectedTeam })
            .eq('id', gameId)

          if (gameError) {
            console.log('Team_id field not found in games table, saving locally...')
            console.log('Game error details:', gameError)
            // Save game-team link locally as fallback
            const gameTeamLink = {
              gameId: gameId,
              teamId: selectedTeam,
              timestamp: new Date().toISOString()
            }
            localStorage.setItem(`game_team_${gameId}`, JSON.stringify(gameTeamLink))
          } else {
            console.log('Game linked to team successfully')
          }
        } catch (gameLinkError) {
          console.log('Team_id field not available, saving locally...')
          console.log('Game link error details:', gameLinkError)
          // Save game-team link locally as fallback
          const gameTeamLink = {
            gameId: gameId,
            teamId: selectedTeam,
            timestamp: new Date().toISOString()
          }
          localStorage.setItem(`game_team_${gameId}`, JSON.stringify(gameTeamLink))
        }

        // If gameId is provided, refresh game info and return to team selection
        if (gameId) {
          // Refresh game info to update lineup status
          await fetchGameInfo()
          
          // Reset to team selection mode
          setSelectedTeam(null)
          setMode('select')
          setLineupEntries([])
          
          alert('Plantilla seleccionada exitosamente')
          // Don't close - stay in modal to select other team's lineup
        } else {
          alert('Plantilla seleccionada exitosamente')
          onClose()
        }
      } catch (err) {
        console.error('Error linking game to team:', err)
        alert('Error al vincular el juego con el equipo')
      } finally {
        setSaving(false)
      }
      return
    }

    // For create mode, validate lineup
    const requiredEntries = hasDH ? 10 : 9
    const filledEntries = lineupEntries.slice(0, requiredEntries).filter(entry => 
      entry.playerId && entry.position
    )

    if (filledEntries.length !== requiredEntries) {
      alert(`Por favor complete todos los ${requiredEntries} posiciones requeridas`)
      return
    }

    // Validate no duplicate positions
    const positions = filledEntries.map(entry => entry.position)
    const uniquePositions = [...new Set(positions)]
    if (positions.length !== uniquePositions.length) {
      alert('No se pueden seleccionar posiciones duplicadas')
      return
    }

    setSaving(true)
    try {
      // Position mapping from Spanish to database format
      const positionMap: { [key: string]: string } = {
        'Lanzador (P)': 'P',
        'Receptor (C)': 'C',
        'Primera Base (1B)': '1B',
        'Segunda Base (2B)': '2B',
        'Tercera Base (3B)': '3B',
        'Campo Corto (SS)': 'SS',
        'Jardinero Izquierdo (LF)': 'LF',
        'Jardinero Central (CF)': 'CF',
        'Jardinero Derecho (RF)': 'RF',
        'Bateador Designado (DH)': 'DH'
      }

      // Create or update lineup template for this team
      const { data: existingTemplate } = await supabase
        .from('lineup_templates')
        .select('id')
        .eq('team_id', selectedTeam)
        .single()

      let templateId: string
      if (existingTemplate) {
        templateId = existingTemplate.id
        // Delete existing lineup template players
        await supabase
          .from('lineup_template_players')
          .delete()
          .eq('template_id', templateId)
      } else {
        // Create new template
        const { data: newTemplate, error: templateError } = await supabase
          .from('lineup_templates')
          .insert([{
            team_id: selectedTeam,
            name: 'Default Lineup'
          }])
          .select('id')
          .single()

        if (templateError || !newTemplate) {
          throw new Error('Failed to create lineup template')
        }
        templateId = newTemplate.id
      }

      // Create lineup template players
      const templatePlayers = filledEntries.map((entry, index) => ({
        template_id: templateId,
        player_id: entry.playerId,
        batting_order: index + 1,
        position: positionMap[entry.position] || 'DH'
      }))

      const { error: templatePlayersError } = await supabase
        .from('lineup_template_players')
        .insert(templatePlayers)

      if (templatePlayersError) {
        throw new Error('Failed to save lineup template players')
      }

      // Link game to team's lineup template (only if gameId is provided)
      if (gameId && gameInfo) {
        // Determine if this is our team or opponent team
        const isOurTeam = selectedTeam === gameTeams.ourTeam?.id
        const isOpponentTeam = selectedTeam === gameTeams.opponentTeam?.id
        
        console.log('🔍 Determining team type:', {
          selectedTeam,
          ourTeamId: gameTeams.ourTeam?.id,
          opponentTeamId: gameTeams.opponentTeam?.id,
          isOurTeam,
          isOpponentTeam
        })
        
        let updateData: any = {}
        if (isOurTeam) {
          updateData.lineup_template_id = templateId
          console.log('📌 This is OUR team - will update lineup_template_id')
        } else if (isOpponentTeam) {
          updateData.opponent_lineup_template_id = templateId
          console.log('📌 This is OPPONENT team - will update opponent_lineup_template_id')
        } else {
          // Default to our team if we can't determine
          updateData.lineup_template_id = templateId
          console.log('⚠️ Could not determine team type - defaulting to our team')
        }
        
        console.log('💾 Updating game in database with:', updateData)
        const { error: gameError } = await supabase
          .from('games')
          .update(updateData)
          .eq('id', gameId)

        if (gameError) {
          console.error('❌ Error linking game to lineup template:', gameError)
          alert(`Error al guardar: ${gameError.message}`)
          // Continue anyway - the template is saved
        } else {
          console.log('✅ Database update successful')
          // Update local gameInfo state immediately for instant UI update
          // This ensures the UI reflects the change before database refresh
          if (gameInfo) {
            const updatedGameInfo = { ...gameInfo }
            if (isOurTeam) {
              updatedGameInfo.lineup_template_id = templateId
              console.log('✅ Setting lineup_template_id for our team:', templateId)
            } else if (isOpponentTeam) {
              updatedGameInfo.opponent_lineup_template_id = templateId
              console.log('✅ Setting opponent_lineup_template_id for opponent team:', templateId)
            }
            console.log('📝 Updating gameInfo state from:', gameInfo)
            console.log('📝 Updating gameInfo state to:', updatedGameInfo)
            setGameInfo(updatedGameInfo)
            console.log('✅ gameInfo state updated - component should re-render now')
          } else {
            console.warn('⚠️ gameInfo is null, cannot update state')
          }
        }
      }

      // Refresh saved templates
      await fetchSavedTemplates()
      
      // If gameId is provided, refresh game info and return to team selection
      if (gameId) {
        // Reset to team selection mode (this will trigger re-render with updated gameInfo)
        // The gameInfo state was already updated above, so the UI should reflect the change
        setSelectedTeam(null)
        setMode('select')
        setLineupEntries([])
        
        // Don't call fetchGameInfo() immediately - it would overwrite our state update
        // The state is already updated correctly above, so the UI should show the correct status
        // We can refresh from database later if needed, but not immediately
        
        alert('Alineación guardada exitosamente')
        // Don't close - stay in modal to select other team's lineup
      } else {
        // If no gameId, close the modal (old behavior)
        alert('Alineación guardada exitosamente')
        onClose()
      }
    } catch (err) {
      console.error('Error saving lineup:', err)
      alert('Error al guardar la alineación')
    } finally {
      setSaving(false)
    }
  }

  function getPlayerName(playerId: string) {
    if (!selectedTeam) return ''
    const team = teams.find(t => t.id === selectedTeam)
    const player = team?.players?.find(p => p.id === playerId)
    return player ? `${player.first_name} ${player.last_name} #${player.jersey_number}` : ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando equipos...</span>
      </div>
    )
  }

  if (error) {
  return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={() => {
            setError(null)
            fetchTeams()
          }}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const currentTeam = selectedTeam ? teams.find(t => t.id === selectedTeam) : null
  const availablePlayers = getAvailablePlayers()
  const maxRows = hasDH ? 10 : 9

  return (
    <div className="space-y-6">
      {/* Home/Away Selection - Show if gameId provided */}
      {gameId && gameInfo && gameTeams.ourTeam && gameTeams.opponentTeam && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-md font-semibold text-gray-800">Equipo Local y Visitante:</h4>
            {/* Toggle Switch */}
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${gameInfo.batting_first === 'home' ? 'text-blue-600' : 'text-gray-600'}`}>
                {gameTeams.ourTeam.name}
              </span>
              <button
                onClick={async () => {
                  const newBattingFirst = gameInfo.batting_first === 'home' ? 'opponent' : 'home'
                  const { error } = await supabase
                    .from('games')
                    .update({ batting_first: newBattingFirst })
                    .eq('id', gameId)
                  if (!error && gameInfo) {
                    setGameInfo({ ...gameInfo, batting_first: newBattingFirst })
                    setHomeTeam(newBattingFirst === 'home' ? 'our' : 'opponent')
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  gameInfo.batting_first === 'home' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    gameInfo.batting_first === 'home' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${gameInfo.batting_first === 'opponent' ? 'text-blue-600' : 'text-gray-600'}`}>
                {gameTeams.opponentTeam.name}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gameTeams.ourTeam && (
              <div className={`p-4 border-2 rounded-lg ${
                gameInfo.batting_first === 'home' 
                  ? 'border-blue-500 bg-blue-100' 
                  : 'border-gray-300 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-gray-900">{gameTeams.ourTeam.name}</h5>
                  {gameInfo.batting_first === 'home' ? (
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Local</span>
                  ) : (
                    <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Visitante</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{gameTeams.ourTeam.city}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {gameTeams.ourTeam.players?.length || 0} jugadores
                </p>
                {gameInfo.lineup_template_id && gameInfo.lineup_template_id !== null && gameInfo.lineup_template_id !== '' && gameInfo.lineup_template_id.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      ✓ Alineación elegida
                    </span>
                  </div>
                )}
              </div>
            )}
            {gameTeams.opponentTeam && (
              <div className={`p-4 border-2 rounded-lg ${
                gameInfo.batting_first === 'opponent' 
                  ? 'border-blue-500 bg-blue-100' 
                  : 'border-gray-300 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-gray-900">{gameTeams.opponentTeam.name}</h5>
                  {gameInfo.batting_first === 'opponent' ? (
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Local</span>
                  ) : (
                    <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Visitante</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{gameTeams.opponentTeam.city}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {gameTeams.opponentTeam.players?.length || 0} jugadores
                </p>
                {gameInfo.opponent_lineup_template_id && gameInfo.opponent_lineup_template_id !== null && gameInfo.opponent_lineup_template_id !== '' && gameInfo.opponent_lineup_template_id.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      ✓ Alineación elegida
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Start Scoring Button - Show when all conditions are met */}
          {gameInfo.lineup_template_id && 
           gameInfo.opponent_lineup_template_id && 
           gameInfo.batting_first && (
            <div className="mt-4 pt-4 border-t border-blue-300">
              <button
                onClick={async () => {
                  if (!gameId || !onStartScoring) return
                  
                  // Update game status to in_progress
                  const { error } = await supabase
                    .from('games')
                    .update({ game_status: 'in_progress' })
                    .eq('id', gameId)
                  
                  if (error) {
                    console.error('Error updating game status:', error)
                    alert('Error al iniciar la anotación')
                    return
                  }
                  
                  // Call the callback to start scoring (this will open the scorebook)
                  onStartScoring(gameId)
                  onClose()
                }}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold text-lg transition-colors shadow-md"
              >
                ✓ Iniciar Anotación
              </button>
            </div>
          )}
        </div>
      )}

      {/* Team Selection - Show if no teamId provided */}
      {!teamId && (
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            {gameId ? 'Equipos del Juego:' : 'Seleccionar Equipo:'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.map((team) => {
              // Check if this team has lineup saved
              const isOurTeam = team.id === gameTeams.ourTeam?.id
              const isOpponentTeam = team.id === gameTeams.opponentTeam?.id
              
              // Debug logging
              if (gameId && gameInfo) {
                console.log(`🔍 Checking lineup for team ${team.name}:`, {
                  isOurTeam,
                  isOpponentTeam,
                  lineup_template_id: gameInfo.lineup_template_id,
                  opponent_lineup_template_id: gameInfo.opponent_lineup_template_id,
                  ourTeamId: gameTeams.ourTeam?.id,
                  opponentTeamId: gameTeams.opponentTeam?.id
                })
              }
              
              // Helper function to check if a template ID is valid
              const isValidTemplateId = (templateId: string | null | undefined): boolean => {
                return !!templateId && templateId !== null && templateId !== '' && templateId.length > 0
              }
              
              // Only show as saved if there's a valid (non-null, non-empty) template ID
              const hasLineupSaved = gameId && gameInfo && (
                (isOurTeam && isValidTemplateId(gameInfo.lineup_template_id)) ||
                (isOpponentTeam && isValidTemplateId(gameInfo.opponent_lineup_template_id))
              )
              
              const isHomeTeam = gameInfo?.batting_first === 'home' && isOurTeam ||
                                gameInfo?.batting_first === 'opponent' && isOpponentTeam
              
              return (
                <div
                  key={team.id}
                  className={`p-4 border-2 rounded-lg transition-colors ${
                    selectedTeam === team.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-900">{team.name}</div>
                    <div className="flex items-center gap-2">
                      {isHomeTeam && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Local</span>
                      )}
                      {!isHomeTeam && (isOurTeam || isOpponentTeam) && gameInfo?.batting_first && (
                        <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Visitante</span>
                      )}
                      {hasLineupSaved && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          ✓ Alineación elegida
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">{team.city}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {team.players?.length || 0} jugadores
                  </div>
                  {!hasLineupSaved && gameId && (
                    <div className="text-xs text-orange-600 mt-2 font-medium">
                      ⚠ Alineación pendiente
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    {hasLineupSaved ? (
                      <>
                        <button
                          onClick={async () => {
                            await selectTeam(team.id)
                            setMode('create')
                            // The selectTeam function will load the existing lineup
                          }}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Editar Alineación
                        </button>
                        <button
                          onClick={async () => {
                            await selectTeam(team.id)
                            setMode('select')
                            // Load templates for selection
                            await fetchSavedTemplates()
                          }}
                          className="flex-1 px-3 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Cambiar Plantilla
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => selectTeam(team.id)}
                        className="w-full px-3 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Seleccionar Alineación
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Template Selection Mode */}
      {currentTeam && mode === 'select' && gameId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-800">
              Seleccionar Plantilla de Alineación para {currentTeam.name}
            </h4>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  const allTemplates = getAllSavedTemplates()
                  console.log('Todas las plantillas guardadas:', allTemplates)
                  alert(`Plantillas guardadas: ${allTemplates.length}\nEquipos: ${allTemplates.map(t => t.teamName).join(', ')}`)
                }}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Ver Todas
              </button>
              <button
                onClick={() => setMode('create')}
                className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Crear Nueva Plantilla
              </button>
            </div>
          </div>

          {/* Saved Templates */}
          {savedTemplates.length > 0 ? (
            <div className="space-y-4">
              <h5 className="text-md font-medium text-gray-700">Plantillas Guardadas:</h5>
              {savedTemplates.map((template) => {
                const lineupEntries = template.lineup_template_players
                  ?.sort((a: LineupTemplatePlayer, b: LineupTemplatePlayer) => a.batting_order - b.batting_order)
                  .map((ltp: LineupTemplatePlayer) => ({
                    playerId: ltp.player_id,
                    position: getPositionFromDb(ltp.position),
                    player: ltp.players
                  })) || []

                return (
                  <div key={template.id} className="bg-white border-2 border-blue-200 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h6 className="text-sm font-semibold text-gray-800">{template.name || 'Default Lineup'}</h6>
                      <button
                        onClick={() => {
                          const entries = lineupEntries.map((e: { playerId: string; position: string }) => ({
                            playerId: e.playerId,
                            position: e.position
                          }))
                          selectLineupTemplate(entries)
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                      >
                        Usar Esta Plantilla
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {lineupEntries.map((entry: { playerId: string; position: string; player?: { id: string; first_name: string; last_name: string; jersey_number: number } }, index: number) => {
                        if (entry.playerId && entry.position) {
                          const player = entry.player || currentTeam.players?.find((p: { id: string }) => p.id === entry.playerId)
                          return (
                            <div key={index} className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-bold text-blue-800 bg-blue-200 px-2 py-1 rounded-full">
                                  {index + 1}
                                </span>
                                <span className="text-sm font-medium text-gray-800">
                                  {player ? `${player.first_name} ${player.last_name} #${player.jersey_number}` : 'Jugador no encontrado'}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                {entry.position}
                              </span>
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-center">
                <button
                  onClick={() => setMode('create')}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  Crear Nueva Plantilla
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
              <div className="text-center">
                <div className="text-yellow-600 mb-3">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h5 className="text-lg font-medium text-yellow-800 mb-2">No hay plantillas guardadas</h5>
                <p className="text-yellow-700 text-sm mb-4">
                  No se encontraron plantillas guardadas para este equipo.
                </p>
                <button
                  onClick={() => setMode('create')}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
                >
                  Crear Primera Plantilla
                </button>
              </div>
            </div>
        )}
      </div>
      )}

      {/* Lineup Grid - Create/Edit Mode */}
      {currentTeam && mode === 'create' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-800">
              {gameId ? 'Crear/Editar Plantilla' : 'Alineación'} para {currentTeam.name}
            </h4>
            <div className="flex space-x-3">
              {gameId && (
        <button
                  onClick={() => setMode('select')}
                  className="text-sm bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
        >
                  Ver Plantillas
        </button>
              )}
              {localStorage.getItem(`lineup_${selectedTeam}`) && (
                <span className="text-sm bg-green-100 text-green-800 px-3 py-2 rounded-lg font-medium">
                  ✓ Datos guardados localmente
                </span>
              )}
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    #
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    Jugador
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                    Posición
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }, (_, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {/* Batting Order Number */}
                    <td className="border border-gray-300 px-3 py-2 text-center font-medium">
                      {index + 1}
                    </td>
                    
                    {/* Player Selection */}
                    <td className="border border-gray-300 px-3 py-2">
                      <select
                        value={lineupEntries[index]?.playerId || ''}
                        onChange={(e) => updatePlayerInLineup(index, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Seleccionar jugador...</option>
                        {availablePlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.first_name} {player.last_name} #{player.jersey_number}
                          </option>
                        ))}
                        {lineupEntries[index]?.playerId && (
                          <option value={lineupEntries[index].playerId}>
                            {getPlayerName(lineupEntries[index].playerId)}
                          </option>
                        )}
                      </select>
                    </td>
                    
                    {/* Position Selection */}
                    <td className="border border-gray-300 px-3 py-2">
                      <select
                        value={lineupEntries[index]?.position || ''}
                        onChange={(e) => updatePositionInLineup(index, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Seleccionar posición...</option>
                        {getAvailablePositions(index).map((position) => (
                          <option key={position} value={position}>
                            {position}
                          </option>
                        ))}
                        {lineupEntries[index]?.position && (
                          <option value={lineupEntries[index].position}>
                            {lineupEntries[index].position}
                          </option>
                        )}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DH Info */}
          {hasDH && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Bateador Designado (DH)</strong> seleccionado. Se habilitó la fila 10.
              </p>
            </div>
          )}

          {/* Position Status */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h6 className="text-sm font-medium text-gray-700 mb-2">Posiciones Asignadas:</h6>
            <div className="flex flex-wrap gap-2">
              {lineupEntries.slice(0, maxRows).map((entry, index) => {
                if (entry.position) {
                  return (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {index + 1}. {entry.position}
                    </span>
                  )
                }
                return null
              })}
              {lineupEntries.slice(0, maxRows).filter(entry => !entry.position).length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {lineupEntries.slice(0, maxRows).filter(entry => !entry.position).length} posiciones pendientes
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
              Cancelar
          </button>
          <button
              onClick={saveLineup}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : (gameId ? 'Guardar Plantilla' : 'Guardar Alineación')}
          </button>
        </div>
      </div>
      )}
    </div>
  )
}