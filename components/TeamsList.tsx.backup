'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LineupSelection from './LineupSelection'

interface Team {
  id: string
  name: string
  city: string
  manager: string
  coach: string
  founded_year: number
  stadium: string
  created_at: string
  lineup?: string[] // Array of player IDs representing batting order
  players?: Player[]
}

interface Player {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  team_id: string
  positions: string[]
  handedness: string
  contact_number: string
  emergency_number: string
  emergency_contact_name: string
  jersey_number: number
  height_inches: number
  weight_lbs: number
  is_active: boolean
}

export default function TeamsList() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState<string | null>(null)
  const [showAddPlayerForm, setShowAddPlayerForm] = useState<string | null>(null)
  const [showLineupForm, setShowLineupForm] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    manager: '',
    coach: '',
    founded_year: new Date().getFullYear(),
    stadium: ''
  })
  const [playerFormData, setPlayerFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    team_id: '',
    positions: [] as string[],
    handedness: 'Righty',
    contact_number: '',
    emergency_number: '',
    emergency_contact_name: '',
    jersey_number: 0,
    height_inches: 0,
    weight_lbs: 0
  })
  const [submitting, setSubmitting] = useState(false)
  const [submittingPlayer, setSubmittingPlayer] = useState(false)

  const BASEBALL_POSITIONS = [
    'Pitcher (P)', 'Catcher (C)', 'First Base (1B)', 'Second Base (2B)', 
    'Third Base (3B)', 'Shortstop (SS)', 'Left Field (LF)', 'Center Field (CF)', 
    'Right Field (RF)', 'Designated Hitter (DH)'
  ]

  useEffect(() => {
    fetchTeams()
  }, [])

  async function fetchTeams() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          players (
            id,
            first_name,
            last_name,
            date_of_birth,
            positions,
            handedness,
            contact_number,
            emergency_number,
            emergency_contact_name,
            jersey_number,
            height_inches,
            weight_lbs,
            is_active
          )
        `)
        .order('name')

      if (error) {
        setError(error.message)
      } else {
        setTeams(data || [])
      }
    } catch (err) {
      setError('Failed to fetch teams')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      if (showEditForm) {
        // Update existing team
        const { data, error } = await supabase
          .from('teams')
          .update(formData)
          .eq('id', showEditForm)
          .select()

        if (error) {
          setError(error.message)
        } else {
          setTeams(teams.map(team => team.id === showEditForm ? data[0] : team))
          resetForm()
        }
      } else {
        // Add new team
        const { data, error } = await supabase
          .from('teams')
          .insert([formData])
          .select()

        if (error) {
          setError(error.message)
        } else {
          setTeams([...teams, data[0]])
          resetForm()
        }
      }
    } catch (err) {
      setError(showEditForm ? 'Failed to update team' : 'Failed to add team')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      city: '',
      manager: '',
      coach: '',
      founded_year: new Date().getFullYear(),
      stadium: ''
    })
    setShowAddForm(false)
    setShowEditForm(null)
  }

  function editTeam(team: Team) {
    setFormData({
      name: team.name,
      city: team.city,
      manager: team.manager || '',
      coach: team.coach || '',
      founded_year: team.founded_year || new Date().getFullYear(),
      stadium: team.stadium || ''
    })
    setShowEditForm(team.id)
  }

  async function handlePlayerSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmittingPlayer(true)
    
    try {
      const { data, error } = await supabase
        .from('players')
        .insert([playerFormData])
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          team_id,
          positions,
          handedness,
          contact_number,
          emergency_number,
          emergency_contact_name,
          jersey_number,
          height_inches,
          weight_lbs,
          is_active
        `)

      if (error) {
        setError(error.message)
      } else {
        // Refresh teams to show the new player
        await fetchTeams()
        setPlayerFormData({
          first_name: '',
          last_name: '',
          date_of_birth: '',
          team_id: '',
          positions: [],
          handedness: 'Righty',
          contact_number: '',
          emergency_number: '',
          emergency_contact_name: '',
          jersey_number: 0,
          height_inches: 0,
          weight_lbs: 0
        })
        setShowAddPlayerForm(null)
      }
    } catch (err) {
      setError('Failed to add player')
    } finally {
      setSubmittingPlayer(false)
    }
  }

  function handlePositionChange(position: string, checked: boolean) {
    if (checked) {
      setPlayerFormData({...playerFormData, positions: [...playerFormData.positions, position]})
    } else {
      setPlayerFormData({...playerFormData, positions: playerFormData.positions.filter(p => p !== position)})
    }
  }

  function openAddPlayerForm(teamId: string) {
    setPlayerFormData({
      ...playerFormData,
      team_id: teamId
    })
    setShowAddPlayerForm(teamId)
  }

  function openLineupForm(teamId: string) {
    setShowLineupForm(teamId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading teams...</span>
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Teams ({teams.length})</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Team'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {(showAddForm || showEditForm) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">
            {showEditForm ? 'Edit Team' : 'Add New Team'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Yankees"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., New York"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
                <input
                  type="text"
                  value={formData.manager}
                  onChange={(e) => setFormData({...formData, manager: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Aaron Boone"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coach</label>
                <input
                  type="text"
                  value={formData.coach}
                  onChange={(e) => setFormData({...formData, coach: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Matt Blake"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Founded Year</label>
                <input
                  type="number"
                  value={formData.founded_year}
                  onChange={(e) => setFormData({...formData, founded_year: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stadium</label>
                <input
                  type="text"
                  value={formData.stadium}
                  onChange={(e) => setFormData({...formData, stadium: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Yankee Stadium"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? (showEditForm ? 'Updating...' : 'Adding...') : (showEditForm ? 'Update Team' : 'Add Team')}
              </button>
            </div>
          </form>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No teams found. Add your first team using the form above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{team.name}</h4>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {team.city}
                  </span>
                  <button
                    onClick={() => editTeam(team)}
                    className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
              {team.manager && (
                <p className="text-sm text-gray-600 mb-1">Manager: {team.manager}</p>
              )}
              {team.coach && (
                <p className="text-sm text-gray-600 mb-1">Coach: {team.coach}</p>
              )}
              <div className="text-xs text-gray-400 mt-2 mb-3">
                <p>Founded: {team.founded_year}</p>
                {team.stadium && <p>Stadium: {team.stadium}</p>}
              </div>

              {/* Players Section */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="text-sm font-medium text-gray-700">
                    Players ({team.players?.length || 0})
                  </h5>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => openLineupForm(team.id)}
                      className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
                    >
                      Elegir Alineación
                    </button>
                    <button
                      onClick={() => openAddPlayerForm(team.id)}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      Add Player
                    </button>
                  </div>
                </div>
                
                {team.players && team.players.length > 0 ? (
                  <div className="space-y-1">
                    {team.players.map((player) => (
                      <div key={player.id} className="text-xs bg-gray-50 p-2 rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            {player.first_name} {player.last_name}
                          </span>
                          {player.jersey_number && (
                            <span className="text-gray-500">#{player.jersey_number}</span>
                          )}
                        </div>
                        <div className="text-gray-500">
                          {player.positions?.join(', ')} • {player.handedness}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No players yet</p>
                )}
              </div>

              {/* Add Player Form for this team */}
              {showAddPlayerForm === team.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <h6 className="text-lg font-medium text-gray-700 mb-4">Add Player to {team.name}</h6>
                  <form onSubmit={handlePlayerSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                        <input
                          type="text"
                          required
                          value={playerFormData.first_name}
                          onChange={(e) => setPlayerFormData({...playerFormData, first_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., John"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={playerFormData.last_name}
                          onChange={(e) => setPlayerFormData({...playerFormData, last_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., Smith"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                        <input
                          type="date"
                          required
                          value={playerFormData.date_of_birth}
                          onChange={(e) => setPlayerFormData({...playerFormData, date_of_birth: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Handedness *</label>
                        <select
                          required
                          value={playerFormData.handedness}
                          onChange={(e) => setPlayerFormData({...playerFormData, handedness: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="Righty">Righty</option>
                          <option value="Lefty">Lefty</option>
                          <option value="Switch">Switch</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jersey Number</label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={playerFormData.jersey_number || ''}
                          onChange={(e) => setPlayerFormData({...playerFormData, jersey_number: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., 24"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (inches)</label>
                        <input
                          type="number"
                          min="48"
                          max="84"
                          value={playerFormData.height_inches || ''}
                          onChange={(e) => setPlayerFormData({...playerFormData, height_inches: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., 72"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                        <input
                          type="number"
                          min="100"
                          max="350"
                          value={playerFormData.weight_lbs || ''}
                          onChange={(e) => setPlayerFormData({...playerFormData, weight_lbs: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., 180"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                        <input
                          type="tel"
                          value={playerFormData.contact_number}
                          onChange={(e) => setPlayerFormData({...playerFormData, contact_number: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., (555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Number</label>
                        <input
                          type="tel"
                          value={playerFormData.emergency_number}
                          onChange={(e) => setPlayerFormData({...playerFormData, emergency_number: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., (555) 987-6543"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                        <input
                          type="text"
                          value={playerFormData.emergency_contact_name}
                          onChange={(e) => setPlayerFormData({...playerFormData, emergency_contact_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., Jane Smith"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Positions * (Select all that apply)</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {BASEBALL_POSITIONS.map((position) => (
                          <label key={position} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={playerFormData.positions.includes(position)}
                              onChange={(e) => handlePositionChange(position, e.target.checked)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">{position}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowAddPlayerForm(null)}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingPlayer || playerFormData.positions.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {submittingPlayer ? 'Adding...' : 'Add Player'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* Lineup Modal */}
      {showLineupForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Elegir Alineación</h3>
                <button
                  onClick={() => setShowLineupForm(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
              <LineupSelection 
                teamId={showLineupForm}
                onClose={() => setShowLineupForm(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
