'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/contexts/PermissionsContext'
import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Alert, Badge, Button, Card, FormField, Input, LoadingState, Panel, Select } from '@/components/ui'

interface Player {
  id: string
  first_name: string
  last_name: string
  jersey_number: number
  positions: string[]
}

interface LineupTemplate {
  id: string
  name: string
  description?: string
  created_at: string
}

interface LineupTemplatePlayer {
  id: string
  template_id: string
  player_id: string
  batting_order: number
  position: string
  players?: Player
}

interface LineupTemplatesProps {
  onClose: () => void
  teamId?: string
  /** Rendered inside a page (no surrounding modal): hides the Close button. */
  embedded?: boolean
}

const POSITIONS = [
  { value: 'P', label: 'Pitcher' },
  { value: 'C', label: 'Catcher' },
  { value: '1B', label: 'First Base' },
  { value: '2B', label: 'Second Base' },
  { value: '3B', label: 'Third Base' },
  { value: 'SS', label: 'Shortstop' },
  { value: 'LF', label: 'Left Field' },
  { value: 'CF', label: 'Center Field' },
  { value: 'RF', label: 'Right Field' },
  { value: 'DH', label: 'Designated Hitter' }
]

export default function LineupTemplates({ onClose, teamId, embedded = false }: LineupTemplatesProps) {
  const { canEdit } = usePermissions()
  const [templates, setTemplates] = useState<LineupTemplate[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [templatePlayers, setTemplatePlayers] = useState<LineupTemplatePlayer[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [lineup, setLineup] = useState<{[key: number]: {playerId: string, position: string}}>({})

  useEffect(() => {
    fetchTemplates()
    fetchPlayers()
  }, [])

  useEffect(() => {
    if (selectedTemplate) {
      fetchTemplatePlayers(selectedTemplate)
    }
  }, [selectedTemplate])

  useEffect(() => {
    if (editingTemplate) {
      const template = templates.find(t => t.id === editingTemplate)
      if (template) {
        setFormData({
          name: template.name,
          description: template.description || ''
        })
        fetchTemplatePlayers(editingTemplate)
      }
    } else {
      setFormData({ name: '', description: '' })
      setLineup({})
    }
  }, [editingTemplate, templates])

  useEffect(() => {
    if (editingTemplate && templatePlayers.length > 0) {
      // Populate lineup from template players
      const lineupData: {[key: number]: {playerId: string, position: string}} = {}
      templatePlayers.forEach(tp => {
        lineupData[tp.batting_order] = {
          playerId: tp.player_id,
          position: tp.position
        }
      })
      setLineup(lineupData)
    }
  }, [editingTemplate, templatePlayers])

  async function fetchTemplates() {
    try {
      let query = supabase
        .from('lineup_templates')
        .select('*')
      
      // Filter by team if teamId is provided
      if (teamId) {
        query = query.eq('team_id', teamId)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching templates:', error)
      } else {
        setTemplates(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    } finally {
      setLoading(false)
    }
  }

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

  async function fetchTemplatePlayers(templateId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('lineup_template_players')
        .select(`
          *,
          players (
            id,
            first_name,
            last_name,
            jersey_number
          )
        `)
        .eq('template_id', templateId)
        .order('batting_order')

      if (error) {
        console.error('Error fetching template players:', error)
        setTemplatePlayers([])
      } else {
        setTemplatePlayers(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch template players:', err)
      setTemplatePlayers([])
    }
  }

  async function createTemplate() {
    if (!formData.name.trim()) {
      alert('Please enter a template name')
      return
    }

    // Check if we have all 9 batting positions filled
    const filledPositions = Object.keys(lineup).length
    if (filledPositions !== 9) {
      alert('Please fill all 9 batting positions')
      return
    }

    try {
      if (editingTemplate) {
        // Update existing template
        const updateData: { name: string; description?: string; team_id?: string } = {
          name: formData.name,
          description: formData.description
        }
        
        // Only update team_id if it's not already set (to preserve existing team associations)
        if (teamId) {
          updateData.team_id = teamId
        }
        
        const { error: templateError } = await supabase
          .from('lineup_templates')
          .update(updateData)
          .eq('id', editingTemplate)

        if (templateError) {
          console.error('Error updating template:', templateError)
          alert('Failed to update template')
          return
        }

        // Delete existing lineup template players
        const { error: deleteError } = await supabase
          .from('lineup_template_players')
          .delete()
          .eq('template_id', editingTemplate)

        if (deleteError) {
          console.error('Error deleting template players:', deleteError)
          alert('Failed to update lineup positions')
          return
        }

        // Create the lineup template players
        const lineupPlayers = Object.entries(lineup).map(([order, data]) => ({
          template_id: editingTemplate,
          player_id: data.playerId,
          batting_order: parseInt(order),
          position: data.position
        }))

        const { error: playersError } = await supabase
          .from('lineup_template_players')
          .insert(lineupPlayers)

        if (playersError) {
          console.error('Error creating template players:', playersError)
          alert('Failed to update lineup positions')
          return
        }

        alert('Lineup template updated successfully!')
        setEditingTemplate(null)
      } else {
        // Create new template
        const insertData: { name: string; description?: string; team_id?: string } = {
          name: formData.name,
          description: formData.description
        }
        
        // Associate template with team if teamId is provided
        if (teamId) {
          insertData.team_id = teamId
        }
        
        const { data: templateData, error: templateError } = await supabase
          .from('lineup_templates')
          .insert([insertData])
          .select()

        if (templateError) {
          console.error('Error creating template:', templateError)
          alert('Failed to create template')
          return
        }

        const templateId = templateData[0].id

        // Create the lineup template players
        const lineupPlayers = Object.entries(lineup).map(([order, data]) => ({
          template_id: templateId,
          player_id: data.playerId,
          batting_order: parseInt(order),
          position: data.position
        }))

        const { error: playersError } = await supabase
          .from('lineup_template_players')
          .insert(lineupPlayers)

        if (playersError) {
          console.error('Error creating template players:', playersError)
          alert('Failed to create lineup positions')
          return
        }

        alert('Lineup template created successfully!')
      }

      setFormData({ name: '', description: '' })
      setLineup({})
      setShowCreateForm(false)
      fetchTemplates()
    } catch (err) {
      console.error('Failed to save template:', err)
      alert('Failed to save template')
    }
  }

  function startEditTemplate(templateId: string) {
    setEditingTemplate(templateId)
    setShowCreateForm(true)
    fetchTemplatePlayers(templateId)
  }

  function cancelEdit() {
    setEditingTemplate(null)
    setFormData({ name: '', description: '' })
    setLineup({})
    setShowCreateForm(false)
  }

  async function deleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this lineup template?')) {
      return
    }

    try {
      // First, check if this template is being used in any games
      const { data: gamesUsingTemplate, error: checkError } = await supabase
        .from('games')
        .select('id, opponent, game_date')
        .or(`lineup_template_id.eq.${templateId},opponent_lineup_template_id.eq.${templateId}`)

      if (checkError) {
        console.error('Error checking template usage:', checkError)
      }

      // If template is being used in games, remove the references first
      if (gamesUsingTemplate && gamesUsingTemplate.length > 0) {
        const shouldContinue = confirm(
          `This template is being used in ${gamesUsingTemplate.length} game(s). ` +
          `The template references will be removed from those games. Continue?`
        )
        
        if (!shouldContinue) {
          return
        }

        // Remove template references from games
        const { error: updateError } = await supabase
          .from('games')
          .update({
            lineup_template_id: null,
            opponent_lineup_template_id: null
          })
          .or(`lineup_template_id.eq.${templateId},opponent_lineup_template_id.eq.${templateId}`)

        if (updateError) {
          console.error('Error removing template references from games:', updateError)
          alert(`Failed to remove template references from games: ${updateError.message || 'Unknown error'}`)
          return
        }
      }

      // Delete the template players first (cascade delete should handle this, but being explicit)
      const { error: deletePlayersError } = await supabase
        .from('lineup_template_players')
        .delete()
        .eq('template_id', templateId)

      if (deletePlayersError) {
        console.error('Error deleting template players:', deletePlayersError)
        // Continue anyway, as cascade delete might handle it
      }

      // Now delete the template
      const { error } = await supabase
        .from('lineup_templates')
        .delete()
        .eq('id', templateId)

      if (error) {
        console.error('Error deleting template:', error)
        const errorMessage = error.message || JSON.stringify(error) || 'Unknown error'
        alert(`Failed to delete template: ${errorMessage}`)
      } else {
        alert('Template deleted successfully!')
        fetchTemplates()
        if (selectedTemplate === templateId) {
          setSelectedTemplate(null)
          setTemplatePlayers([])
        }
        if (editingTemplate === templateId) {
          setEditingTemplate(null)
          setFormData({ name: '', description: '' })
          setLineup({})
          setShowCreateForm(false)
        }
      }
    } catch (err) {
      console.error('Failed to delete template:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(`Failed to delete template: ${errorMessage}`)
    }
  }

  function handleLineupChange(battingOrder: number, playerId: string, position: string) {
    setLineup(prev => ({
      ...prev,
      [battingOrder]: { playerId, position }
    }))
  }

  function getPlayerName(playerId: string) {
    const player = players.find(p => p.id === playerId)
    return player ? `#${player.jersey_number} ${player.first_name} ${player.last_name}` : ''
  }

  if (loading) {
    return <LoadingState label="Loading lineup templates..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold tracking-tight">Lineup Templates</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showCreateForm ? 'outline' : 'primary'}
            onClick={() => {
              if (showCreateForm) {
                cancelEdit()
              } else {
                setShowCreateForm(true)
              }
            }}
          >
            {showCreateForm ? <X /> : <Plus />}
            {showCreateForm ? 'Cancel' : 'New Template'}
          </Button>
          {!embedded && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Create/Edit Template Form */}
      {showCreateForm && (
        <Panel>
          <h4 className="mb-5 text-base font-semibold">
            {editingTemplate ? 'Edit Lineup Template' : 'Create New Lineup Template'}
          </h4>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Template Name" required>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Regular Lineup, Playoff Lineup"
              />
            </FormField>
            <FormField label="Description">
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optional description"
              />
            </FormField>
          </div>

          {/* Lineup Builder */}
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-slate-700">Batting Order & Positions</h5>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((order) => (
              <div key={order} className="grid grid-cols-1 items-center gap-3 sm:grid-cols-3">
                <div className="text-sm font-medium text-slate-700">
                  #{order} - Batting Order {order}
                </div>
                <div>
                  <Select
                    value={lineup[order]?.playerId || ''}
                    onChange={(e) => handleLineupChange(order, e.target.value, lineup[order]?.position || '')}
                  >
                    <option value="">Select Player</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        #{player.jersey_number} {player.first_name} {player.last_name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Select
                    value={lineup[order]?.position || ''}
                    onChange={(e) => handleLineupChange(order, lineup[order]?.playerId || '', e.target.value)}
                  >
                    <option value="">Select Position</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos.value} value={pos.value}>
                        {pos.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="success" disabled={!canEdit('lineups')} onClick={createTemplate}>
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </Panel>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <Alert variant="warning">
            No lineup templates found. Create your first template above.
          </Alert>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h5 className="text-base font-semibold tracking-tight">{template.name}</h5>
                  {template.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Created: {new Date(template.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="primary" onClick={() => setSelectedTemplate(template.id)}>
                    <Eye />
                    View Lineup
                  </Button>
                  <Button size="sm" variant="outline" disabled={!canEdit('lineups')} onClick={() => startEditTemplate(template.id)}>
                    <Pencil />
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" disabled={!canEdit('lineups')} onClick={() => deleteTemplate(template.id)}>
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Show lineup if selected */}
              {selectedTemplate === template.id && templatePlayers.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <h6 className="mb-3 text-sm font-semibold text-slate-700">Lineup:</h6>
                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-sm">
                      <tbody>
                        {templatePlayers.map((tp) => (
                          <tr key={tp.id} className="border-t border-border first:border-t-0 hover:bg-slate-50/60">
                            <td className="w-12 px-3 py-2">
                              <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums text-secondary-foreground">#{tp.batting_order}</span>
                            </td>
                            <td className="px-3 py-2 font-medium">{getPlayerName(tp.player_id)}</td>
                            <td className="px-3 py-2 text-right">
                              <Badge variant="primary">{tp.position}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
