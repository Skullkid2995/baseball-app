'use client'

import { useEffect, useRef, useState } from 'react'
import { playerOuts, savedPlay, scoringPlay } from '@/lib/scorecard/plays'
import { canScoreCell, inningColumns, nextAtBat, type AtBatCell } from '@/lib/scorecard/battingOrder'
import { atBatIdentity } from '@/lib/scorecard/atBatRecord'
import Scoreboard from './Scoreboard'
import ScorebookDiamond from './ScorebookDiamond'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import DiamondCanvas, { type ActiveRunner, type RunnerUpdate } from './DiamondCanvas'
import PitcherPicker, { type RosterPlayer } from './PitcherPicker'
import { loadMatchup, type MatchupSummary } from '@/lib/matchup'
import { applyRunnerEvent, type RunnerEventInput } from '@/lib/runnerEvents'
import OpponentLineupEntry from './OpponentLineupEntry'
import { ArrowLeftRight, Lock, Save } from 'lucide-react'
import { Button, FormField, Input, LoadingState } from '@/components/ui'

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
  const [selectedAtBatId, setSelectedAtBatId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [opponentPlayers, setOpponentPlayers] = useState<Player[]>([])
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
  const [pitcherPicker, setPitcherPicker] = useState<{ side: 'home' | 'opponent'; reason: 'start' | 'change' } | null>(null)
  const [pendingCell, setPendingCell] = useState<(AtBatCell & { playerName: string }) | null>(null)
  const [matchup, setMatchup] = useState<MatchupSummary | null>(null)

  useEffect(() => {
    fetchGamePitchers()
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
                return player as Player
              }
              return null
            })
            .filter((p): p is Player => p !== null)
          setPlayers(ourPlayers)
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
                return player as Player
              }
              return null
            })
            .filter((p): p is Player => p !== null)
          setOpponentPlayers(oppPlayers)
          console.log('Opponent players loaded:', oppPlayers.length, 'players')
        } else {
          console.log('No opponent lineup players found for template:', opponentTemplateId)
        }
      } else {
        console.log('No opponent lineup template found')
      }
    } catch (err) {
      console.error('Failed to fetch players:', err)
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
    if (error) console.error('game_pitchers load failed:', error.message)
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
    if (!canScoreCell(cell, getCurrentBatter(), isLocked)) return
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
      .filter(ab => ab.player_id === playerId && ab.inning === inning && (ab.team_side || 'home') === currentTeamSide)
      .sort((a, b) => (a.at_bat_number || 1) - (b.at_bat_number || 1))
    return matches[n - 1] || null
  }

  function getCurrentBatter() {
    const lineup = currentTeamSide === 'home' ? players : opponentPlayers
    return nextAtBat(lineup, atBats, currentTeamSide)
  }

  // Determine if we should add a duplicate column for the active inning
  function getInningColumns(): { inning: number; isDuplicate: boolean; appearance: number }[] {
    return inningColumns(currentTeamSide === 'home' ? players : opponentPlayers, atBats, currentTeamSide)
  }

  function getPlayerStats(playerId: string) {
    const playerAtBats = atBats.filter(ab => ab.player_id === playerId && (ab.team_side || 'home') === currentTeamSide)
    return {
      hits: playerAtBats.filter(ab => ['single', 'double', 'triple', 'home_run'].includes(ab.result)).length,
      walks: playerAtBats.filter(ab => ab.result === 'walk').length,
      runs: playerAtBats.reduce((sum, ab) => sum + (ab.runs_scored || 0), 0),
      rbi: playerAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0),
      errors: playerAtBats.filter(ab => ab.result === 'error').length
    }
  }

  /** Runners still on base for this inning and side; optionally exclude the batter being edited. */
  function getActiveRunners(playerId: string | null, inning: number, teamSide: 'home' | 'opponent'): ActiveRunner[] {
    const list: ActiveRunner[] = []
    const lineupIds = new Set((teamSide === 'home' ? players : opponentPlayers).map(p => p.id))
    for (const ab of atBats) {
      if (ab.inning !== inning || ab.player_id === playerId || !lineupIds.has(ab.player_id)) continue
      if (!(ab.team_side === teamSide || (!ab.team_side && teamSide === 'home'))) continue
      const b = ab.base_runners
      if (!b || b.home) continue
      const base: 'first' | 'second' | 'third' | null = b.third ? 'third' : b.second ? 'second' : b.first ? 'first' : null
      if (!base || playerOuts(ab)) continue
      const p = ab.players
      list.push({ atBatId: ab.id, playerId: ab.player_id, playerName: p ? `${p.first_name} ${p.last_name}` : 'Runner', base })
    }
    // third base first, so the list reads like the field
    const order = { third: 0, second: 1, first: 2 }
    return list.sort((a, b) => order[a.base] - order[b.base])
  }

  function handleCellClick(cell: AtBatCell & { playerName: string }) {
    if (!canScoreCell(cell, getCurrentBatter(), isLocked)) return
    const side = fieldingSide(currentTeamSide)
    // We must know who is pitching before scoring the current at-bat.
    if (!currentPitcher(side)) {
      setPendingCell(cell)
      setPitcherPicker({ side, reason: 'start' })
      return
    }
    openCell(cell)
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
        to_base: ev.isOut ? null : ev.toBase,
        is_out: ev.isOut,
        throw: ev.throw ?? null,
        fielders: ev.fielders ?? null,
        entered_via: ev.enteredVia,
      },
    ])
    if (evError) {
      throw new Error('Could not save the runner play: ' + evError.message)
    }
    const patch = applyRunnerEvent(runnerRow, ev)
    const { error } = await supabase.from('at_bats').update(patch).eq('id', ev.runnerAtBatId)
    if (error) {
      throw new Error('Could not update the runner: ' + error.message)
    }
    setAtBats((prev) => prev.map((ab) => (ab.id === ev.runnerAtBatId ? { ...ab, ...patch } : ab)))
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
      }

      for (const u of runnerUpdates || []) {
        if (u.move === 'stay') continue
        const patch = { base_runners: u.base_runners, base_runner_outs: u.base_runner_outs, out_type: u.out_type, runs_scored: u.runs_scored }
        const { error } = await supabase.from('at_bats').update(patch).eq('id', u.atBatId).eq('game_id', game.id)
        if (error) {
          await fetchAtBats()
          throw new Error('Batter saved, but a runner update failed. Reopen this play and check the runners: ' + error.message)
        }
        setAtBats(prev => prev.map(ab => ab.id === u.atBatId ? { ...ab, ...patch } : ab))
      }

      await recalculateScore()

      // Close the modal after successful save
      setSaveNotice(selectedCell.playerName + ' · ' + notation.toUpperCase() + ' · ' + (uiLang === 'es' ? 'Guardado' : 'Saved'))
      setShowCanvasModal(false)
      setSelectedCell(null)
    } catch (err) {
      throw err
    } finally {
      saveInFlight.current = false
    }
  }

  if (loading) {
    return <LoadingState label="Loading scorebook..." />
  }

  const scoreboardBatter = getCurrentBatter()
  const scoreboardInning = scoreboardBatter?.inning || 1
  const scoreboardOuts = Math.min(3, atBats.filter(ab => ab.inning === scoreboardInning && (ab.team_side || 'home') === currentTeamSide).reduce((sum, ab) => sum + playerOuts(ab), 0))
  const scoreboardRunners = isLocked || scoreboardOuts >= 3 ? [] : getActiveRunners(null, scoreboardInning, currentTeamSide)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Game Information Header */}
      <div className="space-y-4">
        <Scoreboard home={homeTeamName} away={game.opponent} homeScore={currentGame.our_score} awayScore={currentGame.opponent_score}
          inning={scoreboardInning} outs={scoreboardOuts} runners={scoreboardRunners} battingTeam={currentTeamSide === 'home' ? homeTeamName : game.opponent}
          half={currentGame.batting_first ? (currentTeamSide === currentGame.batting_first ? 'top' : 'bottom') : undefined}
          batter={(currentTeamSide === 'home' ? players : opponentPlayers).find(p => p.id === scoreboardBatter?.playerId)?.first_name}
          language={uiLang} status={isLocked ? (uiLang === 'es' ? 'Final' : 'Final') : undefined} />
        {saveNotice && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-900">✓ {saveNotice}</div>}

        {/* Team Switcher - Voltear Hoja Button */}
        <div className="flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 p-3">
          <Button
            variant="success"
            size="lg"
            onClick={() => setCurrentTeamSide(currentTeamSide === 'home' ? 'opponent' : 'home')}
            className="[&_svg]:size-5"
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
                  {p ? `${p.first_name} ${p.last_name}` : es ? 'Sin pitcher registrado' : 'No pitcher set yet'}
                </div>
                {appearances > 1 && (
                  <div className="text-xs text-muted-foreground">
                    {es ? `Pitcher #${appearances} del juego` : `Pitcher #${appearances} of the game`}
                  </div>
                )}
              </div>
              {!isLocked && (
                <Button variant={p ? 'outline' : 'warning'} size="sm" onClick={() => setPitcherPicker({ side, reason: p ? 'change' : 'start' })}>
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

      {/* Scorebook Grid */}
      {!isLocked && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
        <span className="size-3 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
        {uiLang === 'es' ? 'Toca el turno verde para anotar. Los demás turnos están bloqueados.' : 'Tap the green at-bat to score. All other at-bats are locked.'}
      </p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card scrollbar-thin">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8 border-r border-border px-2 py-2 font-semibold">#</th>
              <th className="border-r border-border px-2 py-2 text-left font-semibold whitespace-nowrap">Batter</th>
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
                <tr key={rowIndex} className="h-12 border-t border-border hover:bg-slate-50/60">
                  {/* Jersey Number */}
                  <td className="border-r border-border px-2 py-1 text-center font-medium tabular-nums text-muted-foreground">
                    {player ? player.jersey_number : ''}
                  </td>
                  
                  {/* Player Name */}
                  <td className="border-r border-border px-2 py-1 font-medium whitespace-nowrap">
                    {player ? `${player.first_name} ${player.last_name}` : ''}
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
                    const isCurrentBatter = !!cell && !atBat && canScoreCell(cell, scoreboardBatter, isLocked)

                    return (
                      <td key={inningIndex} className={`relative border-r border-border px-1 py-1 ${isCurrentBatter ? 'bg-emerald-50' : 'bg-slate-100/80'}`}>
                        <button
                          type="button"
                          disabled={!isCurrentBatter}
                          aria-current={isCurrentBatter ? 'step' : undefined}
                          aria-label={`${cell?.playerName || (uiLang === 'es' ? 'Sin jugador' : 'Empty lineup spot')} · ${uiLang === 'es' ? 'Entrada' : 'Inning'} ${col.inning} · ${uiLang === 'es' ? 'Turno' : 'Appearance'} ${col.appearance} · ${isCurrentBatter ? (uiLang === 'es' ? 'Anotar turno actual' : 'Score current at-bat') : (atBat?.notation || atBat?.result || (uiLang === 'es' ? 'Bloqueado' : 'Locked'))}`}
                          className={`flex min-h-11 min-w-11 w-full items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${isCurrentBatter ? 'cursor-pointer bg-emerald-100 ring-2 ring-inset ring-emerald-500 hover:bg-emerald-200 active:bg-emerald-300' : 'cursor-not-allowed'}`}
                          onClick={() => { if (isCurrentBatter && cell) handleCellClick(cell) }}
                        >
                          <ScorebookDiamond play={atBat} current={isCurrentBatter} />
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
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {isLocked ? (
            <p className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-800">
              <Lock className="size-4 shrink-0" aria-hidden="true" />
              Scorebook LOCKED - View only mode
            </p>
          ) : (
            <div className="space-y-1">
              <p>{uiLang === 'es' ? '• Solo el turno verde está habilitado para anotar.' : '• Only the green at-bat is enabled for scoring.'}</p>
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
              Save Scorebook
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
      </div>

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

      {/* Canvas Drawing Modal */}
      {showCanvasModal && selectedCell && (
        <DiamondCanvas
          onSave={(notation, baseRunners, fieldLocationData, baseRunnerOuts, baseRunnerOutTypes, rbi, runnerUpdates) => {
            return saveAtBat(notation, baseRunners, fieldLocationData, baseRunnerOuts, baseRunnerOutTypes, rbi, runnerUpdates)
          }}
          activeRunners={getActiveRunners(selectedCell.playerId, selectedCell.inning, selectedCell.teamSide || currentTeamSide)}
          matchup={matchup}
          outsBefore={outsBefore(selectedCell.playerId, selectedCell.inning, selectedCell.teamSide || currentTeamSide)}
          onRunnerEvent={recordRunnerEvent}
          onClose={() => {
            setShowCanvasModal(false)
            setSelectedCell(null)
          }}
          playerName={selectedCell.playerName}
          inning={selectedCell.inning}
          existingAtBat={atBats.find(ab => ab.id === selectedAtBatId) as unknown as Record<string, unknown>}
          isLocked={isLocked}
        />
      )}

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
