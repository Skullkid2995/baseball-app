'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function LineupTemplates({ onClose }: LineupTemplatesProps) {
  const [templates, setTemplates] = useState<LineupTemplate[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
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

  async function fetchTemplates() {
    try {
      const { data, error } = await supabase
        .from('lineup_templates')
        .select('*')
        .order('created_at', { ascending: false })

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

  async function fetchTemplatePlayers(templateId: string) {
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
      } else {
        setTemplatePlayers(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch template players:', err)
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
      // Create the template
      const { data: templateData, error: templateError } = await supabase
        .from('lineup_templates')
        .insert([{
          name: formData.name,
          description: formData.description
        }])
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
      setFormData({ name: '', description: '' })
      setLineup({})
      setShowCreateForm(false)
      fetchTemplates()
    } catch (err) {
      console.error('Failed to create template:', err)
      alert('Failed to create template')
    }
  }

  async function deleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this lineup template?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('lineup_templates')
        .delete()
        .eq('id', templateId)

      if (error) {
        console.error('Error deleting template:', error)
        alert('Failed to delete template')
      } else {
        alert('Template deleted successfully!')
        fetchTemplates()
        if (selectedTemplate === templateId) {
          setSelectedTemplate(null)
          setTemplatePlayers([])
        }
      }
    } catch (err) {
      console.error('Failed to delete template:', err)
      alert('Failed to delete template')
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
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading lineup templates...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">Lineup Templates</h3>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {showCreateForm ? 'Cancel' : 'New Template'}
          </button>
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>

      {/* Create Template Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Create New Lineup Template</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Regular Lineup, Playoff Lineup"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Lineup Builder */}
          <div className="space-y-4">
            <h5 className="text-md font-semibold text-gray-800">Batting Order & Positions</h5>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((order) => (
              <div key={order} className="grid grid-cols-3 gap-4 items-center">
                <div className="text-sm font-medium text-gray-700">
                  #{order} - Batting Order {order}
                </div>
                <div>
                  <select
                    value={lineup[order]?.playerId || ''}
                    onChange={(e) => handleLineupChange(order, e.target.value, lineup[order]?.position || '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Player</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        #{player.jersey_number} {player.first_name} {player.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={lineup[order]?.position || ''}
                    onChange={(e) => handleLineupChange(order, lineup[order]?.playerId || '', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Position</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos.value} value={pos.value}>
                        {pos.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={createTemplate}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              Create Template
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No lineup templates found. Create your first template above.</p>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h5 className="text-lg font-semibold text-gray-800">{template.name}</h5>
                  {template.description && (
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Created: {new Date(template.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedTemplate(template.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    View Lineup
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Show lineup if selected */}
              {selectedTemplate === template.id && templatePlayers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h6 className="text-md font-semibold text-gray-700 mb-3">Lineup:</h6>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    {templatePlayers.map((tp) => (
                      <div key={tp.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
                        <span className="font-medium">#{tp.batting_order}</span>
                        <span>{getPlayerName(tp.player_id)}</span>
                        <span className="text-blue-600 font-medium">{tp.position}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

