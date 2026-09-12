'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import OpponentLineupEntry from './OpponentLineupEntry'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, Home, Pencil, Plane, Play, Plus, Save, UserPlus, Users, Zap } from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, FormField, Input, LoadingState, Modal, Select } from '@/components/ui'
import { cn } from '@/lib/utils'

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
  battingFor?: string  // Player ID that the DH is batting for (only for 10th row)
}

interface TemplatePlayerRow {
  player_id: string
  position: string
  batting_for?: string | null
}

interface TemplatePlayerInsert {
  template_id: string
  player_id: string
  batting_order: number
  position: string
  batting_for?: string
}

type PrepStep = 'batting' | 'ours' | 'opponent' | 'review'

interface PreviewRow {
  batting_order: number
  position: string
  batting_for?: string | null
  players?: { first_name: string; last_name: string; jersey_number: number } | null
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
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false)
  const [newPlayerData, setNewPlayerData] = useState({
    first_name: '',
    last_name: '',
    jersey_number: '',
    positions: [] as string[]
  })
  const [creatingPlayer, setCreatingPlayer] = useState(false)
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
  const [step, setStep] = useState<PrepStep | null>(null) // null = first incomplete step
  const [quickEntry, setQuickEntry] = useState(false) // opponent lineup typed by name
  const [previews, setPreviews] = useState<{ ours: PreviewRow[]; opponent: PreviewRow[] }>({ ours: [], opponent: [] })

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

  // Load read-only previews of both saved lineups for the summary step
  useEffect(() => {
    if (!gameId || !gameInfo) return
    let cancelled = false
    const load = async (templateId?: string | null): Promise<PreviewRow[]> => {
      if (!templateId) return []
      const { data } = await supabase
        .from('lineup_template_players')
        .select('batting_order, position, batting_for, players ( first_name, last_name, jersey_number )')
        .eq('template_id', templateId)
        .order('batting_order')
      return (data || []) as unknown as PreviewRow[]
    }
    Promise.all([load(gameInfo.lineup_template_id), load(gameInfo.opponent_lineup_template_id)]).then(([ours, opponent]) => {
      if (!cancelled) setPreviews({ ours, opponent })
    })
    return () => {
      cancelled = true
    }
  }, [gameId, gameInfo, selectedTeam])

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
      let gameData: GameInfo | null = null
      
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
      
      // If opponent team doesn't exist in database, create a virtual team object
      if (!opponentTeam && gameData.opponent) {
        opponentTeam = {
          id: `opponent_${gameId || 'temp'}`,
          name: gameData.opponent,
          city: 'Opponent',
          players: []
        }
      }
      
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

  async function selectTeam(teamId: string, skipLoadingExisting: boolean = false) {
    const team = teams.find(t => t.id === teamId)
    if (team) {
      setSelectedTeam(teamId)
      
      // If skipLoadingExisting is true, don't load existing lineups (for new template creation)
      if (skipLoadingExisting) {
        return
      }
      
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
                batting_for,
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
              const loadedEntries: LineupEntry[] = templatePlayers.map((tp: TemplatePlayerRow) => ({
                playerId: tp.player_id,
                position: getPositionFromDb(tp.position),
                battingFor: tp.batting_for || undefined
              }))
              
              // Check if DH is in the lineup
              const hasDHInLineup = loadedEntries.some(entry => 
                entry.position === 'Bateador Designado (DH)'
              )
              setHasDH(hasDHInLineup)
              
              // If DH is in lineup, ensure we have 10 entries (10th row is for who DH is batting for)
              if (hasDHInLineup && loadedEntries.length === 9) {
                // Find the batting_for from the DH entry
                const dhEntry = templatePlayers.find((tp: TemplatePlayerRow) => tp.position === 'DH')
                loadedEntries.push({ 
                  playerId: dhEntry?.batting_for || '', 
                  position: 'Lanzador (P)',
                  battingFor: undefined
                })
              }
              
              setLineupEntries(loadedEntries)
              
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
        initialEntries.push({ 
          playerId: '', 
          position: i === 9 ? 'Lanzador (P)' : '',  // 10th row defaults to Pitcher position
          battingFor: i === 9 ? '' : undefined  // Only 10th row has battingFor
        })
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
    
    // Check if DH is selected anywhere in the lineup
    const hasDHSelected = newEntries.some(entry => entry.position === 'Bateador Designado (DH)')
    setHasDH(hasDHSelected)
    
    // If DH is selected, ensure 10th row exists for selecting who DH is batting for
    if (hasDHSelected && newEntries.length === 9) {
      newEntries.push({ playerId: '', position: 'Lanzador (P)', battingFor: undefined })
    }
    
    // If DH is removed, hide 10th row
    if (!hasDHSelected && newEntries.length === 10) {
      const newEntriesWithoutDH = newEntries.slice(0, 9)
      setLineupEntries(newEntriesWithoutDH)
      return
    }
    
    setLineupEntries(newEntries)
  }

  function getAvailablePlayers(rowIndex?: number) {
    if (!selectedTeam) return []
    const team = teams.find(t => t.id === selectedTeam)
    if (!team?.players) return []
    
    // For the 10th row (DH batting for), show all players including those already in lineup
    if (rowIndex === 9) {
      return team.players
    }
    
    const usedPlayerIds = lineupEntries.map(entry => entry.playerId).filter(id => id !== '')
    return team.players.filter(player => !usedPlayerIds.includes(player.id))
  }

  function getAvailablePositions(currentIndex: number) {
    const usedPositions = lineupEntries
      .map((entry, index) => index !== currentIndex ? entry.position : '')
      .filter(position => position !== '')
    
    return fieldPositions.filter(position => !usedPositions.includes(position))
  }

  async function createNewPlayer() {
    if (!selectedTeam) return
    
    setCreatingPlayer(true)
    try {
      const team = teams.find(t => t.id === selectedTeam)
      if (!team) {
        alert('Error: Equipo no encontrado')
        return
      }

      // Create the player
      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert([{
          first_name: newPlayerData.first_name,
          last_name: newPlayerData.last_name,
          jersey_number: parseInt(newPlayerData.jersey_number) || 0,
          positions: newPlayerData.positions.length > 0 ? newPlayerData.positions : ['P'],
          team_id: selectedTeam,
          date_of_birth: new Date().toISOString().split('T')[0], // Required field, use today's date as default
          handedness: 'Righty', // Default
          is_active: true
        }])
        .select('id, first_name, last_name, jersey_number, positions')
        .single()

      if (playerError) {
        console.error('Error creating player:', playerError)
        alert(`Error al crear jugador: ${playerError.message}`)
        return
      }

      // Refresh team players
      const { data: teamData, error: teamError } = await supabase
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
        .eq('id', selectedTeam)
        .single()

      if (teamError) {
        console.error('Error refreshing team:', teamError)
      } else if (teamData) {
        // Update teams state
        setTeams(teams.map(t => t.id === selectedTeam ? teamData as Team : t))
        
        // Update gameTeams if this is one of the game teams
        if (gameTeams.ourTeam?.id === selectedTeam) {
          setGameTeams({ ...gameTeams, ourTeam: teamData as Team })
        } else if (gameTeams.opponentTeam?.id === selectedTeam) {
          setGameTeams({ ...gameTeams, opponentTeam: teamData as Team })
        }
      }

      // Close modal and reset form
      setShowAddPlayerModal(false)
      setNewPlayerData({
        first_name: '',
        last_name: '',
        jersey_number: '',
        positions: []
      })
    } catch (err) {
      console.error('Error creating player:', err)
      alert('Error al crear jugador')
    } finally {
      setCreatingPlayer(false)
    }
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

  function selectLineupTemplate(template: LineupEntry[]) {
    // Check if DH is in the template
    const hasDHInTemplate = template.some(entry => entry.position === 'Bateador Designado (DH)')
    // A DH lineup needs the 10th row (who the DH bats for); templates only store 9 rows
    const entries = hasDHInTemplate && template.length === 9
      ? [...template, { playerId: '', position: 'Lanzador (P)', battingFor: undefined }]
      : template
    setLineupEntries(entries)
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

      // Check if selectedTeam is a virtual opponent team (starts with 'opponent_')
      let actualTeamId = selectedTeam
      if (selectedTeam && selectedTeam.startsWith('opponent_')) {
        // This is a virtual opponent team, we need to create it or find it
        const opponentName = gameInfo?.opponent
        if (opponentName) {
          // Try to find existing team first
          const { data: existingTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('name', opponentName)
            .single()
          
          if (existingTeam) {
            actualTeamId = existingTeam.id
          } else {
            // Create the opponent team
            const { data: newTeam, error: createError } = await supabase
              .from('teams')
              .insert([{
                name: opponentName,
                city: 'Opponent'
              }])
              .select('id')
              .single()
            
            if (createError || !newTeam) {
              throw new Error('Failed to create opponent team')
            }
            actualTeamId = newTeam.id
            
            // Update gameTeams with the new team
            const updatedOpponentTeam = {
              id: newTeam.id,
              name: opponentName,
              city: 'Opponent',
              players: []
            }
            setGameTeams({ ...gameTeams, opponentTeam: updatedOpponentTeam })
            setTeams([gameTeams.ourTeam, updatedOpponentTeam].filter(Boolean) as Team[])
          }
        }
      }
      
      // Create or update lineup template for this team
      const { data: existingTemplate } = await supabase
        .from('lineup_templates')
        .select('id')
        .eq('team_id', actualTeamId)
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
            team_id: actualTeamId,
            name: 'Default Lineup'
          }])
          .select('id')
          .single()

        if (templateError || !newTemplate) {
          throw new Error('Failed to create lineup template')
        }
        templateId = newTemplate.id
      }

      // Before creating lineup template players, check if any players need to be created
      // This handles cases where players were added but don't exist in the database yet
      const playerIdsToCheck = filledEntries
        .filter((entry) => entry.playerId && entry.playerId.trim() !== '')
        .map(entry => entry.playerId)
      
      // Check which players exist in the database
      const { data: existingPlayers, error: checkError } = await supabase
        .from('players')
        .select('id')
        .in('id', playerIdsToCheck)
      
      if (checkError) {
        console.error('Error checking existing players:', checkError)
      }
      
      const existingPlayerIds = new Set((existingPlayers || []).map(p => p.id))
      const missingPlayerIds = playerIdsToCheck.filter(id => !existingPlayerIds.has(id))
      
      // If there are missing players, we need to create them
      // This shouldn't normally happen, but handle it gracefully
      if (missingPlayerIds.length > 0) {
        console.warn('Some players in lineup do not exist in database:', missingPlayerIds)
        // For now, we'll skip these entries - in a real scenario, you'd want to create them
        // or show an error to the user
      }

      // Create lineup template players
      // Find the DH entry to get who it's batting for from the 10th row
      const dhEntry = filledEntries.find((entry, idx) => entry.position === 'Bateador Designado (DH)')
      const dhBattingFor = dhEntry && filledEntries.length === 10 ? filledEntries[9].playerId : null
      
      // Filter to only first 9 rows with valid player IDs that exist in database
      const validEntries = filledEntries
        .filter((entry, index) => index < 9) // Only save first 9 rows (10th row is just for reference)
        .filter((entry) => entry.playerId && entry.playerId.trim() !== '' && existingPlayerIds.has(entry.playerId)) // Only save entries with valid player IDs that exist
      
      const templatePlayers = validEntries.map((entry, index) => {
        const playerData: TemplatePlayerInsert = {
          template_id: templateId,
          player_id: entry.playerId,
          batting_order: index + 1,
          position: positionMap[entry.position] || 'DH'
        }
        
        // Only add batting_for if it's the DH entry and we have a valid player ID
        if (entry.position === 'Bateador Designado (DH)' && dhBattingFor && dhBattingFor.trim() !== '') {
          playerData.batting_for = dhBattingFor
        }
        
        return playerData
      })

      const { error: templatePlayersError } = await supabase
        .from('lineup_template_players')
        .insert(templatePlayers)

      // Only treat as error if it has actual error properties (message, code, etc.)
      if (templatePlayersError && (templatePlayersError.message || templatePlayersError.code || Object.keys(templatePlayersError).length > 0)) {
        console.error('Error saving lineup template players:', templatePlayersError)
        console.error('Template players data:', templatePlayers)
        
        // If error is about batting_for column not existing, try without it
        if (templatePlayersError.message && templatePlayersError.message.includes('batting_for')) {
          console.log('batting_for column not found, trying without it...')
          const templatePlayersWithoutBattingFor = templatePlayers.map(({ batting_for, ...rest }) => rest)
          
          const { error: retryError } = await supabase
            .from('lineup_template_players')
            .insert(templatePlayersWithoutBattingFor)
          
          if (retryError && (retryError.message || retryError.code)) {
            throw new Error(`Failed to save lineup template players: ${retryError.message || JSON.stringify(retryError)}`)
          }
        } else if (templatePlayersError.message || templatePlayersError.code) {
          throw new Error(`Failed to save lineup template players: ${templatePlayersError.message || JSON.stringify(templatePlayersError)}`)
        }
        // If error object is empty or has no meaningful error info, ignore it (save likely succeeded)
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
        
        const updateData: { lineup_template_id?: string; opponent_lineup_template_id?: string } = {}
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

      // Refresh team players to include any newly created players
      if (actualTeamId) {
        const { data: refreshedTeam, error: refreshError } = await supabase
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
          .eq('id', actualTeamId)
          .single()
        
        if (!refreshError && refreshedTeam) {
          // Update teams state
          setTeams(teams.map(t => t.id === actualTeamId ? refreshedTeam as Team : t))
          
          // Update gameTeams if this is one of the game teams
          if (gameTeams.ourTeam?.id === actualTeamId) {
            setGameTeams({ ...gameTeams, ourTeam: refreshedTeam as Team })
          } else if (gameTeams.opponentTeam?.id === actualTeamId) {
            setGameTeams({ ...gameTeams, opponentTeam: refreshedTeam as Team })
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

  // ---------------------------------------------------------------------------
  // Guided game-preparation flow (only when a gameId is provided)
  // ---------------------------------------------------------------------------
  const done = {
    batting: !!gameInfo?.batting_first,
    ours: !!gameInfo?.lineup_template_id,
    opponent: !!gameInfo?.opponent_lineup_template_id,
  }
  const allDone = done.batting && done.ours && done.opponent
  const firstIncomplete: PrepStep = !done.batting ? 'batting' : !done.ours ? 'ours' : !done.opponent ? 'opponent' : 'review'
  const activeStep: PrepStep = step ?? firstIncomplete
  const STEPS: { key: PrepStep; label: string; short: string }[] = [
    { key: 'batting', label: 'Local y visitante', short: 'Orden' },
    { key: 'ours', label: 'Nuestra alineación', short: 'Nosotros' },
    { key: 'opponent', label: 'Alineación del oponente', short: 'Oponente' },
    { key: 'review', label: 'Resumen e inicio', short: 'Resumen' },
  ]
  const stepIndex = STEPS.findIndex((s) => s.key === activeStep)
  const stepDone = (key: PrepStep) => (key === 'review' ? allDone : done[key])
  const goTo = (key: PrepStep) => {
    setStep(key)
    setQuickEntry(false)
  }

  function blankEntries(): LineupEntry[] {
    const entries: LineupEntry[] = []
    for (let i = 0; i < 9; i++) {
      entries.push({ playerId: '', position: '', battingFor: undefined })
    }
    return entries
  }

  // Start a brand-new lineup for a team (skips loading the saved one)
  async function startBlankLineup(teamIdToEdit: string) {
    await selectTeam(teamIdToEdit, true)
    setHasDH(false)
    setLineupEntries(blankEntries())
    setMode('create')
  }

  // Load the team's saved lineup into the editor
  async function editExistingLineup(teamIdToEdit: string) {
    await selectTeam(teamIdToEdit)
    setMode('create')
  }

  // Show the team's saved templates to pick from
  function changeTemplate(teamIdToEdit: string) {
    setSelectedTeam(teamIdToEdit)
    setMode('select')
  }

  // Leave the editor and go back to the step overview
  function leaveWorkspace() {
    setSelectedTeam(null)
    setLineupEntries([])
    setMode('select')
  }

  // Make sure the opponent exists as a real team before editing its lineup
  async function ensureOpponentTeam(): Promise<string | null> {
    if (!gameInfo) return null
    let opponentTeamId = gameTeams.opponentTeam?.id

    if (!opponentTeamId || opponentTeamId.startsWith('opponent_')) {
      // Create the opponent team in the database
      const { data: newTeam, error: createError } = await supabase
        .from('teams')
        .insert([{
          name: gameInfo.opponent,
          city: 'Opponent'
        }])
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating opponent team:', createError)
        alert('Error al crear el equipo oponente')
        return null
      }

      opponentTeamId = newTeam.id

      // Update gameTeams with the new team
      const updatedOpponentTeam = {
        id: newTeam.id,
        name: gameInfo.opponent,
        city: 'Opponent',
        players: []
      }
      setGameTeams({ ...gameTeams, opponentTeam: updatedOpponentTeam })
      setTeams([gameTeams.ourTeam, updatedOpponentTeam].filter(Boolean) as Team[])
    }
    return opponentTeamId ?? null
  }

  async function setBattingFirst(newBattingFirst: 'home' | 'opponent') {
    if (!gameId || !gameInfo) return
    const { error } = await supabase
      .from('games')
      .update({ batting_first: newBattingFirst })
      .eq('id', gameId)
    if (!error && gameInfo) {
      setGameInfo({ ...gameInfo, batting_first: newBattingFirst })
      setHomeTeam(newBattingFirst === 'home' ? 'our' : 'opponent')
    }
  }

  async function startScoring() {
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
  }

  if (loading && !gameInfo && teams.length === 0) {
    return <LoadingState label="Cargando equipos..." />
  }

  if (error) {
    return (
      <Alert variant="error" title={`Error: ${error}`}>
        <Button
          variant="destructive"
          size="sm"
          className="mt-2"
          onClick={() => {
            setError(null)
            fetchTeams()
          }}
        >
          Reintentar
        </Button>
      </Alert>
    )
  }

  const currentTeam = selectedTeam ? teams.find(t => t.id === selectedTeam) : null
  const maxRows = hasDH ? 10 : 9
  const pendingCount = maxRows - lineupEntries.slice(0, maxRows).filter(entry => entry.playerId && entry.position).length

  // ---------------------------------------------------------------------------
  // Workspace: template picker ("select") or lineup editor ("create") for currentTeam
  // ---------------------------------------------------------------------------
  const workspace = currentTeam && (
    <div className="space-y-5">
      {/* Template Selection Mode */}
      {mode === 'select' && gameId && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-semibold">Plantillas guardadas de {currentTeam.name}</h4>
              <p className="text-sm text-muted-foreground">Usa una plantilla como punto de partida o crea una nueva.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={leaveWorkspace}>
                <ArrowLeft />
                Volver
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  // Clear lineup entries and reset DH when creating new template
                  setHasDH(false)
                  setLineupEntries(blankEntries())
                  setMode('create')
                }}
              >
                <Plus />
                Crear nueva
              </Button>
            </div>
          </div>

          {savedTemplates.length > 0 ? (
            <div className="space-y-3">
              {savedTemplates.map((template) => {
                const lineupEntries = template.lineup_template_players
                  ?.sort((a: LineupTemplatePlayer, b: LineupTemplatePlayer) => a.batting_order - b.batting_order)
                  .map((ltp: LineupTemplatePlayer) => ({
                    playerId: ltp.player_id,
                    position: getPositionFromDb(ltp.position),
                    player: ltp.players
                  })) || []
                return (
                  <Card key={template.id} className="p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h6 className="flex items-center gap-2 text-sm font-semibold">
                        <ClipboardList className="size-4 text-primary" />
                        {template.name || 'Default Lineup'}
                      </h6>
                      <Button
                        size="sm"
                        onClick={() => {
                          const entries = lineupEntries.map((e: { playerId: string; position: string }) => ({
                            playerId: e.playerId,
                            position: e.position
                          }))
                          selectLineupTemplate(entries)
                        }}
                      >
                        Usar esta plantilla
                        <ArrowRight />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {lineupEntries.map((entry: { playerId: string; position: string; player?: { id: string; first_name: string; last_name: string; jersey_number: number } }, index: number) => {
                        if (entry.playerId && entry.position) {
                          const player = entry.player || currentTeam.players?.find((p: { id: string }) => p.id === entry.playerId)
                          return (
                            <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2">
                              <div className="flex min-w-0 items-center gap-3">
                                <OrderChip n={index + 1} />
                                <span className="truncate text-sm font-medium">
                                  {player ? `${player.first_name} ${player.last_name} #${player.jersey_number}` : 'Jugador no encontrado'}
                                </span>
                              </div>
                              <Badge variant="primary">{entry.position}</Badge>
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={<ClipboardList />}
              title="No hay plantillas guardadas"
              description="No se encontraron plantillas guardadas para este equipo."
              action={
                <Button
                  variant="warning"
                  onClick={() => {
                    // Clear lineup entries and reset DH when creating new template
                    setHasDH(false)
                    setLineupEntries(blankEntries())
                    setMode('create')
                  }}
                >
                  <Plus />
                  Crear primera plantilla
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* Lineup Grid - Create/Edit Mode */}
      {mode === 'create' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-semibold">
                {gameId ? 'Alineación' : 'Alineación'} de {currentTeam.name}
              </h4>
              <p className="text-sm text-muted-foreground">
                Asigna jugador y posición a cada turno al bat. {hasDH ? '10 filas (con DH).' : '9 filas.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {gameId && (
                <Button variant="outline" size="sm" onClick={() => setMode('select')}>
                  <ClipboardList />
                  Ver plantillas
                </Button>
              )}
              <Badge variant={pendingCount === 0 ? 'success' : 'warning'}>
                {pendingCount === 0 ? (
                  <>
                    <CheckCircle2 /> Completa
                  </>
                ) : (
                  <>
                    <AlertTriangle /> {pendingCount} pendientes
                  </>
                )}
              </Badge>
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-12 px-3 py-2 text-center font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Jugador</th>
                  <th className="w-[44%] px-3 py-2 font-semibold">Posición</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }, (_, index) => {
                  const rowComplete = !!lineupEntries[index]?.playerId && !!lineupEntries[index]?.position
                  return (
                    <tr key={index} className={cn('border-t border-border', index === 9 && 'bg-blue-50/60')}>
                      {/* Batting Order Number */}
                      <td className="px-3 py-2 text-center">
                        <OrderChip n={index + 1} done={rowComplete} dh={index === 9} />
                      </td>
                      {/* Player Selection */}
                      <td className="px-3 py-2">
                        {index === 9 && hasDH ? (
                          // 10th row: Show player selection for "who DH is batting for"
                          <Select
                            value={lineupEntries[index]?.playerId || ''}
                            onChange={(e) => updatePlayerInLineup(index, e.target.value)}
                          >
                            <option value="">Seleccionar jugador (DH batea por)...</option>
                            {getAvailablePlayers(9).map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.first_name} {player.last_name} #{player.jersey_number}
                              </option>
                            ))}
                            {lineupEntries[index]?.playerId && (
                              <option value={lineupEntries[index].playerId}>
                                {getPlayerName(lineupEntries[index].playerId)}
                              </option>
                            )}
                          </Select>
                        ) : (
                          // Regular rows: Show player selection
                          <div className="flex gap-2">
                            <div className="min-w-0 flex-1">
                              <Select
                                value={lineupEntries[index]?.playerId || ''}
                                onChange={(e) => updatePlayerInLineup(index, e.target.value)}
                              >
                                <option value="">Seleccionar jugador...</option>
                                {getAvailablePlayers(index).map((player) => (
                                  <option key={player.id} value={player.id}>
                                    {player.first_name} {player.last_name} #{player.jersey_number}
                                  </option>
                                ))}
                                {lineupEntries[index]?.playerId && (
                                  <option value={lineupEntries[index].playerId}>
                                    {getPlayerName(lineupEntries[index].playerId)}
                                  </option>
                                )}
                              </Select>
                            </div>
                            {getAvailablePlayers(index).length === 0 && (
                              <Button
                                type="button"
                                variant="success"
                                size="sm"
                                onClick={() => setShowAddPlayerModal(true)}
                                title="Agregar nuevo jugador"
                              >
                                <UserPlus />
                                Agregar
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Position Selection */}
                      <td className="px-3 py-2">
                        {index === 9 && hasDH ? (
                          // 10th row: Show position dropdown with "Lanzador (P)" as default
                          <Select
                            value={lineupEntries[index]?.position || 'Lanzador (P)'}
                            onChange={(e) => updatePositionInLineup(index, e.target.value)}
                          >
                            <option value="Lanzador (P)">Lanzador (P)</option>
                          </Select>
                        ) : (
                          // Regular rows: Show position selection
                          <Select
                            value={lineupEntries[index]?.position || ''}
                            onChange={(e) => updatePositionInLineup(index, e.target.value)}
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
                          </Select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* DH Info */}
          {hasDH && (
            <Alert variant="info" title="Bateador Designado (DH) seleccionado. Se habilitó la fila 10.">
              En la fila 10, selecciona el jugador por el cual el DH está bateando (típicamente el lanzador).
            </Alert>
          )}

          {/* Position Status */}
          <div className="rounded-xl border border-border bg-slate-50 p-3">
            <h6 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posiciones asignadas</h6>
            <div className="flex flex-wrap gap-2">
              {lineupEntries.slice(0, maxRows).map((entry, index) => {
                if (entry.position) {
                  return (
                    <Badge key={index} variant="success">
                      {index + 1}. {entry.position}
                    </Badge>
                  )
                }
                return null
              })}
              {lineupEntries.slice(0, maxRows).filter(entry => !entry.position).length > 0 && (
                <Badge variant="default">
                  {lineupEntries.slice(0, maxRows).filter(entry => !entry.position).length} posiciones pendientes
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={gameId ? leaveWorkspace : onClose}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={saveLineup} loading={saving}>
              <Save />
              {saving ? 'Guardando...' : (gameId ? 'Guardar alineación' : 'Guardar Alineación')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  // ---------------------------------------------------------------------------
  // Team step: summary card + workspace (used for both our team and the opponent)
  // ---------------------------------------------------------------------------
  function renderTeamStep(side: 'ours' | 'opponent') {
    if (!gameInfo) return null
    const team = side === 'ours' ? gameTeams.ourTeam : gameTeams.opponentTeam
    const name = side === 'ours' ? (team?.name ?? '') : (gameInfo.opponent || team?.name || '')
    const isDone = done[side]
    const preview = previews[side]
    const rosterSize = team?.players?.length || 0
    const editingThisTeam = !!currentTeam && !!team && currentTeam.id === team.id

    if (editingThisTeam) return workspace

    if (side === 'opponent' && quickEntry && gameId) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold">Captura rápida de {name}</h4>
              <p className="text-sm text-muted-foreground">Escribe nombre y posición de cada bateador. Se crearán como jugadores del oponente.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setQuickEntry(false)}>
              <ArrowLeft />
              Volver
            </Button>
          </div>
          <OpponentLineupEntry
            embedded
            gameId={gameId}
            opponentName={name}
            onClose={() => {
              setQuickEntry(false)
              fetchGameInfo()
            }}
          />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg font-bold text-slate-500">
                {name.charAt(0)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold">{name}</h4>
                  {isDone ? (
                    <Badge variant="success"><CheckCircle2 /> Alineación elegida</Badge>
                  ) : (
                    <Badge variant="warning"><AlertTriangle /> Alineación pendiente</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {side === 'ours' ? (team?.city ?? '') : 'Oponente'} · {rosterSize} jugadores en el roster
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isDone && team ? (
                <>
                  <Button size="sm" onClick={() => editExistingLineup(team.id)}>
                    <Pencil />
                    Editar alineación
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => changeTemplate(team.id)}>
                    <ClipboardList />
                    Cambiar plantilla
                  </Button>
                </>
              ) : side === 'ours' && team ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => changeTemplate(team.id)}>
                    <ClipboardList />
                    Usar plantilla guardada
                  </Button>
                  <Button size="sm" variant="accent" onClick={() => startBlankLineup(team.id)}>
                    <Plus />
                    Crear alineación
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {/* Opponent: choose how to enter the lineup */}
          {side === 'opponent' && !isDone && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <OptionCard
                icon={<Zap />}
                title="Captura rápida"
                description="Escribe los nombres y posiciones de los 9 bateadores. Ideal para un oponente nuevo."
                recommended={rosterSize === 0}
                onClick={() => setQuickEntry(true)}
              />
              <OptionCard
                icon={<Users />}
                title="Usar su roster"
                description={rosterSize > 0 ? `Elige de los ${rosterSize} jugadores registrados o de una plantilla guardada.` : 'El oponente aún no tiene jugadores registrados.'}
                recommended={rosterSize > 0}
                onClick={async () => {
                  const opponentTeamId = await ensureOpponentTeam()
                  if (!opponentTeamId) return
                  if (rosterSize > 0) {
                    changeTemplate(opponentTeamId)
                  } else {
                    await startBlankLineup(opponentTeamId)
                  }
                }}
              />
            </div>
          )}

          {/* Saved lineup preview */}
          {isDone && preview.length > 0 && (
            <div className="mt-5">
              <LineupPreviewList rows={preview} />
            </div>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ---------------- Game preparation stepper ---------------- */}
      {gameId && gameInfo && gameTeams.ourTeam && (gameTeams.opponentTeam || gameInfo.opponent) ? (
        <>
          {/* Step header */}
          <ol className="grid grid-cols-4 gap-2" aria-label="Pasos">
            {STEPS.map((s, i) => {
              const isActive = s.key === activeStep
              const isDone = stepDone(s.key)
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => goTo(s.key)}
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'flex w-full flex-col items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-accent'
                        : 'border-border bg-card hover:bg-slate-50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full text-xs font-bold',
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-slate-500'
                      )}
                    >
                      {isDone ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <span className={cn('text-xs font-medium leading-tight sm:text-sm', isActive ? 'text-accent-foreground' : 'text-slate-700')}>
                      <span className="sm:hidden">{s.short}</span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          {/* Step body */}
          <div className="min-h-[240px]">
            {activeStep === 'batting' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-semibold">¿Quién batea primero?</h4>
                  <p className="text-sm text-muted-foreground">El equipo visitante batea en la parte alta de cada entrada. Elige quién es local en este juego.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <OptionCard
                    icon={<Home />}
                    title={gameTeams.ourTeam.name}
                    description={gameInfo.batting_first === 'home' ? 'Nosotros somos locales: bateamos primero.' : 'Marcar a nuestro equipo como local (batea primero).'}
                    selected={gameInfo.batting_first === 'home'}
                    onClick={() => setBattingFirst('home')}
                  />
                  <OptionCard
                    icon={<Plane />}
                    title={gameInfo.opponent || gameTeams.opponentTeam?.name || 'Oponente'}
                    description={gameInfo.batting_first === 'opponent' ? 'El oponente es local: batea primero.' : 'Marcar al oponente como local (batea primero).'}
                    selected={gameInfo.batting_first === 'opponent'}
                    onClick={() => setBattingFirst('opponent')}
                  />
                </div>
                {!done.batting && (
                  <Alert variant="warning">Selecciona una opción para continuar.</Alert>
                )}
              </div>
            )}

            {activeStep === 'ours' && renderTeamStep('ours')}
            {activeStep === 'opponent' && renderTeamStep('opponent')}

            {activeStep === 'review' && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-base font-semibold">Resumen del juego</h4>
                  <p className="text-sm text-muted-foreground">Revisa que todo esté listo antes de abrir el libro de anotación.</p>
                </div>

                <ul className="grid gap-2 sm:grid-cols-3">
                  {[
                    { ok: done.batting, label: done.batting ? `Local: ${gameInfo.batting_first === 'home' ? gameTeams.ourTeam.name : gameInfo.opponent}` : 'Local/Visitante pendiente', step: 'batting' as PrepStep },
                    { ok: done.ours, label: done.ours ? `${gameTeams.ourTeam.name}: alineación lista` : `${gameTeams.ourTeam.name}: alineación pendiente`, step: 'ours' as PrepStep },
                    { ok: done.opponent, label: done.opponent ? `${gameInfo.opponent}: alineación lista` : `${gameInfo.opponent}: alineación pendiente`, step: 'opponent' as PrepStep },
                  ].map((item) => (
                    <li key={item.step}>
                      <button
                        type="button"
                        onClick={() => goTo(item.step)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50',
                          item.ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
                        )}
                      >
                        {item.ok ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                        )}
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h5 className="text-sm font-semibold">{gameTeams.ourTeam.name}</h5>
                      {gameInfo.batting_first === 'home' ? <Badge variant="solid">Local</Badge> : <Badge variant="dark">Visitante</Badge>}
                    </div>
                    {previews.ours.length > 0 ? (
                      <LineupPreviewList rows={previews.ours} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin alineación todavía.</p>
                    )}
                  </Card>
                  <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h5 className="text-sm font-semibold">{gameInfo.opponent}</h5>
                      {gameInfo.batting_first === 'opponent' ? <Badge variant="solid">Local</Badge> : <Badge variant="dark">Visitante</Badge>}
                    </div>
                    {previews.opponent.length > 0 ? (
                      <LineupPreviewList rows={previews.opponent} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin alineación todavía.</p>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>

          {/* Step footer */}
          {!currentTeam && !quickEntry && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <Button
                variant="ghost"
                onClick={() => goTo(STEPS[Math.max(0, stepIndex - 1)].key)}
                disabled={stepIndex === 0}
              >
                <ArrowLeft />
                Anterior
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onClose}>
                  Guardar y cerrar
                </Button>
                {activeStep === 'review' ? (
                  <Button
                    variant="success"
                    size="lg"
                    onClick={startScoring}
                    disabled={!allDone || !onStartScoring}
                    title={allDone ? undefined : 'Completa los tres pasos para iniciar'}
                  >
                    <Play />
                    Iniciar anotación
                  </Button>
                ) : (
                  <Button onClick={() => goTo(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].key)}>
                    Siguiente
                    <ArrowRight />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ---------------- Plain team selection (no game context) ---------------- */
        <>
          {!teamId && !currentTeam && (
            <div className="space-y-3">
              <h4 className="text-base font-semibold">Seleccionar equipo</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {teams.map((team) => (
                  <Card key={team.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{team.name}</div>
                        <div className="text-sm text-muted-foreground">{team.city} · {team.players?.length || 0} jugadores</div>
                      </div>
                      <Button size="sm" variant="accent" onClick={() => selectTeam(team.id)}>
                        Seleccionar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {currentTeam && (mode === 'create' ? workspace : (
            <div className="flex justify-end">
              <Button variant="accent" onClick={() => setMode('create')}>Editar alineación</Button>
            </div>
          ))}
        </>
      )}

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <Modal
          size="sm"
          title="Agregar nuevo jugador"
          onClose={() => {
            setShowAddPlayerModal(false)
            setNewPlayerData({
              first_name: '',
              last_name: '',
              jersey_number: '',
              positions: []
            })
          }}
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddPlayerModal(false)
                  setNewPlayerData({
                    first_name: '',
                    last_name: '',
                    jersey_number: '',
                    positions: []
                  })
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={createNewPlayer}
                loading={creatingPlayer}
                disabled={!newPlayerData.first_name || !newPlayerData.last_name}
              >
                {creatingPlayer ? 'Creando...' : 'Crear jugador'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <FormField label="Nombre">
              <Input
                type="text"
                value={newPlayerData.first_name}
                onChange={(e) => setNewPlayerData({ ...newPlayerData, first_name: e.target.value })}
                placeholder="Nombre"
              />
            </FormField>
            <FormField label="Apellido">
              <Input
                type="text"
                value={newPlayerData.last_name}
                onChange={(e) => setNewPlayerData({ ...newPlayerData, last_name: e.target.value })}
                placeholder="Apellido"
              />
            </FormField>
            <FormField label="Número de camiseta">
              <Input
                type="number"
                value={newPlayerData.jersey_number}
                onChange={(e) => setNewPlayerData({ ...newPlayerData, jersey_number: e.target.value })}
                placeholder="Número"
                min="0"
              />
            </FormField>
            <FormField label="Posición principal">
              <Select
                value={newPlayerData.positions[0] || ''}
                onChange={(e) => setNewPlayerData({
                  ...newPlayerData,
                  positions: e.target.value ? [e.target.value] : []
                })}
              >
                <option value="">Seleccionar posición...</option>
                {fieldPositions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Small presentational helpers
// -----------------------------------------------------------------------------
function OrderChip({ n, done, dh }: { n: number; done?: boolean; dh?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums',
        done ? 'bg-emerald-100 text-emerald-800' : dh ? 'bg-blue-100 text-blue-800' : 'bg-secondary text-slate-600'
      )}
    >
      {n}
    </span>
  )
}

function OptionCard({
  icon,
  title,
  description,
  selected,
  recommended,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  selected?: boolean
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border bg-card hover:border-primary/40 hover:bg-slate-50'
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5',
          selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-slate-600'
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{title}</span>
          {recommended && <Badge variant="info">Recomendado</Badge>}
          {selected && <Badge variant="solid"><Check /> Seleccionado</Badge>}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

function LineupPreviewList({ rows }: { rows: PreviewRow[] }) {
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {rows.map((row) => (
        <li key={`${row.batting_order}-${row.position}`} className="flex items-center gap-3 px-3 py-1.5 text-sm">
          <OrderChip n={row.batting_order} />
          <span className="min-w-0 flex-1 truncate">
            {row.players ? `${row.players.first_name} ${row.players.last_name}` : 'Jugador'}
            {row.players?.jersey_number ? <span className="ml-1 text-xs text-muted-foreground">#{row.players.jersey_number}</span> : null}
          </span>
          <Badge variant="primary">{row.position}</Badge>
        </li>
      ))}
    </ol>
  )
}
