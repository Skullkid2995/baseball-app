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
}

export default function LineupSelection({ teamId, gameId, onClose }: LineupSelectionProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [lineupEntries, setLineupEntries] = useState<LineupEntry[]>([])
  const [hasDH, setHasDH] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'select' | 'create'>('select') // New mode for template selection

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
    fetchTeams()
  }, [])

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
    const team = teams.find(t => t.id === teamId)
    if (team) {
      setSelectedTeam(teamId)
      
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

        alert('Plantilla seleccionada exitosamente')
        onClose()
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
      // Extract player IDs in batting order
      const playerIds = lineupEntries.slice(0, requiredEntries).map(entry => entry.playerId)
      
      // Try to update team lineup - if lineup field doesn't exist, save locally
      let lineupSaved = false
      try {
        const { error: teamError } = await supabase
          .from('teams')
          .update({ lineup: playerIds })
          .eq('id', selectedTeam)

        if (teamError) {
          console.log('Lineup field not found in database, saving locally...')
          console.log('Team error details:', teamError)
          // Save lineup data locally as fallback
          const lineupData = {
            teamId: selectedTeam,
            lineup: lineupEntries.slice(0, requiredEntries),
            timestamp: new Date().toISOString()
          }
          localStorage.setItem(`lineup_${selectedTeam}`, JSON.stringify(lineupData))
          lineupSaved = true
        } else {
          console.log('Lineup saved successfully to database')
          lineupSaved = true
        }
      } catch (lineupError) {
        console.log('Lineup field not available, saving locally...')
        console.log('Lineup error details:', lineupError)
        // Save lineup data locally as fallback
        const lineupData = {
          teamId: selectedTeam,
          lineup: lineupEntries.slice(0, requiredEntries),
          timestamp: new Date().toISOString()
        }
        localStorage.setItem(`lineup_${selectedTeam}`, JSON.stringify(lineupData))
        lineupSaved = true
      }

      // Update game to link to this team (only if gameId is provided)
      if (gameId) {
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
      }

      if (lineupSaved) {
        alert('Alineación guardada exitosamente')
    onClose()
      } else {
        alert('Error al guardar la alineación')
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
      {/* Team Selection - Show if no teamId provided */}
      {!teamId && (
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">Seleccionar Equipo:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => selectTeam(team.id)}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  selectedTeam === team.id
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{team.name}</div>
                <div className="text-sm text-gray-600">{team.city}</div>
                <div className="text-xs text-gray-500">
                  {team.players?.length || 0} jugadores
                </div>
              </button>
            ))}
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

          {/* Saved Template */}
          {getSavedLineupTemplates(selectedTeam!) ? (
            <div className="space-y-4">
              <h5 className="text-md font-medium text-gray-700">Plantilla Guardada:</h5>
              <div className="bg-white border-2 border-blue-200 rounded-lg p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {getSavedLineupTemplates(selectedTeam!)!.map((entry: { playerId: string, position: string }, index: number) => {
                    if (entry.playerId && entry.position) {
                      const player = currentTeam.players?.find(p => p.id === entry.playerId)
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
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => selectLineupTemplate(getSavedLineupTemplates(selectedTeam!)!)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md"
                  >
                    Usar Esta Plantilla
                  </button>
                  <button
                    onClick={() => setMode('create')}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                  >
                    Editar Plantilla
                  </button>
                </div>
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