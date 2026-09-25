'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TraditionalScorebook from './TraditionalScorebook'
import HitStatistics from './HitStatistics'
import LineupSelection from './LineupSelection'
import OpponentLineupEntry from './OpponentLineupEntry'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { AlertTriangle, ArrowRight, BarChart3, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Clock, CloudSun, MapPin, Play, Plus, Trash2, X } from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, FormField, Input, LoadingState, Modal, PageHeader, Panel, Select } from '@/components/ui'

interface Game {
  id: string
  opponent: string
  game_date: string
  game_time: string
  stadium: string
  weather_conditions: string
  our_score: number
  opponent_score: number
  innings_played: number
  game_status: string
  team_id?: string
  lineup_template_id?: string | null
  opponent_lineup_template_id?: string | null
  batting_first?: 'home' | 'opponent' | null
  created_at: string
}

interface Team {
  id: string
  name: string
  city: string
  league_id?: string | null
}

export default function GamesList() {
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { t, language } = useLanguage()
  const { canEdit, teamId: myTeamId, leagueId: myLeagueId, isSuperAdmin } = usePermissions()
  const [showNewGameForm, setShowNewGameForm] = useState(false)
  const [showScorebook, setShowScorebook] = useState<string | null>(null)
  const [showStatistics, setShowStatistics] = useState<string | null>(null)
  const [showLineupSelection, setShowLineupSelection] = useState<string | null>(null)
  const [showOpponentLineup, setShowOpponentLineup] = useState<string | null>(null)
  const [gameCreationStep, setGameCreationStep] = useState<'info' | 'ourLineup' | 'opponentLineup'>('info')
  const [newGameId, setNewGameId] = useState<string | null>(null)
  // Stadiums belong to leagues: the game is played at one of them (free text stays as a fallback)
  const [stadiums, setStadiums] = useState<{ id: string; name: string; city: string | null; league: string }[]>([])
  const [stadiumChoice, setStadiumChoice] = useState<string>('')
  // A game is between two teams of a league: the board picks among the teams of its league, super admins any team
  const [leagues, setLeagues] = useState<{ id: string; name: string }[]>([])
  const [homeTeamId, setHomeTeamId] = useState<string>('')
  const [awayTeamId, setAwayTeamId] = useState<string>('')
  const [formData, setFormData] = useState({
    opponent: '',
    game_date: '',
    game_time: '',
    stadium: '',
    weather_conditions: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchGames()
    fetchTeams()
  }, [])

  async function fetchGames() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('games')
        .select('*, lineup_template_id, opponent_lineup_template_id, batting_first')
        .order('game_date', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setGames(data || [])
      }
    } catch (err) {
      setError('Failed to fetch games')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTeams() {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, city, league_id')
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

  useEffect(() => {
    supabase
      .from('stadiums')
      .select('id, name, city, leagues ( name )')
      .order('name')
      .then(({ data }) => {
        const rows = ((data ?? []) as unknown as { id: string; name: string; city: string | null; leagues: { name: string } | null }[]).map((r) => ({
          id: r.id,
          name: r.name,
          city: r.city,
          league: r.leagues?.name ?? '',
        }))
        setStadiums(rows)
      })
    supabase
      .from('leagues')
      .select('id, name')
      .order('name')
      .then(({ data }) => setLeagues((data as { id: string; name: string }[]) ?? []))
  }, [])

  const schedulableTeams = teams.filter((tm) => (isSuperAdmin || !myLeagueId ? true : tm.league_id === myLeagueId))
  const leagueName = (id?: string | null) => leagues.find((l) => l.id === id)?.name ?? ''

  // Default home team: the user's own team, else our first non-opponent team
  useEffect(() => {
    if (!showNewGameForm || homeTeamId) return
    const mine = schedulableTeams.find((tm) => tm.id === myTeamId)
    const first = schedulableTeams.find((tm) => tm.city !== 'Opponent') ?? schedulableTeams[0]
    setHomeTeamId((mine ?? first)?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNewGameForm, teams, myTeamId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const homeTeam = teams.find((tm) => tm.id === homeTeamId)
      const awayTeam = awayTeamId && awayTeamId !== 'other' ? teams.find((tm) => tm.id === awayTeamId) : undefined
      const { data, error } = await supabase
        .from('games')
        .insert([{
          ...formData,
          opponent: awayTeam ? awayTeam.name : formData.opponent,
          team_id: homeTeam?.id ?? null,
          opponent_team_id: awayTeam?.id ?? null,
          league_id: homeTeam?.league_id ?? null,
          stadium_id: stadiumChoice && stadiumChoice !== 'other' ? stadiumChoice : null,
          our_score: 0,
          opponent_score: 0,
          innings_played: 0,
          game_status: 'scheduled',
          lineup_template_id: null,
          opponent_lineup_template_id: null,
          batting_first: null
        }])
        .select('*')

      if (error) {
        setError(error.message)
        setSubmitting(false)
      } else {
        // Store the new game ID and move to lineup selection step
        setNewGameId(data[0].id)
        setGameCreationStep('ourLineup')
        setShowLineupSelection(data[0].id)
        // Don't close the form yet - wait for lineups to be selected
      }
    } catch (err) {
      setError('Failed to create game')
      setSubmitting(false)
    }
  }

  async function handleLineupSelected(gameId: string, isOpponent: boolean = false) {
    if (isOpponent) {
      // Opponent lineup selected, finish game creation
      await fetchGames()
      setFormData({
        opponent: '',
        game_date: '',
        game_time: '',
        stadium: '',
        weather_conditions: ''
      })
      setAwayTeamId('')
      setStadiumChoice('')
      setShowNewGameForm(false)
      setShowLineupSelection(null)
      setShowOpponentLineup(null)
      setGameCreationStep('info')
      setNewGameId(null)
    } else {
      // Our lineup selected, now show opponent lineup
      setGameCreationStep('opponentLineup')
      setShowLineupSelection(null)
      setShowOpponentLineup(gameId)
    }
  }

  // Closing the game-preparation modal: for a game that was just created this finishes the
  // creation flow (the stepper covers our lineup, the opponent lineup and home/away); for an
  // existing game it just refreshes the list so the lineup status badges are current.
  async function closeLineupSelection() {
    if (newGameId && newGameId === showLineupSelection) {
      await handleLineupSelected(newGameId, true)
      return
    }
    setShowLineupSelection(null)
    await fetchGames()
  }

  async function updateGameStatus(gameId: string, status: string) {
    try {
      const { error } = await supabase
        .from('games')
        .update({ game_status: status })
        .eq('id', gameId)

      if (error) {
        console.error('Error updating game status:', error)
        alert('Error al actualizar el estado del juego')
        return
      }

      // Refresh games list
      await fetchGames()
    } catch (error) {
      console.error('Error updating game status:', error)
      alert('Error al actualizar el estado del juego')
    }
  }

  async function clearGameData(gameId: string) {
    if (!isSuperAdmin) return
    if (!confirm('¿Estás seguro de que quieres limpiar todos los datos del juego? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      // One transaction: old substitutions must never survive a game reset.
      const { error: gameError } = await supabase.rpc('reset_scorecard_game', { p_game_id: gameId })

      if (gameError) {
        console.error('Error resetting game:', gameError)
        alert('No se pudo limpiar el juego. No se guardó ningún cambio. Revisa la configuración de la base de datos e inténtalo de nuevo.')
        return
      }

      // Refresh games list
      await fetchGames()
      alert('Datos del juego limpiados exitosamente')
    } catch (err) {
      console.error('Error clearing game data:', err)
      alert('Error al limpiar los datos del juego')
    }
  }

  function getStatusVariant(status: string): 'primary' | 'success' | 'default' | 'warning' | 'danger' {
    switch (status) {
      case 'scheduled': return 'primary'
      case 'in_progress': return 'success'
      case 'completed': return 'default'
      case 'postponed': return 'warning'
      case 'cancelled': return 'danger'
      default: return 'default'
    }
  }

  function formatGameTime(time: string) {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }
  if (loading) {
    return <LoadingState label="Loading games..." />
  }

  if (error) {
    return <Alert variant="error">Error: {error}</Alert>
  }

  const lineupStatusRow = (ok: boolean, label: string) => (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
      )}
      <span className="text-slate-700">{label}</span>
    </li>
  )

  return (
    <div className="space-y-6">
      <section className="stadium-hero relative overflow-hidden rounded-2xl px-6 py-7 text-white sm:px-8">
        <div aria-hidden className="absolute -right-6 -top-8 size-52 rotate-45 rounded-3xl border-[18px] border-white/5" />
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">{language === 'es' ? 'Del primer lanzamiento al último out' : 'From first pitch to final out'}</p>
        <h2 className="relative mt-3 text-4xl font-black tracking-tight sm:text-5xl">{language === 'es' ? 'Día de juego.' : 'Game day.'}</h2>
        <div className="relative mt-5 flex flex-wrap gap-6 text-sm"><span><strong className="mr-2 font-mono text-xl">{games.filter(g => g.game_status === 'scheduled').length}</strong><span className="text-slate-300">{language === 'es' ? 'por jugar' : 'scheduled'}</span></span><span><strong className="mr-2 font-mono text-xl text-emerald-300">{games.filter(g => g.game_status === 'in_progress').length}</strong><span className="text-slate-300">{language === 'es' ? 'en juego' : 'in play'}</span></span><span><strong className="mr-2 font-mono text-xl">{games.filter(g => g.game_status === 'completed').length}</strong><span className="text-slate-300">{language === 'es' ? 'finalizados' : 'completed'}</span></span></div>
      </section>
      <PageHeader
        title={t.gamesCount}
        count={games.length}
        actions={
          canEdit('gamesCreate') && <Button
            variant={showNewGameForm ? 'outline' : 'primary'}
            onClick={() => setShowNewGameForm(!showNewGameForm)}
            className="w-full sm:w-auto"
          >
            {showNewGameForm ? <X /> : <Plus />}
            {showNewGameForm ? t.cancel : t.newGame}
          </Button>
        }
      />

      {showNewGameForm && gameCreationStep === 'info' && (
        <Panel>
          <h4 className="mb-5 text-base font-semibold">{t.createNewGame}</h4>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={language === 'es' ? 'Equipo local' : 'Home team'} required>
                <Select required value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}>
                  <option value="">—</option>
                  {schedulableTeams.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.name}{leagueName(tm.league_id) ? ` · ${leagueName(tm.league_id)}` : ''}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={language === 'es' ? 'Visitante' : 'Away team'} required>
                <div className="space-y-2">
                  <Select required value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}>
                    <option value="">—</option>
                    {schedulableTeams.filter((tm) => tm.id !== homeTeamId).map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}{leagueName(tm.league_id) ? ` · ${leagueName(tm.league_id)}` : ''}
                      </option>
                    ))}
                    <option value="other">{language === 'es' ? 'Otro equipo…' : 'Other team…'}</option>
                  </Select>
                  {awayTeamId === 'other' && (
                    <Input
                      type="text"
                      required
                      value={formData.opponent}
                      onChange={(e) => setFormData({...formData, opponent: e.target.value})}
                      placeholder={language === 'es' ? 'Nombre del equipo visitante' : 'Away team name'}
                    />
                  )}
                </div>
              </FormField>
              <FormField label={t.gameDate} required>
                <Input
                  type="date"
                  required
                  value={formData.game_date}
                  onChange={(e) => setFormData({...formData, game_date: e.target.value})}
                />
              </FormField>
              <FormField label={t.gameTime}>
                <Input
                  type="time"
                  value={formData.game_time}
                  onChange={(e) => setFormData({...formData, game_time: e.target.value})}
                />
              </FormField>
              <FormField label={t.stadium}>
                {stadiums.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={stadiumChoice}
                      onChange={(e) => {
                        const v = e.target.value
                        setStadiumChoice(v)
                        const st = stadiums.find((x) => x.id === v)
                        setFormData({ ...formData, stadium: st ? st.name : v === 'other' ? formData.stadium : '' })
                      }}
                    >
                      <option value="">—</option>
                      {Array.from(new Set(stadiums.map((x) => x.league))).map((league) => (
                        <optgroup key={league || 'none'} label={league || '—'}>
                          {stadiums
                            .filter((x) => x.league === league)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name}
                                {x.city ? ` · ${x.city}` : ''}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                      <option value="other">{language === 'es' ? 'Otro lugar…' : 'Other place…'}</option>
                    </Select>
                    {stadiumChoice === 'other' && (
                      <Input
                        type="text"
                        value={formData.stadium}
                        onChange={(e) => setFormData({ ...formData, stadium: e.target.value })}
                        placeholder={language === 'es' ? 'Nombre del campo' : 'Field name'}
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={formData.stadium}
                    onChange={(e) => setFormData({...formData, stadium: e.target.value})}
                    placeholder="e.g., Yankee Stadium"
                  />
                )}
              </FormField>
              <FormField label={t.weather}>
                <Input
                  type="text"
                  value={formData.weather_conditions}
                  onChange={(e) => setFormData({...formData, weather_conditions: e.target.value})}
                  placeholder="e.g., Sunny, 75°F"
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewGameForm(false)
                  setGameCreationStep('info')
                  setNewGameId(null)
                }}
              >
                {t.cancel}
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? t.creating : t.nextSelectLineup}
                {!submitting && <ArrowRight />}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* Step indicator when in lineup selection */}
      {(gameCreationStep === 'ourLineup' || gameCreationStep === 'opponentLineup') && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-base font-semibold text-blue-900">
              {gameCreationStep === 'ourLineup' ? t.step2SelectLineup : t.step3EnterOpponent}
            </h4>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={() => {
                setShowNewGameForm(false)
                setShowLineupSelection(null)
                setShowOpponentLineup(null)
                setGameCreationStep('info')
                setNewGameId(null)
              }}
            >
              <X />
            </Button>
          </div>
          <div className="flex gap-2">
            <div className={`h-2 flex-1 rounded-full ${gameCreationStep === 'ourLineup' ? 'bg-primary' : 'bg-emerald-500'}`}></div>
            <div className={`h-2 flex-1 rounded-full ${gameCreationStep === 'opponentLineup' ? 'bg-primary' : 'bg-blue-200'}`}></div>
          </div>
        </div>
      )}

      {games.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title={`${t.noItemsFound} ${t.gamesCount.toLowerCase()}`}
          description={t.addFirstItem}
        />
      ) : (
        <div className="space-y-4">
          {games.map((game) => (
            <Card key={game.id} className="overflow-hidden border-t-4 border-t-primary">
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
                {/* Game info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xl font-extrabold tracking-tight">
                      vs {game.opponent}
                    </h4>
                    <Badge variant={getStatusVariant(game.game_status)}>
                      {game.game_status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5" title={t.date}>
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {new Date(game.game_date).toLocaleDateString()}
                    </span>
                    {game.game_time && (
                      <span className="inline-flex items-center gap-1.5" title={t.time}>
                        <Clock className="size-4" aria-hidden="true" />
                        {formatGameTime(game.game_time)}
                      </span>
                    )}
                    {game.stadium && (
                      <span className="inline-flex items-center gap-1.5" title={t.stadium}>
                        <MapPin className="size-4" aria-hidden="true" />
                        {game.stadium}
                      </span>
                    )}
                    {game.weather_conditions && (
                      <span className="inline-flex items-center gap-1.5" title={t.weather}>
                        <CloudSun className="size-4" aria-hidden="true" />
                        {game.weather_conditions}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score + actions */}
                <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                  <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-900 px-5 py-2 text-white sm:justify-end">
                    <span className="font-mono text-3xl font-black tabular-nums">{game.our_score}</span>
                    <span className="text-slate-500">–</span>
                    <span className="text-2xl font-bold tabular-nums">{game.opponent_score}</span>
                  </div>

                  {game.game_status === 'scheduled' && (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        {/* Only show Start Scoring if both lineups are selected and home/away is selected */}
                        {game.lineup_template_id && game.opponent_lineup_template_id && game.batting_first ? (
                          <Button
                            variant="success"
                            size="sm"
                            disabled={!canEdit('scorebook')}
                            onClick={() => {
                              updateGameStatus(game.id, 'in_progress')
                              setShowScorebook(game.id)
                            }}
                          >
                            <Play />
                            {t.startScoring}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled
                            title={
                              !game.lineup_template_id
                                ? 'Select our team lineup first'
                                : !game.opponent_lineup_template_id
                                ? 'Select opponent lineup first'
                                : 'Select which team bats first'
                            }
                          >
                            <Play />
                            {t.startScoring}
                          </Button>
                        )}
                        <Button variant="accent" size="sm" disabled={!canEdit('gamesLineups')} onClick={() => setShowLineupSelection(game.id)}>
                          <ClipboardList />
                          {t.selectLineup}
                        </Button>
                      </div>
                      {/* Lineup Selection Status */}
                      <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs sm:min-w-[260px]">
                        <p className="mb-1.5 font-semibold text-slate-700">Estado de Alineaciones:</p>
                        <ul className="space-y-1">
                          {lineupStatusRow(
                            !!game.lineup_template_id,
                            game.lineup_template_id ? 'Nuestro Equipo: Alineación elegida' : 'Nuestro Equipo: Pendiente'
                          )}
                          {lineupStatusRow(
                            !!game.opponent_lineup_template_id,
                            game.opponent_lineup_template_id
                              ? `Oponente (${game.opponent}): Alineación elegida`
                              : `Oponente (${game.opponent}): Pendiente`
                          )}
                          {lineupStatusRow(
                            !!game.batting_first,
                            game.batting_first ? 'Local/Visitante: Seleccionado' : 'Local/Visitante: Pendiente'
                          )}
                        </ul>
                      </div>
                    </>
                  )}
                  {game.game_status === 'in_progress' && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button variant="warning" size="sm" disabled={!canEdit('scorebook')} onClick={() => setShowScorebook(game.id)}>
                        <Play />
                        {t.continueScoring}
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => setShowStatistics(game.id)}>
                        <BarChart3 />
                        {t.viewStatistics}
                      </Button>
                      <Button variant="destructive" size="sm" disabled={!isSuperAdmin} onClick={() => clearGameData(game.id)}>
                        <Trash2 />
                        {t.clearGameData}
                      </Button>
                    </div>
                  )}
                  {game.game_status === 'completed' && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowScorebook(game.id)}>
                        <BookOpen />
                        {t.viewScorebook}
                      </Button>
                      <Button variant="accent" size="sm" onClick={() => setShowStatistics(game.id)}>
                        <BarChart3 />
                        {t.viewStatistics}
                      </Button>
                      <Button variant="destructive" size="sm" disabled={!isSuperAdmin} onClick={() => clearGameData(game.id)}>
                        <Trash2 />
                        {t.clearData}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Digital Scorebook Modal */}
      {showScorebook && (
        <Modal size="full" tall locked onClose={() => setShowScorebook(null)} className="p-0">
          <TraditionalScorebook
            game={games.find(g => g.id === showScorebook)!}
            onClose={() => setShowScorebook(null)}
          />
        </Modal>
      )}

      {/* Statistics Modal */}
      {showStatistics && (
        <Modal size="full" tall onClose={() => setShowStatistics(null)}>
          <HitStatistics
            gameId={showStatistics}
            onClose={() => setShowStatistics(null)}
          />
        </Modal>
      )}

      {/* Our Team Lineup Selection Modal */}
      {showLineupSelection && (
        <Modal
          size="lg"
          tall
          title={`${language === 'es' ? 'Preparar juego' : 'Prepare game'} · vs ${games.find(g => g.id === showLineupSelection)?.opponent || formData.opponent}`}
          description={language === 'es' ? 'Local y visitante, ambas alineaciones y resumen antes de anotar.' : 'Home/away, both lineups and a summary before scoring.'}
          onClose={closeLineupSelection}
        >
          <LineupSelection
            gameId={showLineupSelection}
            onClose={closeLineupSelection}
            onStartScoring={(gameId) => {
              updateGameStatus(gameId, 'in_progress')
              setShowScorebook(gameId)
            }}
          />
        </Modal>
      )}

      {/* Opponent Lineup Entry Modal */}
      {showOpponentLineup && (
        <OpponentLineupEntry
          gameId={showOpponentLineup}
          opponentName={games.find(g => g.id === showOpponentLineup)?.opponent || formData.opponent}
          onClose={() => {
            if (newGameId === showOpponentLineup) {
              handleLineupSelected(showOpponentLineup, true)
            } else {
              setShowOpponentLineup(null)
            }
          }}
        />
      )}
    </div>
  )
}
