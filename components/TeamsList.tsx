'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { getBaseballPositions } from '@/lib/translations'
import LineupTemplates from './LineupTemplates'
import { ChevronDown, ChevronUp, ClipboardList, MapPin, Pencil, Plus, UserPlus, Users, X } from 'lucide-react'
import { Alert, Avatar, Badge, Button, Card, CheckChip, Checkbox, EmptyState, FormField, Input, LoadingState, Modal, PageHeader, Panel, Select } from '@/components/ui'

interface Team {
  id: string
  name: string
  city: string
  manager: string
  coach: string
  founded_year: number
  stadium: string
  logo_url?: string
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
  photo_url?: string
  is_active: boolean
}

export default function TeamsList() {
  const [teams, setTeams] = useState<Team[]>([])
  const [playersWithoutTeams, setPlayersWithoutTeams] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState<string | null>(null)
  const [showAddPlayerForm, setShowAddPlayerForm] = useState<string | null>(null)
  const [showPlayerSelectionModal, setShowPlayerSelectionModal] = useState<string | null>(null)
  const [selectedTeamForPlayer, setSelectedTeamForPlayer] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    manager: '',
    coach: '',
    founded_year: new Date().getFullYear(),
    stadium: '',
    logo_url: ''
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
    weight_lbs: 0,
    photo_url: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submittingPlayer, setSubmittingPlayer] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [showTemplateManagement, setShowTemplateManagement] = useState(false)
  const [selectedTeamForTemplates, setSelectedTeamForTemplates] = useState<string | null>(null)
  const { t, language } = useLanguage()
  const { canEdit } = usePermissions()

  // Get baseball positions based on current language
  const BASEBALL_POSITIONS = getBaseballPositions(language)

  useEffect(() => {
    fetchTeams()
    fetchPlayersWithoutTeams()
  }, [])

  async function fetchPlayersWithoutTeams() {
    try {
      // Fetch all players and filter client-side to catch both null and empty string
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
          is_active
        `)
        .order('last_name')

      if (error) {
        console.error('Error fetching players without teams:', error)
        setPlayersWithoutTeams([])
      } else {
        // Filter for players with null or empty team_id
        const playersWithoutTeams = (data || []).filter(p => !p.team_id || p.team_id === null || p.team_id === '')
        console.log('Players without teams found:', playersWithoutTeams.length, playersWithoutTeams)
        setPlayersWithoutTeams(playersWithoutTeams)
      }
    } catch (err) {
      console.error('Failed to fetch players without teams:', err)
      setPlayersWithoutTeams([])
    }
  }

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
            is_active
          )
        `)
        .order('name')

      if (error) {
        setError(error.message)
      } else {
        // Sort teams by name, and players within each team by name
        const sortedTeams = (data || []).map(team => ({
          ...team,
          players: (team.players || []).sort((a: Player, b: Player) => {
            const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
            const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
            return nameA.localeCompare(nameB)
          })
        })).sort((a: Team, b: Team) => a.name.localeCompare(b.name))
        setTeams(sortedTeams)
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
      stadium: '',
      logo_url: ''
    })
    setLogoPreview(null)
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
      stadium: team.stadium || '',
      logo_url: team.logo_url || ''
    })
    setLogoPreview(team.logo_url || null)
    setShowEditForm(team.id)
  }

  async function handlePlayerSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmittingPlayer(true)
    
    try {
      // Convert empty team_id to null
      const submitData = {
        ...playerFormData,
        team_id: playerFormData.team_id || null
      }
      
      if (editingPlayer) {
        // Update existing player (this happens when selecting existing player from modal)
        const { data, error } = await supabase
          .from('players')
          .update(submitData)
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
          // Refresh teams and players without teams
          await fetchTeams()
          await fetchPlayersWithoutTeams()
          resetPlayerForm()
        }
      } else {
        // Add new player - check for duplicates first
        const { data: existingPlayers, error: checkError } = await supabase
          .from('players')
          .select(`
            id,
            first_name,
            last_name,
            date_of_birth,
            team_id,
            teams (
              name,
              city
            )
          `)
          .eq('first_name', submitData.first_name.trim())
          .eq('last_name', submitData.last_name.trim())
          .eq('date_of_birth', submitData.date_of_birth)

        if (checkError) {
          setError('Error checking for duplicates: ' + checkError.message)
          setSubmittingPlayer(false)
          return
        }

        if (existingPlayers && existingPlayers.length > 0) {
          const existingPlayer = existingPlayers[0]
          const existingTeam = existingPlayer.teams && existingPlayer.teams[0]
          const teamName = existingTeam ? `${existingTeam.city} ${existingTeam.name}` : t.noTeam
          setError(t.playerExistsOnTeamMessage.replace('{teamName}', teamName))
          setSubmittingPlayer(false)
          return
        }

        // No duplicate found, create new player
        const { data, error } = await supabase
          .from('players')
          .insert([submitData])
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
            is_active
          `)

        if (error) {
          setError(error.message)
        } else {
          // Refresh teams and players without teams
          await fetchTeams()
          await fetchPlayersWithoutTeams()
          resetPlayerForm()
        }
      }
    } catch (err) {
      setError(editingPlayer ? 'Failed to update player' : 'Failed to add player')
    } finally {
      setSubmittingPlayer(false)
    }
  }

  async function handleRemovePlayerFromTeam() {
    if (!editingPlayer) return
    
    const playerIdToRemove = editingPlayer.id
    setSubmittingPlayer(true)
    setError(null)
    
    // Close the modal immediately
    setEditingPlayer(null)
    setShowAddPlayerForm(null)
    
    try {
      const { error } = await supabase
        .from('players')
        .update({ team_id: null })
        .eq('id', playerIdToRemove)

      if (error) {
        setError(error.message)
        setSubmittingPlayer(false)
      } else {
        // Refresh teams and players without teams
        await fetchTeams()
        await fetchPlayersWithoutTeams()
        // Reset form data
        resetPlayerForm()
        // Scroll to top to show teams view
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setSubmittingPlayer(false)
      }
    } catch (err) {
      setError('Failed to remove player from team')
      setSubmittingPlayer(false)
    }
  }

  function resetPlayerForm() {
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
      weight_lbs: 0,
      photo_url: ''
    })
    setPhotoPreview(null)
    setShowAddPlayerForm(null)
    setShowPlayerSelectionModal(null)
    setSelectedTeamForPlayer(null)
    setEditingPlayer(null)
  }

  function editPlayer(player: Player, teamId: string) {
    setEditingPlayer(player)
    setPlayerFormData({
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
      photo_url: player.photo_url || ''
    })
    setPhotoPreview(player.photo_url || null)
  }

  function handlePositionChange(position: string, checked: boolean) {
    if (checked) {
      setPlayerFormData({...playerFormData, positions: [...playerFormData.positions, position]})
    } else {
      setPlayerFormData({...playerFormData, positions: playerFormData.positions.filter(p => p !== position)})
    }
  }

  function openAddPlayerForm(teamId: string) {
    setSelectedTeamForPlayer(teamId)
    setShowPlayerSelectionModal(teamId)
  }

  function selectExistingPlayerForTeam(player: Player, teamId: string) {
    // Set as editing player so it updates instead of creating duplicate
    setEditingPlayer(player)
    setPlayerFormData({
      first_name: player.first_name,
      last_name: player.last_name,
      date_of_birth: player.date_of_birth,
      team_id: teamId,
      positions: player.positions || [],
      handedness: player.handedness,
      contact_number: player.contact_number || '',
      emergency_number: player.emergency_number || '',
      emergency_contact_name: player.emergency_contact_name || '',
      jersey_number: player.jersey_number || 0,
      height_inches: player.height_inches || 0,
      weight_lbs: player.weight_lbs || 0,
      photo_url: player.photo_url || ''
    })
    setPhotoPreview(player.photo_url || null)
    setShowPlayerSelectionModal(null)
    setShowAddPlayerForm(teamId)
  }

  function openNewPlayerForm(teamId: string) {
    resetPlayerForm()
    setPlayerFormData({
      ...playerFormData,
      team_id: teamId
    })
    setShowPlayerSelectionModal(null)
    setShowAddPlayerForm(teamId)
  }

  function toggleTeamPlayers(teamId: string) {
    setExpandedTeams(prev => {
      const newSet = new Set(prev)
      if (newSet.has(teamId)) {
        newSet.delete(teamId)
      } else {
        newSet.add(teamId)
      }
      return newSet
    })
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
      const { error: uploadError, data } = await supabase.storage
        .from('player-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        // If bucket doesn't exist, create it first (this will fail but we'll handle it)
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
        setPlayerFormData({ ...playerFormData, photo_url: urlData.publicUrl })
        setPhotoPreview(urlData.publicUrl)
      }
    } catch (err) {
      console.error('Error uploading photo:', err)
      setError('Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
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

    setUploadingLogo(true)
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `team-logos/${fileName}`

      // Upload to Supabase Storage (using same bucket as player photos)
      const { error: uploadError } = await supabase.storage
        .from('player-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        setError('Failed to upload logo. Please make sure the "player-photos" storage bucket exists in Supabase.')
        setUploadingLogo(false)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('player-photos')
        .getPublicUrl(filePath)

      if (urlData?.publicUrl) {
        setFormData({ ...formData, logo_url: urlData.publicUrl })
        setLogoPreview(urlData.publicUrl)
      }
    } catch (err) {
      console.error('Error uploading logo:', err)
      setError('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  // Shared player form fields (used by both the Add and Edit player modals; identical inputs and handlers)
  const playerFormFields = (
    <>
      {/* Photo Upload Section */}
      <FormField label={t.playerPhoto} hint={uploadingPhoto ? t.uploading : t.takePhotoOrUpload}>
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            disabled={uploadingPhoto}
            className="flex-1"
            style={{ display: 'block' }}
          />
          {photoPreview && (
            <div className="relative shrink-0">
              <img
                src={photoPreview}
                alt="Player preview"
                className="size-20 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoPreview(null)
                  setPlayerFormData({ ...playerFormData, photo_url: '' })
                }}
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow hover:bg-red-700"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </FormField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label={t.firstName} required>
          <Input
            type="text"
            required
            value={playerFormData.first_name}
            onChange={(e) => setPlayerFormData({...playerFormData, first_name: e.target.value})}
            placeholder="e.g., John"
          />
        </FormField>
        <FormField label={t.lastName} required>
          <Input
            type="text"
            required
            value={playerFormData.last_name}
            onChange={(e) => setPlayerFormData({...playerFormData, last_name: e.target.value})}
            placeholder="e.g., Smith"
          />
        </FormField>
        <FormField label={t.dateOfBirth} required>
          <Input
            type="date"
            required
            value={playerFormData.date_of_birth}
            onChange={(e) => setPlayerFormData({...playerFormData, date_of_birth: e.target.value})}
          />
        </FormField>
        <FormField label={t.team}>
          <Select
            value={playerFormData.team_id}
            onChange={(e) => setPlayerFormData({...playerFormData, team_id: e.target.value})}
          >
            <option value="">{t.noTeamRemove}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.city} {team.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t.handedness} required>
          <Select
            required
            value={playerFormData.handedness}
            onChange={(e) => setPlayerFormData({...playerFormData, handedness: e.target.value})}
          >
            <option value="Righty">{t.righty}</option>
            <option value="Lefty">{t.lefty}</option>
            <option value="Switch">{t.switch}</option>
          </Select>
        </FormField>
        <FormField label={t.jerseyNumber}>
          <Input
            type="number"
            min="0"
            max="99"
            value={playerFormData.jersey_number || ''}
            onChange={(e) => setPlayerFormData({...playerFormData, jersey_number: parseInt(e.target.value) || 0})}
            placeholder="e.g., 24"
          />
        </FormField>
        <FormField label={t.height}>
          <Input
            type="number"
            min="48"
            max="84"
            value={playerFormData.height_inches || ''}
            onChange={(e) => setPlayerFormData({...playerFormData, height_inches: parseInt(e.target.value) || 0})}
            placeholder="e.g., 72"
          />
        </FormField>
        <FormField label={t.weight}>
          <Input
            type="number"
            min="100"
            max="350"
            value={playerFormData.weight_lbs || ''}
            onChange={(e) => setPlayerFormData({...playerFormData, weight_lbs: parseInt(e.target.value) || 0})}
            placeholder="e.g., 180"
          />
        </FormField>
        <FormField label={t.contactNumber}>
          <Input
            type="tel"
            value={playerFormData.contact_number}
            onChange={(e) => setPlayerFormData({...playerFormData, contact_number: e.target.value})}
            placeholder="e.g., (555) 123-4567"
          />
        </FormField>
        <FormField label={t.emergencyNumber}>
          <Input
            type="tel"
            value={playerFormData.emergency_number}
            onChange={(e) => setPlayerFormData({...playerFormData, emergency_number: e.target.value})}
            placeholder="e.g., (555) 987-6543"
          />
        </FormField>
        <FormField label={t.emergencyContactName}>
          <Input
            type="text"
            value={playerFormData.emergency_contact_name}
            onChange={(e) => setPlayerFormData({...playerFormData, emergency_contact_name: e.target.value})}
            placeholder="e.g., Jane Smith"
          />
        </FormField>
      </div>

      <FormField
        label={
          <>
            {t.positions} <span className="text-red-500">*</span>{' '}
            <span className="font-normal text-muted-foreground">{t.selectAllThatApply}</span>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {BASEBALL_POSITIONS.map((position) => (
            <CheckChip key={position} checked={playerFormData.positions.includes(position)}>
              <Checkbox
                checked={playerFormData.positions.includes(position)}
                onChange={(e) => handlePositionChange(position, e.target.checked)}
              />
              <span>{position}</span>
            </CheckChip>
          ))}
        </div>
      </FormField>
    </>
  )

  if (loading) {
    return <LoadingState label={`${t.loading} ${t.teamsCount.toLowerCase()}...`} />
  }

  if (error) {
    return (
      <Alert variant="error">
        {t.error}: {error}
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.teamsCount}
        count={teams.length}
        actions={
          canEdit('teams') && <Button variant={showAddForm ? 'outline' : 'primary'} onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? <X /> : <Plus />}
            {showAddForm ? t.cancel : t.addTeam}
          </Button>
        }
      />

      {error && (
        <Alert variant="error">
          {t.error}: {error}
        </Alert>
      )}

      {(showAddForm || showEditForm) && (
        <Panel>
          <h4 className="mb-5 text-base font-semibold">
            {showEditForm ? t.editTeam : t.addNewTeam}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Team Logo Upload Section */}
            <FormField label={t.teamLogo} hint={uploadingLogo ? t.uploading : t.uploadTeamLogo}>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="flex-1"
                  style={{ display: 'block' }}
                />
                {logoPreview && (
                  <div className="relative shrink-0">
                    <img
                      src={logoPreview}
                      alt="Team logo preview"
                      className="size-20 rounded-lg border border-border bg-card object-contain p-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoPreview(null)
                        setFormData({ ...formData, logo_url: '' })
                      }}
                      className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow hover:bg-red-700"
                      aria-label="Remove logo"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </FormField>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label={t.teamName} required>
                <Input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Yankees"
                />
              </FormField>
              <FormField label={t.city} required>
                <Input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  placeholder="e.g., New York"
                />
              </FormField>
              <FormField label={t.manager}>
                <Input
                  type="text"
                  value={formData.manager}
                  onChange={(e) => setFormData({...formData, manager: e.target.value})}
                  placeholder="e.g., Aaron Boone"
                />
              </FormField>
              <FormField label={t.coach}>
                <Input
                  type="text"
                  value={formData.coach}
                  onChange={(e) => setFormData({...formData, coach: e.target.value})}
                  placeholder="e.g., Matt Blake"
                />
              </FormField>
              <FormField label={t.foundedYear}>
                <Input
                  type="number"
                  value={formData.founded_year}
                  onChange={(e) => setFormData({...formData, founded_year: parseInt(e.target.value)})}
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </FormField>
              <FormField label={t.stadium}>
                <Input
                  type="text"
                  value={formData.stadium}
                  onChange={(e) => setFormData({...formData, stadium: e.target.value})}
                  placeholder="e.g., Yankee Stadium"
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                {t.cancel}
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? (showEditForm ? t.updating : t.adding) : (showEditForm ? t.updateTeam : t.addTeam)}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {teams.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={`${t.noItemsFound} ${t.teamsCount.toLowerCase()}`}
          description={t.addFirstItem}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id} className="flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold tracking-tight">{team.name}</h4>
                    <Badge variant="primary">
                      <MapPin />
                      {team.city}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {team.manager && (
                      <>
                        <dt className="text-muted-foreground">{t.manager}</dt>
                        <dd className="font-medium text-slate-800">{team.manager}</dd>
                      </>
                    )}
                    {team.coach && (
                      <>
                        <dt className="text-muted-foreground">{t.coach}</dt>
                        <dd className="font-medium text-slate-800">{team.coach}</dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">{t.founded}</dt>
                    <dd className="text-slate-700">{team.founded_year}</dd>
                    {team.stadium && (
                      <>
                        <dt className="text-muted-foreground">{t.stadium}</dt>
                        <dd className="text-slate-700">{team.stadium}</dd>
                      </>
                    )}
                  </dl>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={`${team.name} logo`}
                      className="size-24 rounded-xl border border-border bg-card object-contain p-1.5 shadow-sm sm:size-28"
                      onError={(e) => {
                        // Hide image if it fails to load
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="flex size-24 items-center justify-center rounded-xl bg-secondary text-3xl font-bold text-slate-400 sm:size-28">
                      {team.name.charAt(0)}
                    </div>
                  )}
                  <Button variant="outline" size="sm" disabled={!canEdit('teams')} onClick={() => editTeam(team)}>
                    <Pencil />
                    {t.editTeam}
                  </Button>
                </div>
              </div>

              {/* Players Section */}
              <div className="mt-auto border-t border-border bg-slate-50/70 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    {t.playersCount}
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-secondary-foreground">
                      {team.players?.length || 0}
                    </span>
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => toggleTeamPlayers(team.id)}>
                      {expandedTeams.has(team.id) ? <ChevronUp /> : <ChevronDown />}
                      {expandedTeams.has(team.id) ? t.viewLess : t.viewPlayers}
                    </Button>
                    <Button size="sm" variant="success" disabled={!canEdit('teams')} onClick={() => openAddPlayerForm(team.id)}>
                      <UserPlus />
                      {t.addPlayer}
                    </Button>
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={() => {
                        setSelectedTeamForTemplates(team.id)
                        setShowTemplateManagement(true)
                      }}
                    >
                      <ClipboardList />
                      Edit Templates
                    </Button>
                  </div>
                </div>

                {expandedTeams.has(team.id) && (
                  <>
                    {team.players && team.players.length > 0 ? (
                      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                        {team.players.map((player) => (
                          <li key={player.id} className="flex items-center gap-3 px-3 py-2">
                            <Avatar
                              src={player.photo_url}
                              alt={`${player.first_name} ${player.last_name}`}
                              initials={`${player.first_name.charAt(0)}${player.last_name.charAt(0)}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {player.first_name} {player.last_name}
                                </span>
                                {player.jersey_number ? (
                                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">#{player.jersey_number}</span>
                                ) : null}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {player.positions?.join(', ')} • {player.handedness}
                              </div>
                            </div>
                            <Button size="xs" variant="ghost" disabled={!canEdit('teams')} onClick={() => editPlayer(player, team.id)}>
                              <Pencil />
                              {t.editPlayer}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">{t.noItemsFound} {t.playersCount.toLowerCase()}</p>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Player Selection Modal */}
      {showPlayerSelectionModal && (
        <Modal
          size="lg"
          title={`${t.selectPlayerToAdd} ${teams.find(t => t.id === showPlayerSelectionModal)?.name || t.team}`}
          onClose={() => {
            setShowPlayerSelectionModal(null)
            setSelectedTeamForPlayer(null)
          }}
          footer={
            <Button variant="success" onClick={() => openNewPlayerForm(showPlayerSelectionModal)}>
              <UserPlus />
              {t.newPlayer}
            </Button>
          }
        >
          {playersWithoutTeams.length > 0 ? (
            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-slate-700">{t.playersWithoutTeams}</h5>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {playersWithoutTeams.map((player) => (
                  <button
                    type="button"
                    key={player.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => selectExistingPlayerForTeam(player, showPlayerSelectionModal)}
                  >
                    <Avatar
                      size="lg"
                      src={player.photo_url}
                      alt={`${player.first_name} ${player.last_name}`}
                      initials={`${player.first_name.charAt(0)}${player.last_name.charAt(0)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {player.first_name} {player.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        DOB: {player.date_of_birth}
                      </div>
                      {player.positions && player.positions.length > 0 && (
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {player.positions.join(', ')}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={<Users />} title={t.noPlayersWithoutTeams} className="py-10" />
          )}
        </Modal>
      )}

      {/* Add Player Form Modal */}
      {showAddPlayerForm && !editingPlayer && (
        <Modal
          size="lg"
          title={`${t.addPlayerTo} ${teams.find(t => t.id === showAddPlayerForm)?.name || 'Team'}`}
          onClose={resetPlayerForm}
        >
          <form onSubmit={handlePlayerSubmit} className="space-y-5">
            {playerFormFields}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={resetPlayerForm}>
                {t.cancel}
              </Button>
              <Button
                type="submit"
                variant="success"
                loading={submittingPlayer}
                disabled={playerFormData.positions.length === 0}
              >
                {submittingPlayer ? t.adding : t.addPlayer}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Player Modal */}
      {editingPlayer && (
        <Modal
          size="lg"
          title={`${t.editPlayer}: ${editingPlayer.first_name} ${editingPlayer.last_name}`}
          onClose={resetPlayerForm}
        >
          <form onSubmit={handlePlayerSubmit} className="space-y-5">
            {playerFormFields}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={resetPlayerForm}>
                {t.cancel}
              </Button>
              {editingPlayer && editingPlayer.team_id && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRemovePlayerFromTeam}
                  disabled={submittingPlayer}
                >
                  {submittingPlayer ? t.removing : t.removeFromTeam}
                </Button>
              )}
              <Button
                type="submit"
                loading={submittingPlayer}
                disabled={playerFormData.positions.length === 0}
              >
                {submittingPlayer ? t.updating : t.updatePlayer}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Template Management Modal */}
      {showTemplateManagement && (
        <Modal
          size="xl"
          title={
            <>
              Manage Lineup Templates
              {selectedTeamForTemplates && (
                <span className="ml-2 font-normal text-muted-foreground">
                  – {teams.find(t => t.id === selectedTeamForTemplates)?.name}
                </span>
              )}
            </>
          }
          onClose={() => {
            setShowTemplateManagement(false)
            setSelectedTeamForTemplates(null)
          }}
        >
          <LineupTemplates
            onClose={() => {
              setShowTemplateManagement(false)
              setSelectedTeamForTemplates(null)
            }}
            teamId={selectedTeamForTemplates || undefined}
          />
        </Modal>
      )}
    </div>
  )
}
