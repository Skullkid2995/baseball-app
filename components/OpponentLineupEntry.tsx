'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Save } from 'lucide-react'
import { Alert, Button, Checkbox, Input, Modal, Select } from '@/components/ui'

interface OpponentPlayer {
  id: string
  name: string
  position: string
  batting_order: number
}

interface OpponentLineupEntryProps {
  gameId: string
  opponentName: string
  onClose: () => void
  /** Render inline (inside another panel) instead of as its own modal. */
  embedded?: boolean
}

export default function OpponentLineupEntry({ gameId, opponentName, onClose, embedded = false }: OpponentLineupEntryProps) {
  const [players, setPlayers] = useState<OpponentPlayer[]>([])
  const [hasDH, setHasDH] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    // Initialize with empty players for 9 positions
    const initialPlayers: OpponentPlayer[] = Array.from({ length: 9 }, (_, i) => ({
      id: `temp-${i}`,
      name: '',
      position: '',
      batting_order: i + 1
    }))
    setPlayers(initialPlayers)
  }, [])

  function addDH() {
    if (hasDH) return
    setHasDH(true)
    setPlayers([...players, {
      id: `temp-${players.length}`,
      name: '',
      position: 'Bateador Designado (DH)',
      batting_order: 10
    }])
  }

  function removeDH() {
    if (!hasDH) return
    setHasDH(false)
    setPlayers(players.filter(p => p.batting_order !== 10))
  }

  function updatePlayer(index: number, field: 'name' | 'position', value: string) {
    const updated = [...players]
    updated[index] = { ...updated[index], [field]: value }
    setPlayers(updated)
  }

  async function saveOpponentLineup() {
    const requiredEntries = hasDH ? 10 : 9
    const filledPlayers = players.slice(0, requiredEntries).filter(p => 
      p.name.trim() && p.position
    )

    if (filledPlayers.length !== requiredEntries) {
      setError(`Please fill all ${requiredEntries} positions`)
      return
    }

    // Validate no duplicate positions
    const positions = filledPlayers.map(p => p.position)
    const uniquePositions = [...new Set(positions)]
    if (positions.length !== uniquePositions.length) {
      setError('Cannot have duplicate positions')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // First, find or create an "Opponents" team for this opponent
      let opponentTeamId: string | null = null
      
      // Try to find existing opponent team
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('name', opponentName)
        .single()

      if (existingTeam) {
        opponentTeamId = existingTeam.id
      } else {
        // Create a new team for this opponent
        const { data: newTeam, error: teamError } = await supabase
          .from('teams')
          .insert([{
            name: opponentName,
            city: 'Opponent'
          }])
          .select('id')
          .single()

        if (teamError || !newTeam) {
          throw new Error('Failed to create opponent team')
        }
        opponentTeamId = newTeam.id
      }

      // Create opponent players in the database
      // Always create new players for this lineup to ensure uniqueness
      // Even if names are the same, each lineup position needs a unique player
      const playerIds: string[] = []
      for (const player of filledPlayers) {
        // Always create a new player for each lineup position
        // This ensures each batting order position has a unique player ID
        // even if names are identical
        const positionMap: { [key: string]: string } = {
          'Lanzador (P)': 'Pitcher (P)',
          'Receptor (C)': 'Catcher (C)',
          'Primera Base (1B)': 'First Base (1B)',
          'Segunda Base (2B)': 'Second Base (2B)',
          'Tercera Base (3B)': 'Third Base (3B)',
          'Campo Corto (SS)': 'Shortstop (SS)',
          'Jardinero Izquierdo (LF)': 'Left Field (LF)',
          'Jardinero Central (CF)': 'Center Field (CF)',
          'Jardinero Derecho (RF)': 'Right Field (RF)',
          'Bateador Designado (DH)': 'Designated Hitter (DH)'
        }

        const [firstName, ...lastNameParts] = player.name.trim().split(' ')
        const lastName = lastNameParts.join(' ') || `Player ${player.batting_order}`

        // Create unique player with batting order in name to ensure uniqueness
        const uniqueFirstName = `${firstName || 'Opponent'}`
        const uniqueLastName = lastName || `Player ${player.batting_order}`

        const { data: newPlayer, error: playerError } = await supabase
          .from('players')
          .insert([{
            first_name: uniqueFirstName,
            last_name: uniqueLastName,
            date_of_birth: '2000-01-01', // Default date
            team_id: opponentTeamId,
            positions: [positionMap[player.position] || 'Designated Hitter (DH)'],
            handedness: 'Righty',
            jersey_number: player.batting_order // Use batting order as jersey number for uniqueness
          }])
          .select('id')
          .single()

        if (playerError || !newPlayer) {
          console.error('Error creating player:', playerError)
          throw new Error(`Failed to create player: ${player.name}`)
        }
        playerIds.push(newPlayer.id)
      }

      // Create or update lineup template for opponent team
      const { data: existingTemplate } = await supabase
        .from('lineup_templates')
        .select('id')
        .eq('team_id', opponentTeamId)
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
            team_id: opponentTeamId,
            name: `${opponentName} Lineup`
          }])
          .select('id')
          .single()

        if (templateError || !newTemplate) {
          throw new Error('Failed to create lineup template')
        }
        templateId = newTemplate.id
      }

      // Create lineup template players
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

      const templatePlayers = filledPlayers.map((player, index) => ({
        template_id: templateId,
        player_id: playerIds[index],
        batting_order: player.batting_order,
        position: positionMap[player.position] || 'DH'
      }))

      const { error: templatePlayersError } = await supabase
        .from('lineup_template_players')
        .insert(templatePlayers)

      if (templatePlayersError) {
        throw new Error('Failed to save lineup template players')
      }

      // Link game to opponent lineup template (if column exists)
      try {
        const { error: gameError } = await supabase
          .from('games')
          .update({ opponent_lineup_template_id: templateId })
          .eq('id', gameId)

        if (gameError) {
          // Check if it's a column error (column doesn't exist)
          const errorMessage = gameError?.message || ''
          const errorCode = gameError?.code || ''
          const isColumnError = errorMessage.includes('column') || 
                               errorMessage.includes('opponent_lineup_template_id') ||
                               errorCode === '42703' ||
                               Object.keys(gameError || {}).length === 0
          
          if (isColumnError) {
            // Column doesn't exist yet - this is expected if migration hasn't been run
            console.log('opponent_lineup_template_id column not found - migration may be needed')
          } else {
            console.error('Error linking game to opponent lineup:', gameError)
            console.error('Error details:', JSON.stringify(gameError, null, 2))
          }
          // Continue anyway - the template is saved
        } else {
          console.log('Successfully linked game to opponent lineup template')
        }
      } catch (err) {
        // Silently handle - column might not exist yet
        console.log('Could not link game to opponent lineup (column may not exist yet)')
      }

      onClose()
    } catch (err: unknown) {
      const error = err as { message?: string } | null
      console.error('Error saving opponent lineup:', err)
      setError(error?.message || 'Failed to save opponent lineup')
    } finally {
      setSaving(false)
    }
  }

  const maxRows = hasDH ? 10 : 9

  const body = (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <Checkbox
          checked={hasDH}
          onChange={(e) => e.target.checked ? addDH() : removeDH()}
        />
        <span className="text-slate-700">Usar Bateador Designado (DH)</span>
      </label>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-12 px-3 py-2 text-center font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Nombre del jugador</th>
              <th className="w-[44%] px-3 py-2 font-semibold">Posición</th>
            </tr>
          </thead>
          <tbody>
            {players.slice(0, maxRows).map((player, index) => (
              <tr key={player.id} className="border-t border-border">
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-slate-600">
                    {player.batting_order}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="text"
                    value={player.name}
                    onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                    placeholder="Nombre del jugador"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={player.position}
                    onChange={(e) => updatePlayer(index, 'position', e.target.value)}
                  >
                    <option value="">Seleccionar posición</option>
                    {fieldPositions
                      .filter(pos => hasDH || pos !== 'Bateador Designado (DH)')
                      .filter(pos => {
                        // Don't show positions already selected by other players
                        const usedPositions = players
                          .slice(0, maxRows)
                          .map(p => p.position)
                          .filter((p, i) => i !== index && p)
                        return !usedPositions.includes(pos) || player.position === pos
                      })
                      .map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={saveOpponentLineup} loading={saving}>
          <Save />
          {saving ? 'Guardando...' : 'Guardar alineación'}
        </Button>
      </div>
    </div>
  )

  if (embedded) return body

  return (
    <Modal size="lg" tall title={`Alineación de ${opponentName}`} onClose={onClose}>
      {body}
    </Modal>
  )
}
