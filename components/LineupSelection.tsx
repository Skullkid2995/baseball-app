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
  onLineupSaved?: () => void | Promise<void> // Callback when lineup is saved
  onStartScoring?: () => void // Callback to start scoring when both lineups are saved
}

interface GameTeams {
  homeTeamId?: string
  opponentTeamId?: string
  opponentName?: string
}

export default function LineupSelection({ teamId, gameId, onClose, onLineupSaved, onStartScoring }: LineupSelectionProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [gameTeams, setGameTeams] = useState<GameTeams>({})
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]) // Only teams from the game
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [lineupEntries, setLineupEntries] = useState<LineupEntry[]>([])
  const [hasDH, setHasDH] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'select' | 'create'>('select') // New mode for template selection
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
  const [gameLineupStatus, setGameLineupStatus] = useState<{
    homeTeamLineupSaved: boolean
    opponentTeamLineupSaved: boolean
  }>({ homeTeamLineupSaved: false, opponentTeamLineupSaved: false })
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null) // Track which team is home
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null) // Track which team is away
  const [showHomeAwaySelection, setShowHomeAwaySelection] = useState(false) // Show home/away selection
  const [gameStatus, setGameStatus] = useState<string | null>(null) // Track game status
  const [showTeamSelection, setShowTeamSelection] = useState(true) // Control if showing team selection or lineup templates
  const [teamPlayersFromTemplates, setTeamPlayersFromTemplates] = useState<Player[]>([]) // Players from saved templates
  const [allTeamPlayers, setAllTeamPlayers] = useState<Player[]>([]) // All players from team (including from templates)
  
  // Add Player Modal State
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false)
  const [addPlayerForIndex, setAddPlayerForIndex] = useState<number | null>(null) // Track which lineup entry to update
  const [newPlayerData, setNewPlayerData] = useState({
    first_name: '',
    last_name: '',
    jersey_number: 0
  })
  const [addingPlayer, setAddingPlayer] = useState(false)
  
  // Duplicate Player Modal State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicatePlayerInfo, setDuplicatePlayerInfo] = useState<{
    id: string
    first_name: string
    last_name: string
    jersey_number: number | null
    photo_url: string | null
    team_id: string | null
    team_name: string
    team_city: string
  } | null>(null)
  const [pendingPlayerData, setPendingPlayerData] = useState<{
    firstName: string
    lastName: string
    jerseyNumber: number
    index: number | null
  } | null>(null)

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
      fetchGameTeams()
      checkGameLineupStatus()
    } else {
      fetchTeams()
    }
    if (selectedTeam) {
      fetchSavedTemplates()
      fetchPlayersFromTemplates()
    }
  }, [selectedTeam, gameId])

  // Check if lineups are saved for this game
  async function checkGameLineupStatus() {
    if (!gameId) return

    try {
      console.log('=== CHECKING GAME LINEUP STATUS ===')
      console.log('Game ID:', gameId)
      
      // First try to get game data with lineup template IDs
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (gameError) {
        console.log('Error fetching game data, trying fallback...', gameError)
        // Try fallback approach
        const { data: fallbackData } = await supabase
          .from('games')
          .select('opponent, team_id')
          .eq('id', gameId)
          .single()

        if (fallbackData) {
          await checkLineupsViaTemplates(fallbackData)
        }
        return
      }

      // Check if lineup_template_id and opponent_lineup_template_id columns exist
      const hasHomeLineupId = (gameData as any)?.lineup_template_id !== undefined
      const hasOpponentLineupId = (gameData as any)?.opponent_lineup_template_id !== undefined

      if (hasHomeLineupId && hasOpponentLineupId) {
        // Columns exist, use them directly
        const homeLineupId = (gameData as any)?.lineup_template_id
        const opponentLineupId = (gameData as any)?.opponent_lineup_template_id
        
        console.log('Lineup IDs from games table:')
        console.log('  Home (Dodgers):', homeLineupId)
        console.log('  Opponent:', opponentLineupId)
        
        const newStatus = {
          homeTeamLineupSaved: !!homeLineupId,
          opponentTeamLineupSaved: !!opponentLineupId
        }
        
        setGameLineupStatus(newStatus)
        console.log('Final status:', newStatus)
      } else {
        // Columns don't exist, check via lineup_templates table
        console.log('Lineup template ID columns not found, checking via lineup_templates table...')
        const { data: fallbackData } = await supabase
          .from('games')
          .select('opponent, team_id')
          .eq('id', gameId)
          .single()
        
        if (fallbackData) {
          await checkLineupsViaTemplates(fallbackData)
        }
      }
      
      console.log('===================================')
    } catch (err) {
      console.error('Error checking game lineup status:', err)
    }
  }

  // Helper function to check lineups via lineup_templates table
  async function checkLineupsViaTemplates(gameData: { opponent?: string; team_id?: string }) {
    // Find Dodgers team
    const { data: dodgersTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('name', 'Dodgers')
      .maybeSingle()
    
    const homeTeamId = gameData.team_id || dodgersTeam?.id
    
    // Find opponent team
    let opponentTeamId: string | undefined
    if (gameData.opponent) {
      const { data: opponentTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('name', gameData.opponent)
        .maybeSingle()
      opponentTeamId = opponentTeam?.id
    }
    
    console.log('Team IDs:')
    console.log('  Home (Dodgers):', homeTeamId)
    console.log('  Opponent:', opponentTeamId)
    
    // Check if templates exist for both teams (check if they have at least one template with players)
    let hasHome = false
    let hasOpponent = false
    
    if (homeTeamId) {
      const { data: homeTemplates } = await supabase
        .from('lineup_templates')
        .select(`
          id,
          lineup_template_players (id)
        `)
        .eq('team_id', homeTeamId)
      
      // Check if any template has players
      hasHome = !!homeTemplates && homeTemplates.some(t => 
        t.lineup_template_players && Array.isArray(t.lineup_template_players) && t.lineup_template_players.length > 0
      )
      console.log('Dodgers templates with players found:', homeTemplates?.filter(t => 
        t.lineup_template_players && Array.isArray(t.lineup_template_players) && t.lineup_template_players.length > 0
      ).length || 0)
    }
    
    if (opponentTeamId) {
      const { data: opponentTemplates } = await supabase
        .from('lineup_templates')
        .select(`
          id,
          lineup_template_players (id)
        `)
        .eq('team_id', opponentTeamId)
      
      // Check if any template has players
      hasOpponent = !!opponentTemplates && opponentTemplates.some(t => 
        t.lineup_template_players && Array.isArray(t.lineup_template_players) && t.lineup_template_players.length > 0
      )
      console.log('Opponent templates with players found:', opponentTemplates?.filter(t => 
        t.lineup_template_players && Array.isArray(t.lineup_template_players) && t.lineup_template_players.length > 0
      ).length || 0)
    }
    
    const newStatus = {
      homeTeamLineupSaved: hasHome,
      opponentTeamLineupSaved: hasOpponent
    }
    
    setGameLineupStatus(newStatus)
    console.log('Final status from templates check:', newStatus)
  }

  // Update available teams when game teams are loaded
  useEffect(() => {
    if (gameId && teams.length > 0) {
      // Filter to only show teams from the game
      const filtered = teams.filter(team => {
        // Include home team if available
        if (gameTeams.homeTeamId && team.id === gameTeams.homeTeamId) return true
        // Include opponent team if available
        if (gameTeams.opponentTeamId && team.id === gameTeams.opponentTeamId) return true
        return false
      })
      
      // If we have at least one team (home or opponent), use filtered list
      if (filtered.length > 0) {
        setAvailableTeams(filtered)
        
        // Auto-select home team if available and not already selected
        if (!selectedTeam && gameTeams.homeTeamId) {
          setSelectedTeam(gameTeams.homeTeamId)
        } else if (!selectedTeam && gameTeams.opponentTeamId && filtered.length === 1) {
          // If only opponent team available, select it
          setSelectedTeam(gameTeams.opponentTeamId)
        }
      } else {
        // No teams found for this game, show all teams as fallback
        console.warn('No teams found for game, showing all teams')
        setAvailableTeams(teams)
      }
    } else if (!gameId) {
      // If no gameId, show all teams
      setAvailableTeams(teams)
    }
  }, [gameTeams, teams, gameId, selectedTeam])

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

  // Debug: Log available players when in create mode
  useEffect(() => {
    if (selectedTeam && mode === 'create') {
      const currentTeamDebug = selectedTeam ? teams.find(t => t.id === selectedTeam) : null
      const availablePlayersDebug = getAvailablePlayers()
      console.log('=== AVAILABLE PLAYERS DEBUG ===')
      console.log('Selected Team:', selectedTeam)
      console.log('Team Players from Templates:', teamPlayersFromTemplates.length)
      console.log('All Team Players:', allTeamPlayers.length)
      console.log('Available Players (filtered):', availablePlayersDebug.length)
      console.log('Available Players List:', availablePlayersDebug.map(p => `${p.first_name} ${p.last_name}`))
      console.log('Current Team:', currentTeamDebug?.name)
      console.log('Team Players from State:', currentTeamDebug?.players?.length || 0)
      console.log('================================')
    }
  }, [selectedTeam, mode, teamPlayersFromTemplates.length, allTeamPlayers.length, teams, availableTeams])

  // Fetch game teams (home team and opponent team)
  async function fetchGameTeams() {
    if (!gameId) return
    
    try {
      // First, try to get all fields from games table
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*, home_team_id, away_team_id, game_status')
        .eq('id', gameId)
        .single()

      // Store game status
      if (gameData && (gameData as any)?.game_status) {
        setGameStatus((gameData as any).game_status)
      }

      // Check if home_team_id and away_team_id are already set
      if (gameData && (gameData as any)?.home_team_id && (gameData as any)?.away_team_id) {
        setHomeTeamId((gameData as any).home_team_id)
        setAwayTeamId((gameData as any).away_team_id)
        // Only show selection if game is scheduled (not in_progress or completed)
        const status = (gameData as any)?.game_status || 'scheduled'
        setShowHomeAwaySelection(status === 'scheduled' ? false : false) // Don't show by default if already set
      } else {
        // Need to show home/away selection only if game is scheduled
        const status = (gameData as any)?.game_status || 'scheduled'
        setShowHomeAwaySelection(status === 'scheduled')
      }

      // Always find Dodgers team (home team)
      const { data: dodgersTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('name', 'Dodgers')
        .maybeSingle()

      const dodgersTeamId = dodgersTeam?.id

      if (gameError) {
        // Check if it's a column error (field doesn't exist) vs actual error
        const errorMessage = gameError?.message || ''
        const errorCode = gameError?.code || ''
        
        // If it's a column error, try without team_id
        if (errorMessage.includes('column') || errorCode === '42703') {
          console.log('team_id column not found, using Dodgers as default...')
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('games')
            .select('opponent')
            .eq('id', gameId)
            .single()
          
          if (fallbackError) {
            console.error('Error fetching game data (fallback):', fallbackError)
            setError('Error loading game data')
            return
          }
          
          // Use fallback data (no team_id) - always use Dodgers as home
          const opponentName = fallbackData?.opponent
          
          // Find opponent team by name
          let opponentTeamId: string | undefined
          if (opponentName) {
            const { data: opponentTeam } = await supabase
              .from('teams')
              .select('id')
              .eq('name', opponentName)
              .maybeSingle()
            
            opponentTeamId = opponentTeam?.id
          }

          setGameTeams({
            homeTeamId: dodgersTeamId || undefined, // Always Dodgers
            opponentTeamId: opponentTeamId,
            opponentName: opponentName
          })
        } else {
          console.error('Error fetching game data:', gameError)
          setError('Error loading game data')
          return
        }
      } else {
        // Successfully got game data
        const homeTeamId = (gameData as any)?.team_id || dodgersTeamId // Use Dodgers if team_id not set
        const opponentName = gameData?.opponent

        // Find opponent team by name
        let opponentTeamId: string | undefined
        if (opponentName) {
          const { data: opponentTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('name', opponentName)
            .maybeSingle()
          
          opponentTeamId = opponentTeam?.id
        }

        setGameTeams({
          homeTeamId: homeTeamId || dodgersTeamId || undefined, // Always default to Dodgers
          opponentTeamId: opponentTeamId,
          opponentName: opponentName
        })
      }

      // Now fetch teams (will be filtered in useEffect)
      await fetchTeams()
    } catch (err) {
      console.error('Failed to fetch game teams:', err)
      setError('Failed to load game teams')
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

  function selectTeam(teamId: string) {
    const team = availableTeams.find(t => t.id === teamId) || teams.find(t => t.id === teamId)
    if (team) {
      setSelectedTeam(teamId)
      setShowTeamSelection(false) // Show lineup templates when team is selected
      
      // Try to load existing lineup from localStorage first
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

  // Fetch players from saved templates for the selected team
  async function fetchPlayersFromTemplates() {
    if (!selectedTeam) {
      console.log('No team selected for fetching players')
      setTeamPlayersFromTemplates([])
      setAllTeamPlayers([])
      return
    }

    console.log('Fetching players for team:', selectedTeam)
    try {
      // Get all players from saved templates for this team
      const { data: templates, error } = await supabase
        .from('lineup_templates')
        .select(`
          id,
          lineup_template_players (
            player_id,
            players (
              id,
              first_name,
              last_name,
              jersey_number,
              positions
            )
          )
        `)
        .eq('team_id', selectedTeam)
      
      console.log('Templates found:', templates?.length || 0)

      if (error) {
        console.error('Error fetching players from templates:', error)
        setTeamPlayersFromTemplates([])
      } else {
        // Extract unique players from all templates
        const playersMap = new Map<string, Player>()
        
        templates?.forEach(template => {
          const templatePlayers = template.lineup_template_players as any[]
          
          templatePlayers?.forEach((tp: any) => {
            // Handle Supabase nested response - players can be an object or array
            let player: Player | null = null
            if (tp.players) {
              if (Array.isArray(tp.players)) {
                player = tp.players[0] as Player
              } else {
                player = tp.players as Player
              }
            }
            
            if (player && tp.player_id && !playersMap.has(tp.player_id)) {
              playersMap.set(tp.player_id, player)
            }
          })
        })

        const playersFromTemplates = Array.from(playersMap.values())
        setTeamPlayersFromTemplates(playersFromTemplates)

        // Also fetch all players from the team directly from database
        console.log('Fetching players from database for team:', selectedTeam)
        const { data: teamPlayersData, error: playersError } = await supabase
          .from('players')
          .select('id, first_name, last_name, jersey_number, positions')
          .eq('team_id', selectedTeam)

        if (playersError) {
          console.error('Error fetching players from database:', playersError)
        } else {
          console.log('Players from database:', teamPlayersData?.length || 0)
        }

        const teamPlayersFromDb = (teamPlayersData || []) as Player[]
        
        // Also get players from teams state (already loaded)
        const team = availableTeams.find(t => t.id === selectedTeam) || teams.find(t => t.id === selectedTeam)
        const teamPlayersFromState = team?.players || []

        // Combine all sources: templates, database, and state
        const allPlayersMap = new Map<string, Player>()
        playersFromTemplates.forEach(p => allPlayersMap.set(p.id, p))
        teamPlayersFromDb.forEach(p => {
          if (!allPlayersMap.has(p.id)) {
            allPlayersMap.set(p.id, p)
          }
        })
        teamPlayersFromState.forEach(p => {
          if (!allPlayersMap.has(p.id)) {
            allPlayersMap.set(p.id, p)
          }
        })

        setAllTeamPlayers(Array.from(allPlayersMap.values()))
      }
    } catch (err) {
      console.error('Error fetching players from templates:', err)
      setTeamPlayersFromTemplates([])
      setAllTeamPlayers([])
    }
  }

  function getAvailablePlayers() {
    if (!selectedTeam) {
      console.log('No team selected')
      return []
    }
    
    // Combine all sources: templates, all team players, and team state
    const allPlayersMap = new Map<string, Player>()
    
    // Add players from templates
    if (teamPlayersFromTemplates.length > 0) {
      console.log('Adding players from templates:', teamPlayersFromTemplates.length)
      teamPlayersFromTemplates.forEach(p => allPlayersMap.set(p.id, p))
    }
    
    // Add players from allTeamPlayers (includes DB and state)
    if (allTeamPlayers.length > 0) {
      console.log('Adding players from allTeamPlayers:', allTeamPlayers.length)
      allTeamPlayers.forEach(p => allPlayersMap.set(p.id, p))
    }
    
    // Also get players from teams state as fallback
    const team = availableTeams.find(t => t.id === selectedTeam) || teams.find(t => t.id === selectedTeam)
    if (team?.players && team.players.length > 0) {
      console.log('Adding players from team state:', team.players.length)
      team.players.forEach(p => {
        if (!allPlayersMap.has(p.id)) {
          allPlayersMap.set(p.id, p)
        }
      })
    }
    
    const allPlayers = Array.from(allPlayersMap.values())
    console.log('Total players available:', allPlayers.length)
    const usedPlayerIds = lineupEntries.map(entry => entry.playerId).filter(id => id !== '')
    const available = allPlayers.filter(player => !usedPlayerIds.includes(player.id))
    console.log('Available players (not used):', available.length)
    return available
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
    console.log('🔵 saveLineup function called')
    console.log('🔵 selectedTeam:', selectedTeam)
    console.log('🔵 mode:', mode)
    console.log('🔵 gameId:', gameId)
    
    if (!selectedTeam) {
      console.log('❌ No team selected, returning')
      return
    }

    // If in select mode and gameId is provided, just link the game to the team
    if (mode === 'select' && gameId) {
      console.log('🔵 Mode is select, linking game to team')
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

        // Update game lineup status after linking
        if (gameId) {
          await checkGameLineupStatus()
        }
        
        // Return to team selection view instead of closing
        setSelectedTeam(null)
        setShowTeamSelection(true)
        setMode('select')
        
        // Notify parent component that lineup was saved
        if (onLineupSaved) {
          onLineupSaved()
        }
        
        alert('✓ Lineup guardado')
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

    console.log('🔵🔵🔵 STARTING TO SAVE LINEUP TO DATABASE 🔵🔵🔵')
    setSaving(true)
    try {
      console.log('=== SAVING LINEUP ===')
      console.log('Selected Team:', selectedTeam)
      console.log('Filled Entries:', filledEntries.length)
      console.log('Filled Entries Data:', filledEntries)
      
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

      // Prepare the lineup data for comparison
      const newLineupData = filledEntries.map((entry, index) => ({
        player_id: entry.playerId,
        batting_order: index + 1,
        position: positionMap[entry.position] || 'DH'
      }))

      // Check if a template with the same batting order and positions already exists
      console.log('Checking for existing templates with same lineup for team:', selectedTeam)
      const { data: existingTemplates, error: templatesError } = await supabase
        .from('lineup_templates')
        .select(`
          id,
          lineup_template_players (
            player_id,
            batting_order,
            position
          )
        `)
        .eq('team_id', selectedTeam)

      if (templatesError) {
        console.error('Error checking for existing templates:', templatesError)
        throw new Error(`Error checking templates: ${templatesError.message}`)
      }

      // Check if any existing template has the same lineup
      let existingTemplateId: string | null = null
      if (existingTemplates && existingTemplates.length > 0) {
        for (const template of existingTemplates) {
          const existingPlayers = (template.lineup_template_players || []) as Array<{
            player_id: string
            batting_order: number
            position: string
          }>
          
          // Sort both lineups by batting_order for comparison
          const existingSorted = [...existingPlayers].sort((a, b) => a.batting_order - b.batting_order)
          const newSorted = [...newLineupData].sort((a, b) => a.batting_order - b.batting_order)
          
          // Check if lineups match (same length, same players in same order, same positions)
          if (existingSorted.length === newSorted.length) {
            const isMatch = existingSorted.every((existing, index) => {
              const newEntry = newSorted[index]
              return existing.player_id === newEntry.player_id &&
                     existing.batting_order === newEntry.batting_order &&
                     existing.position === newEntry.position
            })
            
            if (isMatch) {
              console.log('Found existing template with same lineup:', template.id)
              existingTemplateId = template.id
              break // Use the first matching template
            }
          }
        }
      }

      let templateId: string
      if (existingTemplateId) {
        // Use existing template instead of creating a new one
        console.log('Using existing template:', existingTemplateId)
        templateId = existingTemplateId
      } else {
        // No duplicate found, create new template
        console.log('No duplicate found, creating new template for team:', selectedTeam)
        const { data: newTemplate, error: templateError } = await supabase
          .from('lineup_templates')
          .insert([{
            team_id: selectedTeam,
            name: `Lineup ${new Date().toLocaleDateString()}`
          }])
          .select('id')
          .single()

        if (templateError) {
          console.error('Error creating template:', templateError)
          throw new Error(`Failed to create lineup template: ${templateError.message}`)
        }
        
        if (!newTemplate) {
          throw new Error('Failed to create lineup template: No data returned')
        }
        
        templateId = newTemplate.id
        console.log('Created new template with ID:', templateId)
        
        // Create lineup template players for the new template
        const templatePlayers = newLineupData.map(entry => ({
          template_id: templateId,
          player_id: entry.player_id,
          batting_order: entry.batting_order,
          position: entry.position
        }))

        console.log('Inserting template players:', templatePlayers.length)
        const { data: insertedPlayers, error: templatePlayersError } = await supabase
          .from('lineup_template_players')
          .insert(templatePlayers)
          .select()

        if (templatePlayersError) {
          console.error('Error inserting template players:', templatePlayersError)
          // Rollback: delete the template if players insertion fails
          await supabase.from('lineup_templates').delete().eq('id', templateId)
          throw new Error(`Failed to save lineup template players: ${templatePlayersError.message}`)
        }
        
        console.log('Successfully inserted players:', insertedPlayers?.length || 0)
        console.log('✅ New template and players saved successfully in database')
      }
      
      // If using existing template, log it
      if (existingTemplateId) {
        console.log('✅ Using existing template, players already saved')
      }

      // Link game to our team's lineup template (only if gameId is provided)
      if (gameId) {
        // Determine if this is Dodgers (home) or opponent
        const isDodgers = selectedTeam === gameTeams.homeTeamId || (availableTeams.find(t => t.id === selectedTeam)?.name === 'Dodgers')
        const isOpponent = selectedTeam === gameTeams.opponentTeamId
        
        if (isDodgers) {
          // Link Dodgers lineup to game
          console.log('Linking Dodgers lineup template to game:', { gameId, templateId })
          const { data: updateData, error: gameError } = await supabase
            .from('games')
            .update({ lineup_template_id: templateId })
            .eq('id', gameId)
            .select('lineup_template_id')

          if (gameError) {
            // If column doesn't exist, that's okay - template is still saved
            const errorMessage = gameError?.message || ''
            if (!errorMessage.includes('column')) {
              console.error('Error linking game to lineup template:', gameError)
            } else {
              console.log('Note: lineup_template_id column may not exist, but template is saved')
            }
          } else {
            console.log('Dodgers lineup template linked to game successfully:', updateData)
          }
        } else if (isOpponent) {
          // Link opponent lineup to game
          console.log('Linking opponent lineup template to game:', { gameId, templateId })
          const { data: updateData, error: gameError } = await supabase
            .from('games')
            .update({ opponent_lineup_template_id: templateId })
            .eq('id', gameId)
            .select('opponent_lineup_template_id')

          if (gameError) {
            // If column doesn't exist, that's okay - template is still saved
            const errorMessage = gameError?.message || ''
            if (!errorMessage.includes('column')) {
              console.error('Error linking opponent lineup to game:', gameError)
            } else {
              console.log('Note: opponent_lineup_template_id column may not exist, but template is saved')
            }
          } else {
            console.log('Opponent lineup template linked to game successfully:', updateData)
          }
        } else {
          console.log('Warning: Could not determine if this is Dodgers or opponent team')
        }
      }

      // Refresh saved templates
      await fetchSavedTemplates()
      
      // Update game lineup status - wait a bit for database to update
      if (gameId) {
        console.log('Waiting for database to update...')
        // Wait a moment for the database update to complete
        await new Promise(resolve => setTimeout(resolve, 500))
        console.log('Checking game lineup status...')
        await checkGameLineupStatus()
        // Wait again and check one more time to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 300))
        await checkGameLineupStatus()
      }

      // Return to team selection view instead of closing
      setSelectedTeam(null)
      setShowTeamSelection(true)
      setMode('select')
      setLineupEntries([])
      
      // Notify parent component that lineup was saved
      if (onLineupSaved) {
        onLineupSaved()
      }
      
      // Show success message
      console.log('=== LINEUP SAVED SUCCESSFULLY ===')
      console.log('Template ID:', templateId)
      console.log('Game ID:', gameId)
      alert('✓ Lineup guardado')
    } catch (err) {
      console.error('=== ERROR SAVING LINEUP ===')
      console.error('Error details:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      alert(`Error al guardar la alineación: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  function getPlayerName(playerId: string) {
    if (!playerId || !selectedTeam) return ''
    
    // Search in all available sources
    let player: Player | undefined
    
    // First, check in teamPlayersFromTemplates
    player = teamPlayersFromTemplates.find(p => p.id === playerId)
    if (player) {
      return `${player.first_name} ${player.last_name} #${player.jersey_number}`
    }
    
    // Then check in allTeamPlayers
    player = allTeamPlayers.find(p => p.id === playerId)
    if (player) {
      return `${player.first_name} ${player.last_name} #${player.jersey_number}`
    }
    
    // Finally, check in teams state
    const team = availableTeams.find(t => t.id === selectedTeam) || teams.find(t => t.id === selectedTeam)
    player = team?.players?.find(p => p.id === playerId)
    if (player) {
      return `${player.first_name} ${player.last_name} #${player.jersey_number}`
    }
    
    return 'Jugador no encontrado'
  }

  // Add new player to team
  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTeam) {
      alert('Por favor selecciona un equipo primero')
      return
    }

    if (!newPlayerData.first_name.trim() || !newPlayerData.last_name.trim()) {
      alert('Por favor ingresa el nombre y apellido del jugador')
      return
    }

    setAddingPlayer(true)
    try {
      // Check for duplicate players (same first_name and last_name) in any team
      const firstName = newPlayerData.first_name.trim()
      const lastName = newPlayerData.last_name.trim()

      const { data: existingPlayers, error: checkError } = await supabase
        .from('players')
        .select(`
          id,
          first_name,
          last_name,
          jersey_number,
          photo_url,
          team_id,
          teams (
            id,
            name,
            city
          )
        `)
        .eq('first_name', firstName)
        .eq('last_name', lastName)

      if (checkError) {
        console.error('Error checking for duplicates:', checkError)
        alert(`Error al verificar jugadores existentes: ${checkError.message}`)
        setAddingPlayer(false)
        return
      }

      if (existingPlayers && existingPlayers.length > 0) {
        const existingPlayer = existingPlayers[0]
        const existingTeam = existingPlayer.teams && (Array.isArray(existingPlayer.teams) ? existingPlayer.teams[0] : existingPlayer.teams)
        const teamName = existingTeam ? `${existingTeam.city || ''} ${existingTeam.name || ''}`.trim() : 'sin equipo'
        const teamCity = existingTeam?.city || ''
        const teamNameOnly = existingTeam?.name || 'sin equipo'
        
        // Store duplicate player info and show modal
        setDuplicatePlayerInfo({
          id: existingPlayer.id,
          first_name: existingPlayer.first_name,
          last_name: existingPlayer.last_name,
          jersey_number: existingPlayer.jersey_number,
          photo_url: existingPlayer.photo_url,
          team_id: existingPlayer.team_id,
          team_name: teamNameOnly,
          team_city: teamCity
        })
        
        // Store pending player data to create after user confirms
        setPendingPlayerData({
          firstName,
          lastName,
          jerseyNumber: newPlayerData.jersey_number,
          index: addPlayerForIndex
        })
        
        // Close add player modal and show duplicate modal
        setShowAddPlayerModal(false)
        setShowDuplicateModal(true)
        setAddingPlayer(false)
        return
      }

      // Create player with minimal required data
      // Use default values for required fields that user doesn't want to fill now
      const playerData = {
        first_name: firstName,
        last_name: lastName,
        jersey_number: newPlayerData.jersey_number || null,
        team_id: selectedTeam,
        date_of_birth: '2000-01-01', // Default date, user can update later
        positions: [], // Empty array, user can update later
        handedness: 'Righty', // Default value
        is_active: true
      }

      const { data, error } = await supabase
        .from('players')
        .insert([playerData])
        .select(`
          id,
          first_name,
          last_name,
          jersey_number,
          positions
        `)
        .single()

      if (error) {
        console.error('Error creating player:', error)
        alert(`Error al crear el jugador: ${error.message}`)
        setAddingPlayer(false)
        return
      }

      if (data) {
        // Add the new player to the available players list
        const newPlayer: Player = {
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          jersey_number: data.jersey_number || 0,
          positions: data.positions || []
        }

        // Store player name for success message before resetting
        const playerName = `${data.first_name} ${data.last_name}`

        // Update state to include new player
        setAllTeamPlayers([...allTeamPlayers, newPlayer])
        setTeamPlayersFromTemplates([...teamPlayersFromTemplates, newPlayer])

        // Automatically assign the new player to the lineup entry where it was added
        if (addPlayerForIndex !== null) {
          updatePlayerInLineup(addPlayerForIndex, data.id)
        }

        // Reset form and close modal
        setNewPlayerData({
          first_name: '',
          last_name: '',
          jersey_number: 0
        })
        setAddPlayerForIndex(null)
        setShowAddPlayerModal(false)

        // Refresh players from templates to ensure consistency
        await fetchPlayersFromTemplates()

        alert(`✓ Jugador ${playerName} agregado exitosamente y asignado a la alineación`)
      }
    } catch (err) {
      console.error('Error adding player:', err)
      alert('Error al agregar el jugador. Por favor intenta de nuevo.')
    } finally {
      setAddingPlayer(false)
    }
  }

  // Handle duplicate player confirmation - create anyway
  async function handleCreateDuplicateAnyway() {
    if (!pendingPlayerData || !selectedTeam) {
      setShowDuplicateModal(false)
      setDuplicatePlayerInfo(null)
      setPendingPlayerData(null)
      return
    }

    setAddingPlayer(true)
    try {
      const playerData = {
        first_name: pendingPlayerData.firstName,
        last_name: pendingPlayerData.lastName,
        jersey_number: pendingPlayerData.jerseyNumber || null,
        team_id: selectedTeam,
        date_of_birth: '2000-01-01',
        positions: [],
        handedness: 'Righty',
        is_active: true
      }

      const { data, error } = await supabase
        .from('players')
        .insert([playerData])
        .select(`
          id,
          first_name,
          last_name,
          jersey_number,
          positions
        `)
        .single()

      if (error) {
        console.error('Error creating player:', error)
        alert(`Error al crear el jugador: ${error.message}`)
        setAddingPlayer(false)
        return
      }

      if (data) {
        const newPlayer: Player = {
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          jersey_number: data.jersey_number || 0,
          positions: data.positions || []
        }

        const playerName = `${data.first_name} ${data.last_name}`

        setAllTeamPlayers([...allTeamPlayers, newPlayer])
        setTeamPlayersFromTemplates([...teamPlayersFromTemplates, newPlayer])

        if (pendingPlayerData.index !== null) {
          updatePlayerInLineup(pendingPlayerData.index, data.id)
        }

        await fetchPlayersFromTemplates()

        setShowDuplicateModal(false)
        setDuplicatePlayerInfo(null)
        setPendingPlayerData(null)
        setNewPlayerData({
          first_name: '',
          last_name: '',
          jersey_number: 0
        })
        setAddPlayerForIndex(null)

        alert(`✓ Jugador ${playerName} agregado exitosamente y asignado a la alineación`)
      }
    } catch (err) {
      console.error('Error adding player:', err)
      alert('Error al agregar el jugador. Por favor intenta de nuevo.')
    } finally {
      setAddingPlayer(false)
    }
  }

  // Handle duplicate player cancellation
  function handleCancelDuplicate() {
    setShowDuplicateModal(false)
    setDuplicatePlayerInfo(null)
    setPendingPlayerData(null)
    // Reopen add player modal
    setShowAddPlayerModal(true)
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
      {/* Team Selection - Show if no teamId provided */}
      {!teamId && (
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            {gameId ? 'Seleccionar Equipo del Juego:' : 'Seleccionar Equipo:'}
          </h4>
          {gameId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-blue-800 text-sm font-medium">
                {gameTeams.homeTeamId && selectedTeam === gameTeams.homeTeamId
                  ? 'Selecciona la alineación para Dodgers (Equipo Local)'
                  : gameTeams.opponentTeamId && selectedTeam === gameTeams.opponentTeamId
                  ? 'Selecciona la alineación para el Equipo Visitante'
                  : 'Solo se muestran los equipos de este juego'}
              </p>
            </div>
          )}
          {gameId && availableTeams.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
              <p className="text-yellow-800 text-sm">
                Cargando equipos del juego...
              </p>
            </div>
          )}
          
          {/* Home/Away Selection - Show if not yet set OR if user wants to change (only if game is scheduled) */}
          {gameId && availableTeams.length >= 2 && gameStatus === 'scheduled' && (
            <div className="mb-4">
              {!homeTeamId || !awayTeamId || showHomeAwaySelection ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">
                    Selecciona quién es el equipo local (Home) y quién es visitante (Away)
                  </h4>
                  <p className="text-xs text-blue-700 mb-3">
                    El equipo local batea último en cada entrada (cierra la entrada).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableTeams.map((team) => {
                      const isHome = homeTeamId === team.id
                      const isAway = awayTeamId === team.id
                      
                      return (
                        <div key={team.id} className="flex flex-col gap-2">
                          <div className="text-sm font-medium text-gray-700">{team.name}</div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                setHomeTeamId(team.id)
                                setAwayTeamId(availableTeams.find(t => t.id !== team.id)?.id || null)
                                
                                // Save to database
                                if (gameId) {
                                  const otherTeam = availableTeams.find(t => t.id !== team.id)
                                  const { error } = await supabase
                                    .from('games')
                                    .update({
                                      home_team_id: team.id,
                                      away_team_id: otherTeam?.id || null
                                    })
                                    .eq('id', gameId)
                                  
                                  if (error) {
                                    console.error('Error saving home/away teams:', error)
                                    const errorMessage = error.message || 'Error desconocido'
                                    if (errorMessage.includes('column') || errorMessage.includes('home_team_id') || errorMessage.includes('away_team_id')) {
                                      alert('Error: Las columnas home_team_id y away_team_id no existen en la tabla games.\n\nPor favor ejecuta el query SQL en database/add_home_away_columns.sql en tu base de datos Supabase primero.\n\nVer INSTRUCCIONES_AGREGAR_COLUMNAS.md para más detalles.')
                                    } else {
                                      alert(`Error al guardar la selección de equipos: ${errorMessage}`)
                                    }
                                  } else {
                                    setShowHomeAwaySelection(false)
                                  }
                                }
                              }}
                              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                isHome
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {isHome ? '✓' : ''} Local (Home)
                            </button>
                            <button
                              onClick={async () => {
                                setAwayTeamId(team.id)
                                setHomeTeamId(availableTeams.find(t => t.id !== team.id)?.id || null)
                                
                                // Save to database
                                if (gameId) {
                                  const otherTeam = availableTeams.find(t => t.id !== team.id)
                                  const { error } = await supabase
                                    .from('games')
                                    .update({
                                      home_team_id: otherTeam?.id || null,
                                      away_team_id: team.id
                                    })
                                    .eq('id', gameId)
                                  
                                  if (error) {
                                    console.error('Error saving home/away teams:', error)
                                    const errorMessage = error.message || 'Error desconocido'
                                    if (errorMessage.includes('column') || errorMessage.includes('home_team_id') || errorMessage.includes('away_team_id')) {
                                      alert('Error: Las columnas home_team_id y away_team_id no existen en la tabla games.\n\nPor favor ejecuta el query SQL en database/add_home_away_columns.sql en tu base de datos Supabase primero.\n\nVer INSTRUCCIONES_AGREGAR_COLUMNAS.md para más detalles.')
                                    } else {
                                      alert(`Error al guardar la selección de equipos: ${errorMessage}`)
                                    }
                                  } else {
                                    setShowHomeAwaySelection(false)
                                  }
                                }
                              }}
                              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                isAway
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {isAway ? '✓' : ''} Visitante (Away)
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">
                        Equipos Asignados
                      </h4>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Local (Home):</span>{' '}
                          {availableTeams.find(t => t.id === homeTeamId)?.name || 'No asignado'}
                        </div>
                        <div>
                          <span className="font-medium">Visitante (Away):</span>{' '}
                          {availableTeams.find(t => t.id === awayTeamId)?.name || 'No asignado'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowHomeAwaySelection(true)}
                      className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Warning if game is already started */}
          {gameId && gameStatus && gameStatus !== 'scheduled' && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-yellow-800">
                    La anotación ya ha comenzado
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    No se puede cambiar la asignación de equipos (Home/Away) una vez que la anotación ha iniciado. 
                    Para cambiar los equipos, debes borrar la anotación y crear un nuevo juego.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableTeams.map((team) => {
              // Determine if this is Dodgers (home) or opponent
              const isDodgers = team.name === 'Dodgers' || team.id === gameTeams.homeTeamId
              const isOpponent = team.id === gameTeams.opponentTeamId
              
              // Check if lineup is saved for this team
              const hasLineupSaved = gameId && (
                (isDodgers && gameLineupStatus.homeTeamLineupSaved) ||
                (isOpponent && gameLineupStatus.opponentTeamLineupSaved)
              )
              
              return (
                <button
                  key={team.id}
                  onClick={() => selectTeam(team.id)}
                  className={`p-3 border rounded-lg text-left transition-colors relative ${
                    selectedTeam === team.id
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {/* Lineup Saved Indicator */}
                  {hasLineupSaved && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-green-500 text-white rounded-full p-1.5 shadow-md" title="Alineación guardada para este juego">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  {/* Lineup Not Saved Indicator */}
                  {gameId && !hasLineupSaved && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-yellow-500 text-white rounded-full p-1.5 shadow-md" title="Alineación pendiente para este juego">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  <div className="font-medium pr-8">{team.name}</div>
                  <div className="text-sm text-gray-600">{team.city}</div>
                  <div className="text-xs text-gray-500">
                    {team.players?.length || 0} jugadores
                  </div>
                  {gameId && isDodgers && (
                    <div className="text-xs text-blue-600 font-medium mt-1">(Dodgers - Equipo Local)</div>
                  )}
                  {gameId && isOpponent && (
                    <div className="text-xs text-red-600 font-medium mt-1">(Equipo Visitante)</div>
                  )}
                  
                  {/* Status Badge */}
                  {gameId && (
                    <div className={`mt-2 text-xs font-semibold px-2 py-1 rounded ${
                      hasLineupSaved 
                        ? 'text-green-700 bg-green-100' 
                        : 'text-yellow-700 bg-yellow-100'
                    }`}>
                      {hasLineupSaved 
                        ? '✓ Listo' 
                        : '⚠ Alineación pendiente - Selecciona una plantilla'}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {gameId && availableTeams.length === 0 && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">
                No se encontraron equipos para este juego. Por favor, asegúrate de que Dodgers existe y el equipo oponente esté configurado.
              </p>
            </div>
          )}
          
          {/* Start Scoring Button - Bottom right inside modal */}
          {gameId && gameLineupStatus.homeTeamLineupSaved && gameLineupStatus.opponentTeamLineupSaved && !showHomeAwaySelection && homeTeamId && awayTeamId && (
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  if (onStartScoring) {
                    onStartScoring()
                  } else {
                    onClose()
                  }
                }}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium text-base shadow-lg transition-all hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Iniciar Anotación
              </button>
            </div>
          )}
        </div>
      )}

      {/* Template Selection Mode */}
      {currentTeam && mode === 'select' && gameId && !showTeamSelection && (
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
                    <div className="space-y-2">
                      {lineupEntries.map((entry: { playerId: string; position: string; player?: { id: string; first_name: string; last_name: string; jersey_number: number } }, index: number) => {
                        if (entry.playerId && entry.position) {
                          const player = entry.player || currentTeam.players?.find((p: { id: string }) => p.id === entry.playerId)
                          return (
                            <div key={index} className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-bold text-blue-800 bg-blue-200 px-2 py-1 rounded-full min-w-[2rem] text-center">
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
      {currentTeam && mode === 'create' && !showTeamSelection && (
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
            </div>
          </div>

          {/* Players Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-blue-800">Jugadores Disponibles:</h5>
              <span className="text-xs text-blue-600">
                {teamPlayersFromTemplates.length > 0 
                  ? `${teamPlayersFromTemplates.length} de plantillas guardadas`
                  : allTeamPlayers.length > 0
                    ? `${allTeamPlayers.length} del equipo`
                    : 'Sin jugadores guardados'}
              </span>
            </div>
            {teamPlayersFromTemplates.length > 0 ? (
              <div className="text-xs text-blue-700">
                <p className="mb-1">✓ Jugadores encontrados en plantillas guardadas de este equipo:</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {teamPlayersFromTemplates.slice(0, 10).map((player) => (
                    <span key={player.id} className="bg-white px-2 py-1 rounded border border-blue-200">
                      {player.first_name} {player.last_name} #{player.jersey_number}
                    </span>
                  ))}
                  {teamPlayersFromTemplates.length > 10 && (
                    <span className="bg-white px-2 py-1 rounded border border-blue-200">
                      +{teamPlayersFromTemplates.length - 10} más
                    </span>
                  )}
                </div>
              </div>
            ) : allTeamPlayers.length > 0 ? (
              <div className="text-xs text-blue-700">
                <p className="mb-1">✓ Jugadores del equipo disponibles:</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {allTeamPlayers.slice(0, 10).map((player) => (
                    <span key={player.id} className="bg-white px-2 py-1 rounded border border-blue-200">
                      {player.first_name} {player.last_name} #{player.jersey_number}
                    </span>
                  ))}
                  {allTeamPlayers.length > 10 && (
                    <span className="bg-white px-2 py-1 rounded border border-blue-200">
                      +{allTeamPlayers.length - 10} más
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-yellow-700">
                <p className="mb-2">⚠ No hay jugadores guardados en plantillas previas para este equipo.</p>
                <p className="mb-2">Puedes seleccionar jugadores de la base de datos del equipo o agregar nuevos jugadores desde la sección de Jugadores.</p>
                <p className="text-red-600 font-semibold">
                  Si no ves jugadores en el dropdown, asegúrate de que el equipo tenga jugadores asignados en la sección de Jugadores.
                </p>
              </div>
            )}
            {availablePlayers.length === 0 && selectedTeam && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded p-2">
                <p className="text-xs text-red-700 font-semibold">
                  ⚠ No hay jugadores disponibles para este equipo. 
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Ve a la sección "Jugadores" en el menú principal para agregar jugadores a este equipo primero.
                </p>
              </div>
            )}
          </div>

          {localStorage.getItem(`lineup_${selectedTeam}`) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <span className="text-sm bg-green-100 text-green-800 px-3 py-2 rounded-lg font-medium">
                ✓ Datos guardados localmente
              </span>
            </div>
          )}

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
                      <div className="flex items-center gap-2">
                        <select
                          value={lineupEntries[index]?.playerId || ''}
                          onChange={(e) => {
                            console.log('Player selected:', e.target.value, 'for position', index + 1)
                            updatePlayerInLineup(index, e.target.value)
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={availablePlayers.length === 0 && !lineupEntries[index]?.playerId}
                        >
                          <option value="">Seleccionar jugador...</option>
                          {/* Always show selected player first if exists */}
                          {lineupEntries[index]?.playerId && (() => {
                            const selectedPlayer = 
                              allTeamPlayers.find(p => p.id === lineupEntries[index].playerId) ||
                              teamPlayersFromTemplates.find(p => p.id === lineupEntries[index].playerId) ||
                              availablePlayers.find(p => p.id === lineupEntries[index].playerId)
                            
                            if (selectedPlayer) {
                              return (
                                <option key={selectedPlayer.id} value={selectedPlayer.id}>
                                  {selectedPlayer.first_name} {selectedPlayer.last_name} #{selectedPlayer.jersey_number}
                                </option>
                              )
                            }
                            return null
                          })()}
                          {/* Show available players (excluding the one already selected for this row) */}
                          {availablePlayers
                            .filter(player => player.id !== lineupEntries[index]?.playerId)
                            .map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.first_name} {player.last_name} #{player.jersey_number}
                              </option>
                            ))}
                          {/* Fallback: if no available players and no selected player, show message */}
                          {availablePlayers.length === 0 && !lineupEntries[index]?.playerId && (
                            <option value="" disabled>
                              {selectedTeam ? 'No hay jugadores disponibles' : 'Selecciona un equipo primero'}
                            </option>
                          )}
                          {/* Fallback: if selected player is not in available list, show it anyway */}
                          {lineupEntries[index]?.playerId && !allTeamPlayers.find(p => p.id === lineupEntries[index].playerId) && !teamPlayersFromTemplates.find(p => p.id === lineupEntries[index].playerId) && (
                            <option value={lineupEntries[index].playerId}>
                              {getPlayerName(lineupEntries[index].playerId)}
                            </option>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setAddPlayerForIndex(index)
                            setShowAddPlayerModal(true)
                          }}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 whitespace-nowrap"
                          title="Agregar nuevo jugador al equipo"
                        >
                          + Agregar
                        </button>
                      </div>
                      {availablePlayers.length === 0 && selectedTeam && (
                        <p className="text-xs text-red-600 mt-1">
                          No hay jugadores disponibles. Puedes agregar uno usando el botón "+ Agregar" arriba.
                        </p>
                      )}
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
              onClick={() => {
                console.log('🟢🟢🟢 BUTTON CLICKED - saveLineup 🟢🟢🟢')
                saveLineup()
              }}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : (gameId ? 'Guardar Plantilla' : 'Guardar Alineación')}
          </button>
        </div>
      </div>
      )}

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Agregar Nuevo Jugador
              </h3>
              <button
                onClick={() => {
                  setShowAddPlayerModal(false)
                  setAddPlayerForIndex(null)
                  setNewPlayerData({ first_name: '', last_name: '', jersey_number: 0 })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPlayerData.first_name}
                  onChange={(e) => setNewPlayerData({ ...newPlayerData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Juan"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPlayerData.last_name}
                  onChange={(e) => setNewPlayerData({ ...newPlayerData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Pérez"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Camiseta (Opcional)
                </label>
                <input
                  type="number"
                  value={newPlayerData.jersey_number || ''}
                  onChange={(e) => setNewPlayerData({ ...newPlayerData, jersey_number: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 23"
                  min="0"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Nota:</strong> Solo se guardará la información básica. Puedes agregar más detalles (fecha de nacimiento, posiciones, etc.) más tarde desde la sección de Jugadores.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPlayerModal(false)
                    setAddPlayerForIndex(null)
                    setNewPlayerData({ first_name: '', last_name: '', jersey_number: 0 })
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingPlayer || !newPlayerData.first_name.trim() || !newPlayerData.last_name.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingPlayer ? 'Agregando...' : 'Agregar Jugador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Player Modal */}
      {showDuplicateModal && duplicatePlayerInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Jugador Duplicado Encontrado
              </h3>
              <button
                onClick={handleCancelDuplicate}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 mb-3">
                Ya existe un jugador con el nombre <strong>"{duplicatePlayerInfo.first_name} {duplicatePlayerInfo.last_name}"</strong> en el sistema.
              </p>
              <p className="text-xs text-yellow-700">
                Por favor verifica si es el mismo jugador antes de continuar.
              </p>
            </div>

            {/* Existing Player Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Jugador Existente:</h4>
              <div className="flex items-start gap-4">
                {/* Player Photo */}
                <div className="flex-shrink-0">
                  {duplicatePlayerInfo.photo_url ? (
                    <img
                      src={duplicatePlayerInfo.photo_url}
                      alt={`${duplicatePlayerInfo.first_name} ${duplicatePlayerInfo.last_name}`}
                      className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"%3E%3C/%3E%3Ccircle cx="12" cy="7" r="4"%3E%3C/%3E%3C/%3E%3C/svg%3E'
                        ;(e.target as HTMLImageElement).className = 'w-24 h-24 bg-gray-200 rounded-lg border-2 border-gray-300 p-4'
                      }}
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-200 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Player Details */}
                <div className="flex-1">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Nombre</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {duplicatePlayerInfo.first_name} {duplicatePlayerInfo.last_name}
                      </p>
                    </div>
                    {duplicatePlayerInfo.jersey_number && (
                      <div>
                        <p className="text-xs text-gray-500">Número de Camiseta</p>
                        <p className="text-sm text-gray-800">#{duplicatePlayerInfo.jersey_number}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Equipo</p>
                      <p className="text-sm text-gray-800">
                        {duplicatePlayerInfo.team_city ? `${duplicatePlayerInfo.team_city} ` : ''}
                        {duplicatePlayerInfo.team_name}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleCancelDuplicate}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateDuplicateAnyway}
                disabled={addingPlayer}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingPlayer ? 'Agregando...' : 'Agregar de Todas Formas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}