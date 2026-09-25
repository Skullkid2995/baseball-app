'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playerOuts, savedPlay, scoringPlay } from '@/lib/scorecard/plays'
import { canScoreCell, inningColumns, nextAtBat, type AtBatCell } from '@/lib/scorecard/battingOrder'
import { atBatIdentity } from '@/lib/scorecard/atBatRecord'
import Scoreboard from './Scoreboard'
import PaperScoreHeader from './PaperScoreHeader'
import { battingLine } from '@/lib/batterStats'
import PlayerChangeModal from './PlayerChangeModal'
import { changedLineup, slotRows, runnerIdentity, type PlayerChange, type ChangeKind } from '@/lib/scorecard/substitutions'
import ScorebookDiamond from './ScorebookDiamond'
import SavedPaperInk from './SavedPaperInk'
import { ensureStartingPitcher } from '@/lib/scorecard/startingPitcher'
import ScorecardPlayHistory from './ScorecardPlayHistory'
import type { SavedRunnerEvent } from '@/lib/scorecard/playHistory'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import DiamondCanvas, { type ActiveRunner, type RunnerUpdate } from './DiamondCanvas'
import PitcherPicker, { type RosterPlayer } from './PitcherPicker'
import { loadMatchup, type MatchupSummary } from '@/lib/matchup'
import { applyRunnerEvent, runnerBaseOf, type RunnerEventInput } from '@/lib/runnerEvents'
import OpponentLineupEntry from './OpponentLineupEntry'
import { ArrowLeftRight, Lock, Save } from 'lucide-react'
import { Button, FormField, Input, LoadingState, Modal } from '@/components/ui'

interface Player {
  id: string
  first_name: string
  last_name: string
  jersey_number: number
  positions: string[]
}

interface Game {
  id: string
  opponent: string
  game_date: string
  our_score: number
  opponent_score: number
  innings_played: number
  game_status: string
  batting_first?: 'home' | 'opponent' | null
}

/** A pitching appearance: who took the mound for a side and when (game_pitchers) */
interface GamePitcher {
  id: string
  team_side: 'home' | 'opponent'
  pitcher_id: string
  sequence: number
  from_inning: number
}

interface AtBat {
  id: string
  player_id: string
  inning: number
  at_bat_number: number
  result: string
  rbi: number
  runs_scored: number
  stolen_bases: number
  team_side?: 'home' | 'opponent'
  base_runners?: { first: boolean, second: boolean, third: boolean, home: boolean }
  base_runner_outs?: { first: boolean, second: boolean, third: boolean, home: boolean }
  notation?: string
  out_type?: string
  players?: Player
  created_at?: string
}

export default function TraditionalScorebook({ game, onClose }: { game: Game, onClose: () => void }) {
  const saveInFlight = useRef(false)
  const [saveNotice, setSaveNotice] = useState('')
  const [paperMode, setPaperMode] = useState(true)
  const paperEditorRef = useRef<HTMLDivElement>(null)
  const [viewedAtBat, setViewedAtBat] = useState<AtBat | null>(null)
  const [runnerHistory, setRunnerHistory] = useState<SavedRunnerEvent[]>([])
  const [historyError, setHistoryError] = useState(false)
  const historyByAtBat = useMemo(() => {
    const grouped = new Map<string, SavedRunnerEvent[]>()
    for (const event of runnerHistory) grouped.set(event.runner_at_bat_id, [...(grouped.get(event.runner_at_bat_id) || []), event])
    return grouped
  }, [runnerHistory])
  const fetchRunnerHistory = useCallback(async () => {
    const { data, error } = await supabase.from('runner_events').select('id,runner_at_bat_id,event_type,from_base,to_base,is_out,fielders,created_at').eq('game_id', game.id).order('created_at')
    setHistoryError(!!error)
    if (!error) setRunnerHistory(data || [])
  }, [game.id])
  useEffect(() => { setViewedAtBat(null); setRunnerHistory([]); void fetchRunnerHistory() }, [fetchRunnerHistory])
  const nextBatterButton = useRef<HTMLButtonElement>(null)
  const [guideRequest, setGuideRequest] = useState(0)

  function guideToNextBatter() {
    const target = nextBatterButton.current
    if (!target) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'center', inline: 'end', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  useEffect(() => {
    if (!guideRequest) return
    const frame = requestAnimationFrame(guideToNextBatter)
    return () => cancelAnimationFrame(frame)
  }, [guideRequest])
  const [selectedAtBatId, setSelectedAtBatId] = useState<string | null>(null)
  const [initialPlayers, setPlayers] = useState<Player[]>([])
  const [initialOpponentPlayers, setOpponentPlayers] = useState<Player[]>([])
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [currentGame, setCurrentGame] = useState<Game>(game)
  const [currentTeamSide, setCurrentTeamSide] = useState<'home' | 'opponent'>('home') // Track which team is batting
  const [homeTeamName, setHomeTeamName] = useState<string>('Dodgers') // Default to "Dodgers" until we fetch it
  const [gameInfo, setGameInfo] = useState({
    opponent: game.opponent,
    date: game.game_date,
    startTime: '',
    field: '',
    length: '',
    umpire: ''
  })
  const [loading, setLoading] = useState(true)
  const [selectedCell, setSelectedCell] = useState<(AtBatCell & { playerName: string }) | null>(null)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  useEffect(()=>{
    if (!paperMode || !showCanvasModal) return
    const frame=requestAnimationFrame(()=>paperEditorRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}))
    return ()=>cancelAnimationFrame(frame)
  },[paperMode,showCanvasModal])
  const [isLocked, setIsLocked] = useState(game.game_status === 'completed')
  const [showOpponentLineupModal, setShowOpponentLineupModal] = useState(false)
  const [showHomeAwayModal, setShowHomeAwayModal] = useState(false)
  const [opponentLineupChecked, setOpponentLineupChecked] = useState(false)
  const [homeAwayChecked, setHomeAwayChecked] = useState(false)
  const { language: uiLang } = useLanguage()
  // Pitcher on record: who is on the mound for each side (game_pitchers) and the rosters to pick from.
  // Every at-bat is stamped with the pitcher it was against, so batter-vs-pitcher history builds up.
  const [ourTeamId, setOurTeamId] = useState<string | null>(null)
  const [opponentTeamId, setOpponentTeamId] = useState<string | null>(null)
  const [ourRoster, setOurRoster] = useState<RosterPlayer[]>([])
  const [opponentRoster, setOpponentRoster] = useState<RosterPlayer[]>([])
  const [gamePitchers, setGamePitchers] = useState<GamePitcher[]>([])
  const [pitchersLoading, setPitchersLoading] = useState(true)
  const [pitchersError, setPitchersError] = useState('')
  const [pitcherPicker, setPitcherPicker] = useState<{ side: 'home' | 'opponent'; reason: 'start' | 'change' } | null>(null)
  const [pendingCell, setPendingCell] = useState<(AtBatCell & { playerName: string }) | null>(null)
  const [matchup, setMatchup] = useState<MatchupSummary | null>(null)

  const [changes, setChanges] = useState<PlayerChange[]>([])
  const [changesLoading, setChangesLoading] = useState(true)
  const [changesError, setChangesError] = useState('')
  const [changePicker, setChangePicker] = useState<{ side: 'home' | 'opponent'; kind: ChangeKind; outId?: string } | null>(null)
  const players = useMemo(() => changedLineup(initialPlayers, changes, 'home'), [initialPlayers, changes])
  const opponentPlayers = useMemo(() => changedLineup(initialOpponentPlayers, changes, 'opponent'), [initialOpponentPlayers, changes])
  const displayedLineup = currentTeamSide === 'home' ? players : opponentPlayers
  const displayedRows = slotRows(atBats, displayedLineup, currentTeamSide)

  useEffect(() => {
    supabase.from('scorecard_player_changes').select('*').eq('game_id', game.id).order('sequence').then(({ data, error }) => {
      if (error) setChangesError(error.message)
      else { setChanges((data || []) as PlayerChange[]); setChangesError('') }
      setChangesLoading(false)
    })
  }, [game.id])

  useEffect(() => {
    if (ourTeamId) loadRoster(ourTeamId, setOurRoster)
  }, [ourTeamId])
  useEffect(() => {
    if (opponentTeamId) loadRoster(opponentTeamId, setOpponentRoster)
  }, [opponentTeamId])

  useEffect(() => {
    fetchPlayers()
    fetchAtBats()
  }, [game.id])

  // Refetch game data when currentGame changes to ensure score is up to date
  useEffect(() => {
    const refreshGame = async () => {
      const { data, error } = await supabase
        .from('games')
        .select()
        .eq('id', game.id)
        .single()
      
      if (!error && data) {
        setCurrentGame(data)
      }
    }
    
    // Refresh game data after a short delay to allow database updates to propagate
    const timeoutId = setTimeout(() => {
      refreshGame()
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [atBats.length]) // Refresh when at-bats change

  // Check if we need to show home/away modal when scorebook first opens
  useEffect(() => {
    // Only check once, and only if game is not completed
    if (homeAwayChecked || game.game_status === 'completed' || loading) return
    
    // Fetch batting_first from database
    async function checkBattingFirst() {
      const { data: gameData } = await supabase
        .from('games')
        .select('batting_first')
        .eq('id', game.id)
        .single()
      
      if (gameData?.batting_first) {
        // Already selected, set the current team side and mark as checked
        setCurrentTeamSide(gameData.batting_first === 'home' ? 'home' : 'opponent')
        setHomeAwayChecked(true)
        return
      }
      
      // If there are no at-bats and opponent lineup exists, show home/away modal
      // This determines who bats first
      if (atBats.length === 0 && opponentPlayers.length > 0 && !showOpponentLineupModal) {
        setHomeAwayChecked(true)
        // Small delay to ensure UI is ready
        setTimeout(() => {
          setShowHomeAwayModal(true)
        }, 300)
      }
    }
    
    checkBattingFirst()
  }, [atBats.length, opponentPlayers.length, showOpponentLineupModal, homeAwayChecked, game.game_status, loading, game.id])

  async function fetchPlayers() {
    setPitchersLoading(true)
    setPitchersError('')
    try {
      // Fetch our team's lineup from lineup template and batting_first
      const { data: gameData } = await supabase
        .from('games')
        .select('lineup_template_id, opponent_lineup_template_id, batting_first')
        .eq('id', game.id)
        .single()

      if (gameData?.batting_first) setCurrentGame(prev => ({ ...prev, batting_first: gameData.batting_first }))

      // Check if opponent lineup exists, if not show modal to create it
      // Only check once to prevent loops
      if (!opponentLineupChecked && game.game_status !== 'completed') {
        setOpponentLineupChecked(true)
        
        // Also check if there's an opponent team with a lineup template (in case linking failed)
        let hasOpponentLineup = !!gameData?.opponent_lineup_template_id
        
        if (!hasOpponentLineup) {
          // Check if opponent team exists and has a lineup template
          const { data: opponentTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('name', game.opponent)
            .limit(1)
            .maybeSingle()
          
          if (opponentTeam?.id) {
            const { data: opponentTemplate } = await supabase
              .from('lineup_templates')
              .select('id')
              .eq('team_id', opponentTeam.id)
              .limit(1)
            hasOpponentLineup = !!opponentTemplate && opponentTemplate.length > 0
          }
          
          if (!hasOpponentLineup) {
            setShowOpponentLineupModal(true)
            // Don't check for home/away yet - wait for opponent lineup to be created
            return
          }
        }
      }

      if (gameData?.lineup_template_id) {
        // Fetch our team's players from lineup template and get team name
        const { data: ourLineupTemplate, error: templateError } = await supabase
          .from('lineup_templates')
          .select(`
            id,
            team_id,
            teams (
              id,
              name
            )
          `)
          .eq('id', gameData.lineup_template_id)
          .single()

        if (ourLineupTemplate?.team_id) setOurTeamId(ourLineupTemplate.team_id)
        console.log('Lineup template data:', ourLineupTemplate)
        console.log('Template error:', templateError)

        if (ourLineupTemplate?.teams) {
          const team = Array.isArray(ourLineupTemplate.teams) 
            ? ourLineupTemplate.teams[0] 
            : ourLineupTemplate.teams
          if (team && typeof team === 'object' && 'name' in team) {
            const teamName = (team as { name: string }).name
            console.log('Setting home team name to:', teamName)
            setHomeTeamName(teamName || 'Dodgers')
          }
        } else {
          console.log('No teams data found in lineup template')
          // Try to get team name directly from team_id if available
          if (ourLineupTemplate?.team_id) {
            const { data: teamData } = await supabase
              .from('teams')
              .select('name')
              .eq('id', ourLineupTemplate.team_id)
              .single()
            
            if (teamData?.name) {
              console.log('Found team name from team_id:', teamData.name)
              setHomeTeamName(teamData.name)
            }
          }
        }

        const { data: ourLineupPlayers } = await supabase
          .from('lineup_template_players')
          .select(`
            player_id,
            batting_order,
            batting_for,
            position,
            players (
              id,
              first_name,
              last_name,
              jersey_number,
              positions
            )
          `)
          .eq('template_id', gameData.lineup_template_id)
          .order('batting_order')

        if (ourLineupPlayers) {
          const ourPlayers: Player[] = ourLineupPlayers
            .map(lp => {
              const player = lp.players
              if (player && typeof player === 'object' && !Array.isArray(player) && 'id' in player) {
                return { ...(player as Player), positions: lp.position ? [lp.position] : (player as Player).positions }
              }
              return null
            })
            .filter((p): p is Player => p !== null)
          setPlayers(ourPlayers)
          if (game.game_status !== 'completed') await ensureStartingPitcher(supabase, game.id, 'home', ourLineupPlayers)
        }
      } else {
        // Fallback: fetch all players (limit to 9)
        const { data, error } = await supabase
          .from('players')
          .select('id, first_name, last_name, jersey_number, positions')
          .order('jersey_number')
          .limit(9)

        if (!error && data) {
          setPlayers(data)
        }
      }

      // Fetch opponent's lineup from lineup template
      // First try using opponent_lineup_template_id from game
      let opponentTemplateId = gameData?.opponent_lineup_template_id
      
      // If not linked to game, try to find it by opponent team name
      if (!opponentTemplateId) {
        const { data: opponentTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('name', game.opponent)
          .limit(1)
          .maybeSingle()
        
        if (opponentTeam?.id) {
          setOpponentTeamId(opponentTeam.id)
          const { data: opponentTemplate } = await supabase
            .from('lineup_templates')
            .select('id')
            .eq('team_id', opponentTeam.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (opponentTemplate?.id) {
            opponentTemplateId = opponentTemplate.id
          }
        }
      }
      
      if (opponentTemplateId) {
        const { data: oppTemplate } = await supabase.from('lineup_templates').select('team_id').eq('id', opponentTemplateId).maybeSingle()
        if (oppTemplate?.team_id) setOpponentTeamId(oppTemplate.team_id)
        const { data: opponentLineupPlayers } = await supabase
          .from('lineup_template_players')
          .select(`
            player_id,
            batting_order,
            batting_for,
            position,
            players (
              id,
              first_name,
              last_name,
              jersey_number,
              positions
            )
          `)
          .eq('template_id', opponentTemplateId)
          .order('batting_order')

        if (opponentLineupPlayers) {
          const oppPlayers: Player[] = opponentLineupPlayers
            .map(lp => {
              const player = lp.players
              if (player && typeof player === 'object' && !Array.isArray(player) && 'id' in player) {
                return { ...(player as Player), positions: lp.position ? [lp.position] : (player as Player).positions }
              }
              return null
            })
            .filter((p): p is Player => p !== null)
          setOpponentPlayers(oppPlayers)
          if (game.game_status !== 'completed') await ensureStartingPitcher(supabase, game.id, 'opponent', opponentLineupPlayers)
          console.log('Opponent players loaded:', oppPlayers.length, 'players')
        } else {
          console.log('No opponent lineup players found for template:', opponentTemplateId)
        }
      } else {
        console.log('No opponent lineup template found')
      }
    } catch (err) {
      console.error('Failed to fetch players:', err)
      setPitchersError(uiLang === 'es' ? 'No se pudo preparar el pitcher inicial. Vuelve a cargar el juego.' : 'Could not prepare the starting pitcher. Reload the game.')
    } finally {
      await fetchGamePitchers()
      setPitchersLoading(false)
    }
  }

  async function fetchAtBats() {
    try {
      const { data, error } = await supabase
        .from('at_bats')
        .select(`
          *,
          players (
            first_name,
            last_name,
            jersey_number
          )
        `)
        .eq('game_id', game.id)
        .order('inning', { ascending: true })
        .order('at_bat_number', { ascending: true })

      if (error) {
        console.error('Error fetching at-bats:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        setLoading(false)
        return
      } else {
        setAtBats(data || [])
        
        // Always recalculate the score from the saved at-bats, each side on its own
        const totalRunsScored = (data || []).filter(ab => ab.team_side !== 'opponent').reduce((sum, ab) => sum + (ab.runs_scored || 0), 0)
        const opponentRunsScored = (data || []).filter(ab => ab.team_side === 'opponent').reduce((sum, ab) => sum + (ab.runs_scored || 0), 0)
        
        // Debug: Log which at-bats have runs_scored
        const atBatsWithRuns = (data || []).filter(ab => (ab.runs_scored || 0) > 0)
        console.log(`=== SCORE RECALCULATION ===`)
        console.log(`Total at-bats: ${data?.length || 0}`)
        console.log(`At-bats with runs: ${atBatsWithRuns.length}`)
        atBatsWithRuns.forEach(ab => {
          console.log(`  - Player: ${ab.players?.first_name} ${ab.players?.last_name}, Inning: ${ab.inning}, Runs: ${ab.runs_scored}`)
        })
        console.log(`Calculated total runs: ${totalRunsScored}`)
        console.log(`Current game score: ${currentGame.our_score}`)
        console.log(`===========================`)
        
        // Always update the game score to match the sum of all at-bats (ensures accuracy)
        const { data: updatedGame, error: scoreError } = await supabase
          .from('games')
          .update({ 
            our_score: totalRunsScored,
            opponent_score: opponentRunsScored,
            updated_at: new Date().toISOString()
          })
          .eq('id', game.id)
          .select()
        
        if (scoreError) {
          console.error('Error updating game score:', scoreError)
        } else if (updatedGame && updatedGame[0]) {
          setCurrentGame(updatedGame[0])
          console.log('Game score recalculated and updated to:', totalRunsScored)
        }
        
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to fetch at-bats:', err)
      setLoading(false)
    }
  }

  async function fetchGamePitchers() {
    const { data, error } = await supabase
      .from('game_pitchers')
      .select('id, team_side, pitcher_id, sequence, from_inning')
      .eq('game_id', game.id)
      .order('sequence')
    if (error) { setPitchersError(error.message); return }
    setGamePitchers((data as GamePitcher[]) ?? [])
  }

  async function loadRoster(teamId: string, set: (rows: RosterPlayer[]) => void) {
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name, jersey_number, positions')
      .eq('team_id', teamId)
      .order('jersey_number')
    set((data as RosterPlayer[]) ?? [])
  }

  /** The side on the mound while battingSide bats */
  const fieldingSide = (battingSide: 'home' | 'opponent'): 'home' | 'opponent' => (battingSide === 'home' ? 'opponent' : 'home')

  function currentPitcher(side: 'home' | 'opponent'): RosterPlayer | null {
    const rows = gamePitchers.filter((g) => g.team_side === side)
    const last = rows[rows.length - 1]
    if (!last) return null
    const roster = side === 'home' ? ourRoster : opponentRoster
    return roster.find((p) => p.id === last.pitcher_id) ?? { id: last.pitcher_id, first_name: '?', last_name: '', jersey_number: null }
  }

  /** Inning the given side is currently pitching in (the batting side's latest inning) */
  function currentInningFor(pitchingSide: 'home' | 'opponent'): number {
    const battingSide = fieldingSide(pitchingSide)
    const innings = atBats
      .filter((ab) => ab.team_side === battingSide || (!ab.team_side && battingSide === 'home'))
      .map((ab) => ab.inning)
    return innings.length ? Math.max(...innings) : 1
  }

  async function pickPitcher(side: 'home' | 'opponent', player: RosterPlayer) {
    const sequence = gamePitchers.filter((g) => g.team_side === side).length + 1
    const { error } = await supabase
      .from('game_pitchers')
      .insert([{ game_id: game.id, team_side: side, pitcher_id: player.id, sequence, from_inning: currentInningFor(side) }])
    if (error) {
      alert('Could not save the pitcher: ' + error.message)
      return
    }
    await fetchGamePitchers()
    setPitcherPicker(null)
    if (pendingCell) {
      const cell = pendingCell
      setPendingCell(null)
      openCell(cell, player)
    }
  }

  /** Open the at-bat dialog and load this batter's history against the pitcher on the mound */
  async function openCell(cell: AtBatCell & { playerName: string }, pitcher?: RosterPlayer | null) {
    if (!canScoreCell(cell, getCurrentBatter(), isLocked || !!changesError)) return
    setViewedAtBat(null)
    setSelectedAtBatId(null)
    setSelectedCell(cell)
    setShowCanvasModal(true)
    setMatchup(null)
    const p = pitcher ?? currentPitcher(fieldingSide(currentTeamSide))
    if (p) {
      setMatchup(await loadMatchup(supabase, cell.playerId, p.id, `${p.first_name} ${p.last_name}`.trim()))
    }
  }

  /** Outs already on the board in this inning for this side before the given at-bat (batter outs + runner outs). */
  function outsBefore(playerId: string, inning: number, teamSide: 'home' | 'opponent'): number {
    const own = atBats.find(ab => ab.id === selectedAtBatId)
    let outs = 0
    for (const ab of atBats) {
      if (ab.inning !== inning || ab.id === own?.id) continue
      if (!(ab.team_side === teamSide || (!ab.team_side && teamSide === 'home'))) continue
      if (own?.created_at && ab.created_at && ab.created_at > own.created_at) continue
      outs += playerOuts(ab)
    }
    return Math.min(3, outs)
  }

  function getAtBatForPlayer(playerId: string, inning: number) {
    return atBats.find(ab => 
      ab.player_id === playerId && 
      ab.inning === inning &&
      (ab.team_side === currentTeamSide || (!ab.team_side && currentTeamSide === 'home'))
    )
  }

  function getAtBatForPlayerNth(playerId: string, inning: number, n: number) {
    const matches = atBats
      .filter(ab => displayedLineup.find(p => p.id === playerId)?.members.includes(ab.player_id) && ab.inning === inning && (ab.team_side || 'home') === currentTeamSide)
      .sort((a, b) => (a.at_bat_number || 1) - (b.at_bat_number || 1))
    return matches[n - 1] || null
  }

  function getCurrentBatter() {
    const lineup = currentTeamSide === 'home' ? players : opponentPlayers
    return nextAtBat(lineup, displayedRows, currentTeamSide)
  }

  // Determine if we should add a duplicate column for the active inning
  function getInningColumns(): { inning: number; isDuplicate: boolean; appearance: number }[] {
    return inningColumns(displayedLineup, displayedRows, currentTeamSide)
  }

  function getPlayerStats(playerId: string) {
    const members = displayedLineup.find(p => p.id === playerId)?.members || [playerId]
    const playerAtBats = atBats.filter(ab => members.includes(ab.player_id) && (ab.team_side || 'home') === currentTeamSide)
    return {
      hits: playerAtBats.filter(ab => ['single', 'double', 'triple', 'home_run'].includes(ab.result)).length,
      walks: playerAtBats.filter(ab => ab.result === 'walk').length,
      runs: atBats.filter(ab => (ab.team_side || 'home') === currentTeamSide && members.includes(runnerIdentity(ab.id, ab.player_id, changes))).reduce((sum, ab) => sum + (ab.runs_scored || 0), 0),
      rbi: playerAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0),
      errors: playerAtBats.filter(ab => ab.result === 'error').length
    }
  }

  /** Runners still on base for this inning and side; optionally exclude the batter being edited. */
  function getActiveRunners(playerId: string | null, inning: number, teamSide: 'home' | 'opponent'): ActiveRunner[] {
    const list: ActiveRunner[] = []
    const lineupIds = new Set((teamSide === 'home' ? players : opponentPlayers).flatMap(p => p.members))
    for (const ab of atBats) {
      if (ab.inning !== inning || ab.player_id === playerId || !lineupIds.has(ab.player_id)) continue
      if (!(ab.team_side === teamSide || (!ab.team_side && teamSide === 'home'))) continue
      const b = ab.base_runners
      if (!b || b.home) continue
      const base: 'first' | 'second' | 'third' | null = b.third ? 'third' : b.second ? 'second' : b.first ? 'first' : null
      if (!base || playerOuts(ab)) continue
      const runnerId = runnerIdentity(ab.id, ab.player_id, changes)
      const p = [...ourRoster, ...opponentRoster].find(p => p.id === runnerId) || ab.players
      list.push({ atBatId: ab.id, notation: ab.notation || scoringPlay(ab.result)?.code, playerId: runnerId, playerName: p ? `${p.first_name} ${p.last_name}` : 'Runner', base })
    }
    // third base first, so the list reads like the field
    const order = { third: 0, second: 1, first: 2 }
    return list.sort((a, b) => order[a.base] - order[b.base])
  }

  function handleCellClick(cell: AtBatCell & { playerName: string }) {
    if (pitchersLoading || pitchersError || !canScoreCell(cell, getCurrentBatter(), isLocked)) return
    const side = fieldingSide(currentTeamSide)
    // We must know who is pitching before scoring the current at-bat.
    if (!currentPitcher(side)) {
      setPendingCell(cell)
      setPitcherPicker({ side, reason: 'start' })
      return
    }
    openCell(cell)
  }

  function openPlayerChange(kind: ChangeKind, outId?: string, side = kind === 'defensive' || kind === 'position' ? fieldingSide(currentTeamSide) : currentTeamSide) {
    if (isLocked || saveInFlight.current || (showCanvasModal && selectedAtBatId)) return
    if (kind === 'defensive' && side === currentTeamSide && outId && getActiveRunners(null, getCurrentBatter()?.inning || 1, side).some(r => r.playerId === outId)) kind = 'pinch_runner'
    setChangePicker({ side, kind, outId: outId || (kind === 'pinch_hitter' ? selectedCell?.playerId : undefined) })
  }

  async function savePlayerChange(outId: string, inId: string, position: string) {
    if (!changePicker || isLocked || saveInFlight.current) throw new Error('This scorecard is locked or saving.')
    if (changesError) throw new Error('Player changes are unavailable: ' + changesError)
    const { side, kind } = changePicker
    const lineup = side === 'home' ? players : opponentPlayers
    const outgoing = lineup.find(p => p.id === outId)
    const incoming = (side === 'home' ? ourRoster : opponentRoster).find(p => p.id === inId) || (kind === 'position' ? outgoing : undefined)
    if (!outgoing || !incoming) throw new Error('Select players from this team.')
    if (kind !== 'position' && lineup.some(p => p.members.includes(inId))) throw new Error('Choose an unused player from the bench.')
    const current = nextAtBat(lineup, slotRows(atBats, lineup, side), side)
    if (kind === 'pinch_hitter' && current?.playerId !== outId) throw new Error('Select the current batter.')
    const runner = getActiveRunners(null, current?.inning || 1, side).find(r => r.playerId === outId)
    if (kind === 'defensive' && side === currentTeamSide && runner) throw new Error('Use Pinch runner to replace a player on base.')
    if (kind === 'pinch_runner' && !runner) throw new Error('Select a player currently on base.')
    if (kind === 'position' && position === outgoing.positions[0]) throw new Error('Choose a different position.')
    if (kind === 'defensive' && lineup.some(p => p.id !== outId && p.positions[0] === position)) throw new Error('That position is occupied. Replace the player in their current position, then use Change fielding position to swap.')
    const swapped = kind === 'position' ? lineup.find(p => p.id !== outId && p.positions[0] === position) : null
    const newPitcher = position === 'P' ? inId : kind === 'position' && outgoing.positions[0] === 'P' ? swapped?.id : null
    if (kind === 'position' && outgoing.positions[0] === 'P' && !newPitcher) throw new Error('Choose a position occupied by the new pitcher to swap.')
    const { data, error } = await supabase.from('scorecard_player_changes').insert({
      game_id: game.id, team_side: side, kind, out_player_id: outId, in_player_id: inId,
      position, incoming, runner_at_bat_id: kind === 'pinch_runner' ? runner!.atBatId : null,
      new_pitcher_id: newPitcher || null, inning: currentInningFor(side),
      previous_change_id: changes.filter(c => c.team_side === side).at(-1)?.id || null,
    }).select('*').single()
    if (error) throw new Error(error.message)
    setChanges(prev => [...prev, data as PlayerChange])
    if (side === selectedCell?.teamSide && outId === selectedCell.playerId && kind !== 'position') {
      setSelectedCell({ ...selectedCell, playerId: inId, playerName: incoming.first_name + ' ' + incoming.last_name })
      setMatchup(null)
      const pitcher = currentPitcher(fieldingSide(side))
      if (pitcher) void loadMatchup(supabase, inId, pitcher.id, pitcher.first_name + ' ' + pitcher.last_name).then(setMatchup)
    }
    if (newPitcher) {
      await fetchGamePitchers()
      if (selectedCell && side !== selectedCell.teamSide) {
        setMatchup(null)
        const p = (side === 'home' ? ourRoster : opponentRoster).find(p => p.id === newPitcher)
        if (p) void loadMatchup(supabase, selectedCell.playerId, p.id, p.first_name + ' ' + p.last_name).then(setMatchup)
      }
    }
  }

  async function saveScorebook() {
    if (!confirm('Are you sure you want to save and lock the scorebook? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('games')
        .update({ game_status: 'completed' })
        .eq('id', game.id)
      
      if (error) {
        console.error('Error updating game status:', error)
        alert('Error saving scorebook')
        return
      }
      
      setIsLocked(true)
      alert('Scorebook saved and locked! All data is now read-only.')
    } catch (err) {
      console.error('Failed to save scorebook:', err)
      alert('Error saving scorebook')
    }
  }

  async function recalculateScore() {
    const allAtBats = await supabase.from('at_bats').select('runs_scored, team_side').eq('game_id', game.id)
    if (allAtBats.error) throw new Error('Play saved, but score refresh failed: ' + allAtBats.error.message)
    if (!allAtBats.data) throw new Error('Could not refresh the score.')
    const ours = allAtBats.data.filter((ab) => ab.team_side !== 'opponent').reduce((sum, ab) => sum + (ab.runs_scored || 0), 0)
    const theirs = allAtBats.data.filter((ab) => ab.team_side === 'opponent').reduce((sum, ab) => sum + (ab.runs_scored || 0), 0)
    const { data: updatedGame, error } = await supabase
      .from('games')
      .update({ our_score: ours, opponent_score: theirs, updated_at: new Date().toISOString() })
      .eq('id', game.id)
      .select()
    if (error) throw new Error('Play saved, but scoreboard update failed: ' + error.message)
    if (updatedGame && updatedGame[0]) setCurrentGame(updatedGame[0])
  }

  /**
   * A runner play during the current at-bat (stolen base, caught stealing, pickoff,
   * wild pitch, passed ball, balk): saved on its own, and the runner moves or is
   * retired in their own box right away.
   */
  async function recordRunnerEvent(ev: RunnerEventInput) {
    if (!selectedCell || !canScoreCell(selectedCell, getCurrentBatter(), isLocked)) {
      throw new Error(uiLang === 'es' ? 'Este turno ya terminó. Cierra y selecciona el turno verde.' : 'This at-bat has ended. Close and select the green at-bat.')
    }
    const teamSide = selectedCell?.teamSide || currentTeamSide || 'home'
    const runnerRow = atBats.find((ab) => ab.id === ev.runnerAtBatId)
    if (!runnerRow) return
    const pitcher = currentPitcher(fieldingSide(teamSide))
    const batterAtBat = selectedCell ? getAtBatForPlayer(selectedCell.playerId, selectedCell.inning) : null
    const { error: evError } = await supabase.from('runner_events').insert([
      {
        game_id: game.id,
        team_side: teamSide,
        inning: runnerRow.inning,
        runner_at_bat_id: ev.runnerAtBatId,
        runner_player_id: ev.runnerPlayerId ?? runnerRow.player_id,
        during_at_bat_id: batterAtBat?.id ?? null,
        batter_player_id: selectedCell?.playerId ?? null,
        pitcher_id: pitcher?.id ?? null,
        event_type: ev.type,
        from_base: ev.fromBase,
        to_base: ev.type === 'PK' ? null : ev.toBase,
        is_out: ev.isOut,
        throw: ev.throw ?? null,
        fielders: ev.fielders ?? null,
        entered_via: ev.enteredVia,
      },
    ])
    if (evError) {
      throw new Error('Could not save the runner play: ' + evError.message)
    }
    await fetchRunnerHistory()
    const patch = applyRunnerEvent(runnerRow, ev)
    const { error } = await supabase.from('at_bats').update(patch).eq('id', ev.runnerAtBatId)
    if (error) {
      throw new Error('Could not update the runner: ' + error.message)
    }
    setAtBats((prev) => prev.map((ab) => (ab.id === ev.runnerAtBatId ? { ...ab, ...patch } : ab)))
    const inningOuts = atBats
      .filter(ab => (ab.team_side || 'home') === teamSide && ab.inning === runnerRow.inning)
      .reduce((total, ab) => total + playerOuts(ab.id === ev.runnerAtBatId ? { ...ab, ...patch } : ab), 0)
    if (ev.isOut && inningOuts >= 3) {
      // The runner ended the inning between pitches; the batter has no completed at-bat.
      setShowCanvasModal(false)
      setSelectedCell(null)
      setSelectedAtBatId(null)
      setPendingCell(null)
      setSaveNotice(uiLang === 'es' ? 'Tres outs. Entrada terminada.' : 'Three outs. Inning over.')
      if (paperMode) setCurrentTeamSide(fieldingSide(teamSide))
      setGuideRequest(value => value + 1)
    }
    if (ev.toBase === 'home' && !ev.isOut) await recalculateScore()
  }

  async function saveAtBat(notation: string, baseRunners?: { first: boolean, second: boolean, third: boolean, home: boolean }, fieldLocationData?: Record<string, unknown>, baseRunnerOuts?: { first: boolean, second: boolean, third: boolean, home: boolean }, baseRunnerOutTypes?: { first: string, second: string, third: string, home: string }, rbi?: number, runnerUpdates?: RunnerUpdate[]) {
    if (!selectedCell || saveInFlight.current || isLocked) return
    // A saved id is retained only to retry a partially saved play in this still-open editor.
    if (!selectedAtBatId && !canScoreCell(selectedCell, getCurrentBatter(), isLocked)) {
      throw new Error(uiLang === 'es' ? 'Este turno ya terminó. Cierra y selecciona el turno verde.' : 'This at-bat has ended. Close and select the green at-bat.')
    }
    const normalized = savedPlay(notation, baseRunners, baseRunnerOuts)
    const play = scoringPlay(notation)!
    const runnerOuts = (runnerUpdates || []).filter(u => u.move === 'out').length
    if (play.outs > 1 && runnerOuts !== play.outs - 1) throw new Error('Select the runners retired on this double or triple play.')
    if (play.outs > 1 && outsBefore(selectedCell.playerId, selectedCell.inning, currentTeamSide) + play.outs > 3) throw new Error('Not enough outs remain for this play.')
    saveInFlight.current = true
    const { result, runs_scored: runsScored } = normalized
    baseRunners = normalized.base_runners
    baseRunnerOuts = normalized.base_runner_outs
    const teamSide = selectedCell.teamSide || currentTeamSide || 'home'
    const pitcherOnRecord = currentPitcher(fieldingSide(teamSide))
    const landingX = typeof fieldLocationData?.xCoordinate === 'number' ? (fieldLocationData.xCoordinate as number) : null
    const landingY = typeof fieldLocationData?.yCoordinate === 'number' ? (fieldLocationData.yCoordinate as number) : null
    
    // Log the at-bat data when Save is clicked
    console.log('=== AT-BAT SAVED ===')
    console.log('Player:', selectedCell.playerName)
    console.log('Inning:', selectedCell.inning)
    console.log('Team Side:', teamSide)
    console.log('Notation:', notation)
    console.log('Result:', result)
    console.log('Base Runners:', baseRunners)
    console.log('Runs Scored:', runsScored)
    console.log('==================')
    
    try {
      // Check if this is an existing at-bat (for this team and inning)
      const existingAtBat = atBats.find(ab => ab.id === selectedAtBatId)
      let savedBatterId = selectedAtBatId
      
      if (existingAtBat) {
        // Update existing at-bat
        console.log('Updating existing at-bat:', existingAtBat.id)
        
        
          const updateData = {
            notation: notation, // Save original notation
            result: result,
            runs_scored: runsScored,
            team_side: teamSide,
            base_runners: baseRunners || { first: false, second: false, third: false, home: false },
            base_runner_outs: baseRunnerOuts || { first: false, second: false, third: false, home: false },
            out_type: baseRunnerOutTypes ? Object.values(baseRunnerOutTypes).find(type => type !== '') || '' : '',
            pitcher_id: pitcherOnRecord?.id ?? null,
            hit_x: landingX,
            hit_y: landingY,
            field_area: fieldLocationData?.fieldArea || '',
            field_zone: fieldLocationData?.fieldZone || '',
            hit_distance: fieldLocationData?.hitDistance || '',
            hit_angle: fieldLocationData?.hitAngle || '',
            rbi: rbi || 0
          }
        
        const { data, error } = await supabase
          .from('at_bats')
          .update(updateData)
          .eq('id', existingAtBat.id)
          .select(`
            *,
            players (
              first_name,
              last_name,
              jersey_number
            )
          `)
        
          if (error) {
            console.error('Error updating at-bat:', error)
            console.error('Full error details:', JSON.stringify(error, null, 2))
            throw new Error(error.message)
          }
        
        // Update the local state
        setAtBats(prev => prev.map(ab => 
          ab.id === existingAtBat.id ? { ...ab, ...updateData } : ab
        ))
        
        console.log('At-bat successfully updated:', data[0])
        

      } else {
        // Create new at-bat
        console.log('Creating new at-bat')
        
          const insertData: {
            game_id: string
            player_id: string
            inning: number
            at_bat_number: number
            notation: string
            result: string
            rbi: number
            runs_scored: number
            stolen_bases: number
            base_runners: { first: boolean; second: boolean; third: boolean; home: boolean }
            base_runner_outs?: { first: boolean; second: boolean; third: boolean; home: boolean }
            out_type?: string
            field_area?: string
            field_zone?: string
            hit_distance?: string
            hit_angle?: string
            x_coordinate?: number
            y_coordinate?: number
            team_side: 'home' | 'opponent'
            pitcher_id?: string | null
            hit_x?: number | null
            hit_y?: number | null
          } = {
            ...atBatIdentity(game.id, selectedCell),
            notation: notation, // Save original notation
            result: result,
            rbi: rbi || 0,
            runs_scored: runsScored,
            stolen_bases: 0,
            base_runners: baseRunners || { first: false, second: false, third: false, home: false },
            base_runner_outs: baseRunnerOuts || { first: false, second: false, third: false, home: false },
            out_type: baseRunnerOutTypes ? Object.values(baseRunnerOutTypes).find(type => type !== '') || '' : '',
            pitcher_id: pitcherOnRecord?.id ?? null,
            hit_x: landingX,
            hit_y: landingY,
            field_area: (fieldLocationData?.fieldArea ? String(fieldLocationData.fieldArea) : ''),
            field_zone: (fieldLocationData?.fieldZone ? String(fieldLocationData.fieldZone) : ''),
            hit_distance: (fieldLocationData?.hitDistance ? String(fieldLocationData.hitDistance) : ''),
            hit_angle: (fieldLocationData?.hitAngle ? String(fieldLocationData.hitAngle) : '')
          }
        
        const { data, error } = await supabase.from('at_bats').insert([insertData]).select('*, players(first_name,last_name,jersey_number)').single()
        if (error) throw new Error(error.message)
        setAtBats(prev => [...prev, data])
        setSelectedAtBatId(data.id)
        savedBatterId = data.id
      }

      for (const u of runnerUpdates || []) {
        if (u.move === 'stay') continue
        const runnerRow = atBats.find(row => row.id === u.atBatId)
        const fromBase = runnerRow ? runnerBaseOf(runnerRow) : null
        if (savedBatterId && runnerRow) {
          // Reuse the event on a partially failed save; do not duplicate the sequence.
          const { data: previousEvent, error: historyReadError } = await supabase.from('runner_events').select('id,from_base').eq('runner_at_bat_id', u.atBatId).eq('during_at_bat_id', savedBatterId).eq('event_type', 'ADV').maybeSingle()
          if (historyReadError) throw new Error('Could not load runner history: ' + historyReadError.message)
          const originalBase = previousEvent?.from_base || fromBase
          if (originalBase) {
            const { error: historySaveError } = await supabase.from('runner_events').upsert({
              id: previousEvent?.id || crypto.randomUUID(), game_id: game.id, team_side: teamSide,
              inning: selectedCell.inning, runner_at_bat_id: u.atBatId, runner_player_id: runnerRow.player_id,
              during_at_bat_id: savedBatterId, batter_player_id: selectedCell.playerId,
              pitcher_id: pitcherOnRecord?.id || null, event_type: 'ADV', from_base: originalBase,
              to_base: u.move === 'out' ? null : u.move, is_out: u.move === 'out',
              fielders: /^([1-9]-)+[1-9]$/.test(notation) ? notation : null, entered_via: 'classic',
            })
            if (historySaveError) throw new Error('Could not save runner history: ' + historySaveError.message)
          }
        }
        const patch = { base_runners: u.base_runners, base_runner_outs: u.base_runner_outs, out_type: u.out_type, runs_scored: u.runs_scored }
        const { error } = await supabase.from('at_bats').update(patch).eq('id', u.atBatId).eq('game_id', game.id)
        if (error) {
          await fetchAtBats()
          throw new Error('Batter saved, but a runner update failed. Reopen this play and check the runners: ' + error.message)
        }
        setAtBats(prev => prev.map(ab => ab.id === u.atBatId ? { ...ab, ...patch } : ab))
      }

      await recalculateScore()
      if (paperMode) {
        const savedInning = await supabase.from('at_bats').select('result,base_runner_outs,team_side').eq('game_id',game.id).eq('inning',selectedCell.inning)
        if (!savedInning.error && (savedInning.data || []).filter(row=>(row.team_side || 'home')===teamSide).reduce((n,row)=>n+playerOuts(row),0)>=3) setCurrentTeamSide(fieldingSide(teamSide))
      }

      // Close the modal after successful save
      setSaveNotice(selectedCell.playerName + ' · ' + notation.toUpperCase() + ' · ' + (uiLang === 'es' ? 'Guardado' : 'Saved'))
      await fetchRunnerHistory()
      setShowCanvasModal(false)
      setSelectedCell(null)
      setSelectedAtBatId(null)
      setPendingCell(null)
      setGuideRequest(value => value + 1)
    } catch (err) {
      throw err
    } finally {
      saveInFlight.current = false
    }
  }

  if (loading || changesLoading) {
    return <LoadingState label="Loading scorebook..." />
  }

  const scoreboardBatter = getCurrentBatter()
  const nextBatterPlayer = displayedLineup.find(player => player.id === scoreboardBatter?.playerId)
  const scoreboardInning = scoreboardBatter?.inning || 1
  const scoreboardOuts = Math.min(3, atBats.filter(ab => ab.inning === scoreboardInning && (ab.team_side || 'home') === currentTeamSide).reduce((sum, ab) => sum + playerOuts(ab), 0))
  const scoreboardRunners = isLocked || scoreboardOuts >= 3 ? [] : getActiveRunners(null, scoreboardInning, currentTeamSide)

  const scoringEditor = showCanvasModal && selectedCell ? (
        <DiamondCanvas
          key={game.id + ':' + selectedCell.teamSide + ':' + selectedCell.playerId + ':' + selectedCell.inning + ':' + selectedCell.appearance}
          embedded={paperMode}
          paperBox={paperMode ? { gameId: game.id, side: selectedCell.teamSide || currentTeamSide, slot: (selectedCell.teamSide === 'opponent' ? opponentPlayers : players).findIndex(p=>p.id===selectedCell.playerId)+1, inning:selectedCell.inning, appearance:selectedCell.appearance, playerId:selectedCell.playerId, session:gamePitchers.find(p=>p.team_side===fieldingSide(selectedCell.teamSide || currentTeamSide))?.id } : undefined}
          onSave={(notation, baseRunners, fieldLocationData, baseRunnerOuts, baseRunnerOutTypes, rbi, runnerUpdates) => {
            return saveAtBat(notation, baseRunners, fieldLocationData, baseRunnerOuts, baseRunnerOutTypes, rbi, runnerUpdates)
          }}
          activeRunners={getActiveRunners(selectedCell.playerId, selectedCell.inning, selectedCell.teamSide || currentTeamSide)}
          matchup={matchup}
          batterHistory={{
            gameId: game.id,
            batterId: selectedCell.playerId,
            pitcherId: currentPitcher(fieldingSide(selectedCell.teamSide || currentTeamSide))?.id ?? null,
            pitcherName: (() => { const p = currentPitcher(fieldingSide(selectedCell.teamSide || currentTeamSide)); return p ? p.first_name + ' ' + p.last_name : '' })(),
            gameLine: battingLine(atBats.filter(ab => ab.player_id === selectedCell.playerId)).label,
          }}
          outsBefore={outsBefore(selectedCell.playerId, selectedCell.inning, selectedCell.teamSide || currentTeamSide)}
          onRunnerEvent={recordRunnerEvent}
          onChangePlayer={selectedAtBatId ? undefined : kind => openPlayerChange(kind)}
          onClose={() => {
            setShowCanvasModal(false)
            setSelectedCell(null)
          }}
          playerName={selectedCell.playerName}
          inning={selectedCell.inning}
          existingAtBat={atBats.find(ab => ab.id === selectedAtBatId) as unknown as Record<string, unknown>}
          isLocked={isLocked || !!changesError}
        />
      ) : null

  return (
    <div className={paperMode ? 'paper-scorebook mx-auto max-w-7xl space-y-4 rounded-sm border border-stone-300 bg-[#faf7ed] p-3 sm:p-5' : 'mx-auto max-w-7xl space-y-6'}>
      <div className="flex items-center justify-between gap-3 border-b border-stone-400 pb-3">
        <div><p className="font-serif text-2xl tracking-wide">{uiLang==='es' ? 'Libro de anotación' : 'Scorebook'}</p><p className="text-xs text-stone-600">{uiLang==='es' ? 'Escribe la jugada. El libro lleva la cuenta.' : 'Write the play. The book keeps the totals.'}</p></div>
        <button type="button" disabled={showCanvasModal} onClick={()=>setPaperMode(!paperMode)} className="min-h-11 border-b border-stone-500 px-3 text-sm disabled:opacity-40">{paperMode ? (uiLang==='es' ? 'Vista guiada' : 'Guided view') : (uiLang==='es' ? 'Vista de papel' : 'Paper view')}</button>
      </div>
      {/* Game Information Header */}
      <div className="space-y-4">
        {paperMode ? <PaperScoreHeader home={homeTeamName} opponent={game.opponent} rows={atBats} inning={scoreboardInning} outs={scoreboardOuts} side={currentTeamSide} language={uiLang} /> : <Scoreboard home={homeTeamName} away={game.opponent} homeScore={currentGame.our_score} awayScore={currentGame.opponent_score}
          inning={scoreboardInning} outs={scoreboardOuts} runners={scoreboardRunners} battingTeam={currentTeamSide === 'home' ? homeTeamName : game.opponent}
          half={currentGame.batting_first ? (currentTeamSide === currentGame.batting_first ? 'top' : 'bottom') : undefined}
          batter={(currentTeamSide === 'home' ? players : opponentPlayers).find(p => p.id === scoreboardBatter?.playerId)?.first_name}
          language={uiLang} status={isLocked ? (uiLang === 'es' ? 'Final' : 'Final') : undefined} />}
        {saveNotice && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-900">✓ {saveNotice}</div>}

        {/* Team Switcher - Voltear Hoja Button */}
        <div className={paperMode ? "flex justify-end border-b border-stone-300 py-1" : "flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 p-3"}>
          <Button
            variant={paperMode ? "outline" : "success"}
            size="lg"
            onClick={() => setCurrentTeamSide(currentTeamSide === 'home' ? 'opponent' : 'home')}
            className="[&_svg]:size-5"
            disabled={showCanvasModal}
            title="Voltear Hoja - Cambiar de equipo"
          >
            <ArrowLeftRight />
            <span className="text-lg">Voltear Hoja</span>
          </Button>
        </div>

        {/* Pitcher on the mound for the fielding side: every at-bat is recorded against them */}
        {(() => {
          const side = fieldingSide(currentTeamSide)
          const p = currentPitcher(side)
          const teamName = side === 'home' ? homeTeamName : game.opponent
          const appearances = gamePitchers.filter((g) => g.team_side === side).length
          const es = uiLang === 'es'
          return (
            <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${p ? 'border-border bg-card' : 'border-amber-300 bg-amber-50'}`}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                {p?.jersey_number ?? 'P'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {es ? 'Pitcher en la loma' : 'Pitcher on the mound'} · {teamName}
                </div>
                <div className="truncate text-sm font-semibold">
                  {pitchersLoading ? (es ? 'Preparando pitcher…' : 'Preparing pitcher…') : p ? `${p.first_name} ${p.last_name}` : es ? 'Sin pitcher registrado' : 'No pitcher set yet'}
                  {pitchersError && <p role="alert" className="text-rose-700">{pitchersError}</p>}
                </div>
                {appearances > 1 && (
                  <div className="text-xs text-muted-foreground">
                    {es ? `Pitcher #${appearances} del juego` : `Pitcher #${appearances} of the game`}
                  </div>
                )}
              </div>
              {!isLocked && (
                <Button variant={p ? 'outline' : 'warning'} size="sm" disabled={pitchersLoading || !!pitchersError} onClick={() => setPitcherPicker({ side, reason: p ? 'change' : 'start' })}>
                  {p ? (es ? 'Cambio de pitcher' : 'Pitching change') : es ? 'Elegir pitcher' : 'Choose pitcher'}
                </Button>
              )}
            </div>
          )
        })()}
        
        <div style={{display: 'none'}} className="grid grid-cols-6 gap-4 text-sm">
          <FormField label="Date:">
            <Input
              type="date"
              value={gameInfo.date}
              onChange={(e) => setGameInfo({...gameInfo, date: e.target.value})}
            />
          </FormField>
          <FormField label="Start Time:">
            <Input
              type="time"
              value={gameInfo.startTime}
              onChange={(e) => setGameInfo({...gameInfo, startTime: e.target.value})}
            />
          </FormField>
          <FormField label="Field:">
            <Input
              type="text"
              value={gameInfo.field}
              onChange={(e) => setGameInfo({...gameInfo, field: e.target.value})}
            />
          </FormField>
          <FormField label="Length:">
            <Input
              type="text"
              value={gameInfo.length}
              onChange={(e) => setGameInfo({...gameInfo, length: e.target.value})}
            />
          </FormField>
          <FormField label="Umpire:">
            <Input
              type="text"
              value={gameInfo.umpire}
              onChange={(e) => setGameInfo({...gameInfo, umpire: e.target.value})}
            />
          </FormField>
          <div className="flex items-end">
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums">
                {game.our_score} - {game.opponent_score}
              </div>
              <div className="text-sm text-muted-foreground">Score</div>
            </div>
          </div>
        </div>
      </div>

      {!isLocked && <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => openPlayerChange('defensive')}>{uiLang === 'es' ? 'Cambio defensivo' : 'Defensive replacement'}</Button>
        <Button variant="outline" onClick={() => openPlayerChange('position')}>{uiLang === 'es' ? 'Cambiar posición defensiva' : 'Change fielding position'}</Button>
      </div>}
      {changesError && <p role="alert" className="text-sm text-amber-800">{uiLang === 'es' ? 'Cambios de jugadores no disponibles: ' : 'Player changes unavailable: '}{changesError}</p>}
      {/* Scorebook Grid */}
      {!isLocked && scoreboardBatter && nextBatterPlayer && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-emerald-950">
        <p className="text-sm"><span className="font-bold">{uiLang === 'es' ? 'Siguiente al bate: ' : 'Next to bat: '}{nextBatterPlayer.first_name} {nextBatterPlayer.last_name}</span> · {uiLang === 'es' ? 'Entrada' : 'Inning'} {scoreboardBatter.inning} · {uiLang === 'es' ? 'Turno' : 'Appearance'} {scoreboardBatter.appearance}
          <span className="block text-xs">{uiLang === 'es' ? 'Toca la casilla marcada para escribir.' : 'Tap the marked box to write.'}</span>
        </p>
        <button type="button" onClick={guideToNextBatter} className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-bold text-white">{uiLang === 'es' ? 'Mostrar siguiente ↓' : 'Show next ↓'}</button>
      </div>}
      <p className="text-xs text-slate-600">{uiLang === 'es' ? 'Toca un turno guardado para verlo sin editar. SB = robo · CS = out robando · ADV = avance · * detalle no registrado.' : 'Tap a saved at-bat to view without editing. SB = steal · CS = caught stealing · ADV = advance · * detail not recorded.'}</p>
      {historyError && <p role="alert" className="text-sm text-amber-800">{uiLang === 'es' ? 'No se pudo cargar el historial de corredores; se muestra el resultado guardado.' : 'Runner history could not be loaded; showing saved results.'}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card scrollbar-thin">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-20 w-8 min-w-8 max-w-8 bg-slate-50 border-r border-border px-2 py-2 font-semibold">#</th>
              <th className="sticky left-8 z-20 bg-slate-50 shadow-[2px_0_3px_#00000015] border-r border-border px-2 py-2 text-left font-semibold whitespace-nowrap">Batter</th>
              <th className="w-6 border-r border-border px-1 py-2"></th>
              {getInningColumns().map((col, i) => (
                <th key={`inning-${i}`} className="w-16 border-r border-border px-1 py-2 text-center font-semibold tabular-nums">
                  {col.inning}
                </th>
              ))}
              <th className="w-8 border-r border-border px-1 py-2 text-center font-semibold">H</th>
              <th className="w-8 border-r border-border px-1 py-2 text-center font-semibold">BB</th>
              <th className="w-8 border-r border-border px-1 py-2 text-center font-semibold">R</th>
              <th className="w-8 border-r border-border px-1 py-2 text-center font-semibold">RBI</th>
              <th className="w-8 px-1 py-2 text-center font-semibold">E</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 9 }, (_, rowIndex) => {
              const activePlayers = currentTeamSide === 'home' ? players : opponentPlayers
              const player = activePlayers[rowIndex]
              const stats = player ? getPlayerStats(player.id) : { hits: 0, walks: 0, runs: 0, rbi: 0, errors: 0 }
              
              return (
                <Fragment key={rowIndex}><tr className="h-12 border-t border-border hover:bg-slate-50/60">
                  {/* Jersey Number */}
                  <td className="sticky left-0 z-10 w-8 min-w-8 max-w-8 bg-white border-r border-b border-border px-2 py-1 text-center font-medium tabular-nums text-muted-foreground">
                    {player ? player.jersey_number : ''}
                  </td>
                  
                  {/* Player Name */}
                  <td className="sticky left-8 z-10 max-w-[42vw] bg-white shadow-[2px_0_3px_#00000015] border-r border-b border-border px-2 py-1 font-medium">
                    {player && <button type="button" disabled={isLocked} onClick={() => openPlayerChange('defensive', player.id, currentTeamSide)} className="min-h-11 max-w-[40vw] break-words text-left underline decoration-dotted underline-offset-4">{player.first_name} {player.last_name} · {player.positions[0]}</button>}
                    {player && player.members.length > 1 && <div className="text-[10px] text-slate-500">{player.members.slice(0, -1).map(id => [...initialPlayers, ...initialOpponentPlayers, ...ourRoster, ...opponentRoster].find(p => p.id === id)?.last_name).join(' → ')}</div>}
                  </td>
                  
                  {/* Diagonal Line Column */}
                  <td className="relative border-r border-border px-1 py-1">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-px bg-slate-300 transform rotate-45"></div>
                    </div>
                  </td>
                  
                  {/* Inning Columns with Diamond Grids */}
                  {getInningColumns().map((col, inningIndex) => {
                    const atBat = player ? getAtBatForPlayerNth(player.id, col.inning, col.appearance) : null
                    const cell = player ? { playerId: player.id, playerName: `${player.first_name} ${player.last_name}`, inning: col.inning, appearance: col.appearance, teamSide: currentTeamSide } : null
                    const isCurrentBatter = !!cell && !atBat && canScoreCell(cell, scoreboardBatter, isLocked || !!changesError || pitchersLoading || !!pitchersError)

                    return (
                      <td key={inningIndex} className={`relative border-r border-border px-1 py-1 ${isCurrentBatter ? 'bg-emerald-50' : 'bg-slate-100/80'}`}>
                        <button
                          type="button"
                          ref={isCurrentBatter ? nextBatterButton : undefined}
                          disabled={!isCurrentBatter && !atBat}
                          aria-current={isCurrentBatter ? 'step' : undefined}
                          aria-label={`${cell?.playerName || (uiLang === 'es' ? 'Sin jugador' : 'Empty lineup spot')} · ${uiLang === 'es' ? 'Entrada' : 'Inning'} ${col.inning} · ${uiLang === 'es' ? 'Turno' : 'Appearance'} ${col.appearance} · ${isCurrentBatter ? (uiLang === 'es' ? 'Anotar turno actual' : 'Score current at-bat') : (atBat ? (uiLang === 'es' ? 'Ver turno guardado · Solo lectura' : 'View saved at-bat · Read only') : (uiLang === 'es' ? 'Bloqueado' : 'Locked'))}`}
                          className={`flex flex-col min-h-11 min-w-11 w-full items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${isCurrentBatter ? 'cursor-pointer bg-emerald-100 ring-2 ring-inset ring-emerald-500 hover:bg-emerald-200 active:bg-emerald-300' : atBat ? 'cursor-pointer hover:bg-slate-200' : 'cursor-not-allowed'}`}
                          onClick={() => { if (atBat) setViewedAtBat(atBats.find(row => row.id === atBat.id) || atBat); else if (isCurrentBatter && cell) handleCellClick(cell) }}
                        >
                          {atBat && player && atBat.player_id !== player.id && <span className="sr-only">{atBat.players?.first_name} {atBat.players?.last_name}</span>}
                          {isCurrentBatter && <span className="whitespace-nowrap px-1 text-[10px] font-black text-emerald-950">↓ {uiLang === 'es' ? 'SIGUIENTE' : 'NEXT'}</span>}
                          <>{atBat ? <ScorecardPlayHistory play={atBat} events={historyByAtBat.get(atBat.id) || []} /> : <ScorebookDiamond current={isCurrentBatter} />}</>
                        </button>
                      </td>
                    )
                  })}
                  
                  {/* Summary Statistics */}
                  <td className="border-r border-border px-1 py-1 text-center font-bold tabular-nums last:border-r-0">
                    {stats.hits}
                  </td>
                  <td className="border-r border-border px-1 py-1 text-center font-bold tabular-nums last:border-r-0">
                    {stats.walks}
                  </td>
                  <td className="border-r border-border px-1 py-1 text-center font-bold tabular-nums last:border-r-0">
                    {stats.runs}
                  </td>
                  <td className="border-r border-border px-1 py-1 text-center font-bold tabular-nums last:border-r-0">
                    {stats.rbi}
                  </td>
                  <td className="border-r border-border px-1 py-1 text-center font-bold tabular-nums last:border-r-0">
                    {stats.errors}
                  </td>
                </tr>
                {paperMode && selectedCell && showCanvasModal && player?.id===selectedCell.playerId && currentTeamSide===(selectedCell.teamSide || 'home') && <tr><td colSpan={getInningColumns().length+8} className="border-y-2 border-stone-400 p-0"><div ref={paperEditorRef} className="max-w-[calc(100vw-3rem)] scroll-mt-24 text-left">{scoringEditor}</div></td></tr>}
                {paperMode && viewedAtBat && player?.members.includes(viewedAtBat.player_id) && (viewedAtBat.team_side || 'home')===currentTeamSide && <tr><td colSpan={getInningColumns().length+8} className="border-y border-stone-400 bg-[#fffdf5] p-4 text-left"><div className="max-w-sm"><div className="flex items-center justify-between"><p className="font-serif text-lg">{viewedAtBat.players?.first_name} {viewedAtBat.players?.last_name} · {uiLang==='es' ? 'Solo lectura' : 'View only'}</p><button type="button" className="min-h-11 px-3 underline" onClick={()=>setViewedAtBat(null)}>{uiLang==='es' ? 'Cerrar' : 'Close'}</button></div><ScorecardPlayHistory play={viewedAtBat} events={historyByAtBat.get(viewedAtBat.id) || []} large /><SavedPaperInk box={{gameId:game.id,side:currentTeamSide,slot:rowIndex+1,inning:viewedAtBat.inning,appearance:viewedAtBat.at_bat_number || 1,playerId:viewedAtBat.player_id,session:gamePitchers.find(p=>p.team_side===fieldingSide(currentTeamSide))?.id}} language={uiLang} /><p className="text-xs">{uiLang==='es' ? '* Detalle histórico no registrado.' : '* Historical detail not recorded.'}</p></div></td></tr>}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <details className="space-y-4 border-t border-stone-300 pt-3"><summary className="cursor-pointer font-serif">{uiLang==='es' ? 'Opciones del juego' : 'Game options'}</summary>
        <div className="text-sm text-muted-foreground">
          {isLocked ? (
            <p className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-800">
              <Lock className="size-4 shrink-0" aria-hidden="true" />
              Scorebook LOCKED - View only mode
            </p>
          ) : (
            <div className="space-y-1">
              <p>{uiLang === 'es' ? '• Anota en el turno marcado.' : '• Write in the marked at-bat.'}</p>
              <p>• Draw notation with finger or stylus (K, 6-3, arrows, etc.)</p>
              <p>• Summary columns auto-calculate totals</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 items-stretch sm:flex-row sm:justify-end sm:gap-3">
          {!isLocked && (
            <Button
              variant="success"
              onClick={saveScorebook}
              className="w-full sm:w-auto"
            >
              <Save />
              {uiLang==='es' ? 'Finalizar y cerrar el juego' : 'Finish and lock game'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Close Scorebook
          </Button>
        </div>
      </details>

      {/* Who is pitching (required before the first at-bat of a side; also for pitching changes) */}
      {pitcherPicker && (
        <PitcherPicker
          teamName={pitcherPicker.side === 'home' ? homeTeamName : game.opponent}
          roster={pitcherPicker.side === 'home' ? ourRoster : opponentRoster}
          currentPitcherId={currentPitcher(pitcherPicker.side)?.id ?? null}
          inning={currentInningFor(pitcherPicker.side)}
          reason={pitcherPicker.reason}
          onPick={(p) => pickPitcher(pitcherPicker.side, p)}
          onClose={() => {
            setPitcherPicker(null)
            setPendingCell(null)
          }}
        />
      )}

      <div className="my-4">
        <Link className="inline-block rounded-lg border border-border px-4 py-3 font-semibold" href={`/live/${game.id}/faceoff`}>
          {uiLang === 'es' ? 'Abrir scorecard de dos mánagers' : 'Open two-manager scorecard'}
        </Link>
      </div>

      {!paperMode && viewedAtBat && <Modal title={uiLang === 'es' ? 'Turno guardado · Solo lectura' : 'Saved at-bat · View only'} onClose={() => setViewedAtBat(null)} size="sm">
        <p className="mb-3 font-semibold">{viewedAtBat.players?.first_name} {viewedAtBat.players?.last_name} · {uiLang === 'es' ? 'Entrada' : 'Inning'} {viewedAtBat.inning} · {uiLang === 'es' ? 'Turno' : 'Appearance'} {viewedAtBat.at_bat_number}</p>
        <ScorecardPlayHistory play={viewedAtBat} events={historyByAtBat.get(viewedAtBat.id) || []} large />
        <p className="mt-3 text-sm text-slate-600">{uiLang === 'es' ? '* El estado final está guardado, pero faltan detalles del avance o del out.' : '* The final state is saved, but advance or out details are unavailable.'}</p>
        {historyError && <p role="alert">{uiLang === 'es' ? 'No se pudo cargar el historial de corredores.' : 'Runner history could not be loaded.'}</p>}
      </Modal>}
      {/* Canvas Drawing Modal */}
      {!paperMode && scoringEditor}

      {changePicker && <PlayerChangeModal
        kind={changePicker.kind} language={uiLang} initialOutId={changePicker.outId}
        lineup={(changePicker.side === 'home' ? players : opponentPlayers).filter(p => changePicker.kind === 'pinch_hitter' ? p.id === getCurrentBatter()?.playerId : changePicker.kind === 'pinch_runner' ? getActiveRunners(null, getCurrentBatter()?.inning || 1, changePicker.side).some(r => r.playerId === p.id) : true)}
        roster={(changePicker.side === 'home' ? ourRoster : opponentRoster).filter(p => !(changePicker.side === 'home' ? players : opponentPlayers).some(slot => slot.members.includes(p.id)))}
        onSave={savePlayerChange} onClose={() => setChangePicker(null)}
      />}
      {/* Opponent Lineup Entry Modal */}
      {showOpponentLineupModal && (
        <OpponentLineupEntry
          gameId={game.id}
          opponentName={game.opponent}
          onClose={async () => {
            setShowOpponentLineupModal(false)
            // Refresh players to get opponent lineup (but don't check for opponent lineup again)
            await fetchPlayers()
            // After saving opponent lineup, ask about home/away team
            // Use a small delay to ensure state is updated
            setTimeout(() => {
              setHomeAwayChecked(true)
              setShowHomeAwayModal(true)
            }, 300)
          }}
        />
      )}

      {/* Home/Away Team Selection Modal */}
      {showHomeAwayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-150" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-150">
            <h3 className="mb-2 text-center text-xl font-semibold tracking-tight">
              ¿Quién batea primero?
            </h3>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Selecciona el equipo que batea primero
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="destructive"
                size="lg"
                onClick={async () => {
                  // Opponent bats first
                  setCurrentTeamSide('opponent')
                  setCurrentGame(prev => ({ ...prev, batting_first: 'opponent' }))
                  setHomeAwayChecked(true)
                  setShowHomeAwayModal(false)
                  
                  // Save to database
                  const { error } = await supabase
                    .from('games')
                    .update({ batting_first: 'opponent' })
                    .eq('id', game.id)
                  
                  if (error) {
                    console.error('Error saving batting_first selection:', error)
                  }
                }}
                className="h-14 text-lg font-semibold"
              >
                {game.opponent}
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={async () => {
                  // Home team (Dodgers) bats first
                  setCurrentTeamSide('home')
                  setCurrentGame(prev => ({ ...prev, batting_first: 'home' }))
                  setHomeAwayChecked(true)
                  setShowHomeAwayModal(false)
                  
                  // Save to database
                  const { error } = await supabase
                    .from('games')
                    .update({ batting_first: 'home' })
                    .eq('id', game.id)
                  
                  if (error) {
                    console.error('Error saving batting_first selection:', error)
                  }
                }}
                className="h-14 text-lg font-semibold"
              >
                {homeTeamName}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
