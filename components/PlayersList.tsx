'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
  batting_hand: string
  throwing_hand: string
  debut_date?: string
  photo_url?: string
  is_active?: boolean
  teams?: Array<{ id: string, name: string, city: string }>
}

interface Team {
  id: string
  name: string
  city: string
}

const BASEBALL_POSITIONS = [
  'Pitcher (P)', 'Catcher (C)', 'First Base (1B)', 'Second Base (2B)', 
  'Third Base (3B)', 'Shortstop (SS)', 'Left Field (LF)', 'Center Field (CF)', 
  'Right Field (RF)', 'Designated Hitter (DH)'
]

export default function PlayersList() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [formData, setFormData] = useState({
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
    weight_lbs: 0,
    photo_url: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    fetchPlayers()
    fetchTeams()
  }, [])

  async function fetchPlayers() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('players')
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
          photo_url,
          is_active,
          teams (
            name,
            city
          )
        `)
        .order('last_name')

      if (error) {
        setError(error.message)
      } else {
        setPlayers((data || []) as Player[])
      }
    } catch (err) {
      setError('Failed to fetch players')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      if (editingPlayer) {
        // Update existing player
        const { data, error } = await supabase
          .from('players')
          .update(formData)
          .eq('id', editingPlayer.id)
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
            photo_url,
            is_active,
            teams (
              name,
              city
            )
          `)

        if (error) {
          setError(error.message)
        } else {
          setPlayers(players.map(p => p.id === editingPlayer.id ? data[0] as Player : p))
          resetForm()
        }
      } else {
        // Add new player
        const { data, error } = await supabase
          .from('players')
          .insert([formData])
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
            is_active,
            teams (
              name,
              city
            )
          `)

        if (error) {
          setError(error.message)
        } else {
          setPlayers([...players, data[0] as Player])
          resetForm()
        }
      }
    } catch (err) {
      setError(editingPlayer ? 'Failed to update player' : 'Failed to add player')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setFormData({
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
      weight_lbs: 0,
      photo_url: ''
    })
    setPhotoPreview(null)
    setShowAddForm(false)
    setEditingPlayer(null)
  }

  function editPlayer(player: Player) {
    setEditingPlayer(player)
    setFormData({
      first_name: player.first_name,
      last_name: player.last_name,
      date_of_birth: player.date_of_birth,
      team_id: player.team_id,
      positions: player.positions || [],
      handedness: player.handedness,
      contact_number: player.contact_number || '',
      emergency_number: player.emergency_number || '',
      emergency_contact_name: player.emergency_contact_name || '',
      jersey_number: player.jersey_number || 0,
      height_inches: player.height_inches || 0,
      weight_lbs: player.weight_lbs || 0,
      photo_url: (player as any).photo_url || ''
    })
    setPhotoPreview((player as any).photo_url || null)
    setShowAddForm(true)
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }

    setUploadingPhoto(true)
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `player-photos/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('player-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        setError('Failed to upload photo. Please make sure the "player-photos" storage bucket exists in Supabase.')
        setUploadingPhoto(false)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('player-photos')
        .getPublicUrl(filePath)

      if (urlData?.publicUrl) {
        setFormData({ ...formData, photo_url: urlData.publicUrl })
        setPhotoPreview(urlData.publicUrl)
      }
    } catch (err) {
      console.error('Error uploading photo:', err)
      setError('Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  function handlePositionChange(position: string, checked: boolean) {
    if (checked) {
      setFormData({...formData, positions: [...formData.positions, position]})
    } else {
      setFormData({...formData, positions: formData.positions.filter(p => p !== position)})
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading players...</span>
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
        <h3 className="text-lg font-semibold text-gray-800">Players ({players.length})</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Player'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">
            {editingPlayer ? 'Edit Player' : 'Add New Player'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo Upload Section */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Player Photo</label>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                    style={{ display: 'block' }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {uploadingPhoto ? 'Uploading...' : 'Take a photo or upload from gallery (max 5MB)'}
                  </p>
                </div>
                {photoPreview && (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Player preview"
                      className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null)
                        setFormData({ ...formData, photo_url: '' })
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team *</label>
                <select
                  required
                  value={formData.team_id}
                  onChange={(e) => setFormData({...formData, team_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select a team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.city} {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Handedness *</label>
                <select
                  required
                  value={formData.handedness}
                  onChange={(e) => setFormData({...formData, handedness: e.target.value})}
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
                  value={formData.jersey_number || ''}
                  onChange={(e) => setFormData({...formData, jersey_number: parseInt(e.target.value) || 0})}
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
                  value={formData.height_inches || ''}
                  onChange={(e) => setFormData({...formData, height_inches: parseInt(e.target.value) || 0})}
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
                  value={formData.weight_lbs || ''}
                  onChange={(e) => setFormData({...formData, weight_lbs: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., 180"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                <input
                  type="tel"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., (555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Number</label>
                <input
                  type="tel"
                  value={formData.emergency_number}
                  onChange={(e) => setFormData({...formData, emergency_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., (555) 987-6543"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})}
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
                      checked={formData.positions.includes(position)}
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
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || formData.positions.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? (editingPlayer ? 'Updating...' : 'Adding...') : (editingPlayer ? 'Update Player' : 'Add Player')}
              </button>
            </div>
          </form>
        </div>
      )}

      {players.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No players found. Add your first player using the form above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((player) => (
            <div key={player.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">
                  {player.first_name} {player.last_name}
                </h4>
                <div className="flex items-center space-x-2">
                  {player.jersey_number && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      #{player.jersey_number}
                    </span>
                  )}
                  <button
                    onClick={() => editPlayer(player)}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                {player.positions?.join(', ') || 'No positions'}
              </p>
              {player.teams && player.teams.length > 0 && (
                <p className="text-sm text-gray-500 mb-2">
                  {player.teams[0].city} {player.teams[0].name}
                </p>
              )}
              <div className="text-xs text-gray-400 space-y-1">
                <p>Handedness: {player.handedness}</p>
                {player.height_inches > 0 && (
                  <p>Height: {Math.floor(player.height_inches / 12)}&apos;{player.height_inches % 12}&quot;</p>
                )}
                {player.weight_lbs > 0 && (
                  <p>Weight: {player.weight_lbs} lbs</p>
                )}
                {player.contact_number && (
                  <p>Contact: {player.contact_number}</p>
                )}
                {player.emergency_contact_name && (
                  <p>Emergency: {player.emergency_contact_name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
