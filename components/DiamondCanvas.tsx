'use client'

import { useEffect, useState } from 'react'
import ClassicAtBatPad from './ClassicAtBatPad'
import FieldSvg, { type BaseName } from './FieldSvg'
import { fieldAreaAt } from '@/lib/scorecard/geometry'
import { matchupLine, type MatchupSummary } from '@/lib/matchup'
import RunnerPlayModal, { type RunnerOption } from './RunnerPlayModal'
import { runnerBaseOf, type RunnerEventInput } from '@/lib/runnerEvents'

type BaseFlags = { first: boolean, second: boolean, third: boolean, home: boolean }
type RunnerBase = 'first' | 'second' | 'third'

/** A runner from another batter's box who is on base when this at-bat starts. */
export interface ActiveRunner {
  atBatId: string
  playerId?: string | null
  playerName: string
  base: RunnerBase
}
export type RunnerMove = 'stay' | 'second' | 'third' | 'home' | 'out'
/** What to write into that runner's own box after this play. */
export interface RunnerUpdate {
  atBatId: string
  playerName: string
  move: RunnerMove
  base_runners: BaseFlags
  base_runner_outs: BaseFlags
  out_type: string
  runs_scored: number
}

const NO_BASES: BaseFlags = { first: false, second: false, third: false, home: false }
const BASE_ORDER: ('first' | 'second' | 'third' | 'home')[] = ['first', 'second', 'third', 'home']
const BASE_SHORT: Record<string, string> = { first: '1B', second: '2B', third: '3B', home: 'Home' }
const RESULT_LABEL: Record<string, string> = {
  H1: 'Single', H2: 'Double', H3: 'Triple', HR: 'Home run', BB: 'Walk', HBP: 'Hit by pitch', E: 'Error', FC: "Fielder's choice",
  BUNT: 'Bunt', SAC: 'Sacrifice bunt', SF: 'Sacrifice fly', GO: 'Ground out', FO: 'Fly out', LO: 'Line out', PO: 'Pop out',
  BUNT_OUT: 'Bunt out', K: 'Strikeout',
}

function advance(base: RunnerBase, n: number): RunnerMove {
  if (n <= 0) return 'stay'
  return BASE_ORDER[Math.min(BASE_ORDER.indexOf(base) + n, 3)] as RunnerMove
}

/** What usually happens to each runner on this result. The scorer can change every one. */
export function defaultRunnerMoves(result: string, runners: ActiveRunner[]): Record<string, RunnerMove> {
  const on = {
    first: runners.some((r) => r.base === 'first'),
    second: runners.some((r) => r.base === 'second'),
  }
  const moves: Record<string, RunnerMove> = {}
  for (const r of runners) {
    let m: RunnerMove = 'stay'
    switch (result) {
      case 'HR':
      case 'H3':
        m = 'home'
        break
      case 'H2':
        m = r.base === 'first' ? 'third' : 'home'
        break
      case 'H1':
      case 'E':
      case 'BUNT':
      case 'FC':
      case 'SAC':
        m = advance(r.base, 1)
        break
      case 'BB':
      case 'HBP':
        // Only forced runners move
        if (r.base === 'first') m = 'second'
        else if (r.base === 'second') m = on.first ? 'third' : 'stay'
        else m = on.first && on.second ? 'home' : 'stay'
        break
      case 'SF':
        m = r.base === 'third' ? 'home' : 'stay'
        break
      default:
        m = 'stay'
    }
    moves[r.atBatId] = m
  }
  return moves
}

export function runnerUpdateFor(r: ActiveRunner, move: RunnerMove, result: string): RunnerUpdate {
  const base_runners: BaseFlags = { ...NO_BASES }
  const base_runner_outs: BaseFlags = { ...NO_BASES }
  let out_type = ''
  let runs_scored = 0
  if (move === 'stay') base_runners[r.base] = true
  else if (move === 'out') {
    base_runner_outs[r.base] = true
    out_type = ['FC', 'GO', 'BUNT_OUT', 'SAC', 'H1', 'E', 'BUNT'].includes(result) ? 'FORCE_OUT' : 'TAGGED_OUT'
  } else if (move === 'home') {
    base_runners.home = true
    runs_scored = 1
  } else base_runners[move] = true
  return { atBatId: r.atBatId, playerName: r.playerName, move, base_runners, base_runner_outs, out_type, runs_scored }
}

const countScored = (moves: Record<string, RunnerMove>) => Object.values(moves).filter((m) => m === 'home').length

interface DiamondCanvasProps {
  onSave: (notation: string, baseRunners?: { first: boolean, second: boolean, third: boolean, home: boolean }, fieldLocationData?: Record<string, unknown>, baseRunnerOuts?: { first: boolean, second: boolean, third: boolean, home: boolean }, baseRunnerOutTypes?: { first: string, second: string, third: string, home: string }, rbi?: number, runnerUpdates?: RunnerUpdate[]) => void
  /** Runners on base from other boxes of this inning, so the play can move them too */
  activeRunners?: ActiveRunner[]
  /** This batter's history against the pitcher on the mound */
  matchup?: MatchupSummary | null
  /** Outs already recorded in this inning for this side before this at-bat (live game data) */
  outsBefore?: number
  /** A runner play during this at-bat (stolen base, pickoff...): persisted by the scorebook */
  onRunnerEvent?: (ev: RunnerEventInput) => Promise<void> | void
  onClose: () => void
  playerName: string
  inning: number
  existingAtBat?: Record<string, unknown> // For editing existing at-bats
  isLocked?: boolean // Game is locked and view-only
}

export default function DiamondCanvas({ onSave, onClose, playerName, inning, existingAtBat, isLocked = false, activeRunners = [], matchup = null, outsBefore = 0, onRunnerEvent }: DiamondCanvasProps) {
  // Classic (paper box, stylus/finger) or Digital (buttons). Remembered per browser.
  const [scoringMode, setScoringMode] = useState<'classic' | 'digital'>(() => {
    try { return localStorage.getItem('scoringMode') === 'digital' ? 'digital' : 'classic' } catch { return 'classic' }
  })
  const switchMode = (m: 'classic' | 'digital') => {
    setScoringMode(m)
    try { localStorage.setItem('scoringMode', m) } catch { /* ignore */ }
  }
  const [count, setCount] = useState({ strikes: 0, balls: 0, fouls: 0 })
  const [pitchCount, setPitchCount] = useState(0)
  const [selectedBase, setSelectedBase] = useState<'first' | 'second' | 'third' | 'home' | null>(null)
  const [baseRunners, setBaseRunners] = useState<{first: boolean, second: boolean, third: boolean, home: boolean}>({
    first: false,
    second: false,
    third: false,
    home: false
  })
  const [runScored, setRunScored] = useState(false)
  const [runSaved, setRunSaved] = useState(false)
  const [handwritingInput, setHandwritingInput] = useState('')
  const [showFieldSelection, setShowFieldSelection] = useState(false)
  const [selectedFieldArea, setSelectedFieldArea] = useState<string | null>(null)
  const [showOutcomeSelection, setShowOutcomeSelection] = useState(false)
  const [fieldLocationData, setFieldLocationData] = useState<{
    fieldArea: string
    fieldZone: string
    hitDistance: string
    hitAngle: string
    xCoordinate: number
    yCoordinate: number
  } | null>(null)
  const [isOut, setIsOut] = useState(false)
  const [baseRunnerOuts, setBaseRunnerOuts] = useState<{first: boolean, second: boolean, third: boolean, home: boolean}>({
    first: false,
    second: false,
    third: false,
    home: false
  })
  const [showOutTypeModal, setShowOutTypeModal] = useState(false)
  const [selectedOutType, setSelectedOutType] = useState<string | null>(null)
  const [baseRunnerOutTypes, setBaseRunnerOutTypes] = useState<{first: string, second: string, third: string, home: string}>({
    first: '',
    second: '',
    third: '',
    home: ''
  })
  const [ballLandingPosition, setBallLandingPosition] = useState<{x: number, y: number} | null>(null)
  const [atBatLocked, setAtBatLocked] = useState(false)
  const [outSaved, setOutSaved] = useState(false)
  const [showStrikeoutConfirm, setShowStrikeoutConfirm] = useState(false)
  const [showWalkConfirm, setShowWalkConfirm] = useState(false)
  const [showRBISelection, setShowRBISelection] = useState(false)
  const [selectedRBI, setSelectedRBI] = useState<number>(0)
  const [preHitRunnersCount, setPreHitRunnersCount] = useState<number>(0)
  const [rbiEligibleCount, setRbiEligibleCount] = useState<number>(0)
  // Other runners on this play: the step after the result, and what gets written to their boxes on save
  const [showRunnerStep, setShowRunnerStep] = useState(false)
  const [runnerResult, setRunnerResult] = useState('')
  const [runnerMoves, setRunnerMoves] = useState<Record<string, RunnerMove>>({})
  const [pendingRunnerUpdates, setPendingRunnerUpdates] = useState<RunnerUpdate[]>([])
  const [showRunnerPlay, setShowRunnerPlay] = useState(false)

  // Load existing at-bat data when component mounts or existingAtBat changes
  useEffect(() => {
    if (existingAtBat) {
      console.log('=== LOADING EXISTING AT-BAT ===')
      console.log('Full existingAtBat object:', existingAtBat)
      console.log('existingAtBat.base_runners:', existingAtBat.base_runners)
      console.log('existingAtBat.result:', existingAtBat.result)
      console.log('================================')
      
      // Load base runners from existing at-bat
      if (existingAtBat.base_runners) {
        setBaseRunners(existingAtBat.base_runners as { first: boolean, second: boolean, third: boolean, home: boolean })
        console.log('Loaded base runners:', existingAtBat.base_runners)
        console.log('Setting baseRunners state to:', existingAtBat.base_runners)
        
        // Auto-select the first base that has a runner for editing
        const baseRunners = existingAtBat.base_runners as { first: boolean, second: boolean, third: boolean, home: boolean }
        if (baseRunners.first) {
          setSelectedBase('first')
          console.log('Auto-selected first base')
        } else if (baseRunners.second) {
          setSelectedBase('second')
          console.log('Auto-selected second base')
        } else if (baseRunners.third) {
          setSelectedBase('third')
          console.log('Auto-selected third base')
        } else if (baseRunners.home) {
          setSelectedBase('home')
          console.log('Auto-selected home base')
        }
      } else {
        console.log('No base_runners found in existingAtBat')
      }
      
      // Load notation if it exists (prefer notation field, fallback to result)
      if (existingAtBat.notation) {
        setHandwritingInput(existingAtBat.notation as string)
        console.log('Loaded notation:', existingAtBat.notation)
      } else if (existingAtBat.result) {
        setHandwritingInput(existingAtBat.result as string)
        console.log('Loaded result as notation:', existingAtBat.result)
      }
      
      // Set atBatLocked for hit-like outcomes to allow base runner movement
      const hitLikeOutcomes = ['E', 'FC', 'BUNT', 'H1', 'H2', 'H3', 'HR']
      const currentNotation = existingAtBat.notation || existingAtBat.result
      if (hitLikeOutcomes.includes(currentNotation as string)) {
        setAtBatLocked(true)
        console.log('Set atBatLocked=true for hit-like outcome:', currentNotation)
      }
      
      // Set run scored if home is true
      if ((existingAtBat.base_runners as { first: boolean, second: boolean, third: boolean, home: boolean })?.home) {
        setRunScored(true)
        setRunSaved(true) // Mark run as already saved for existing at-bats
        console.log('Run was scored in this at-bat')
      }
      
      // Load field location data if available
      if (existingAtBat.field_area || existingAtBat.field_zone) {
        setFieldLocationData({
          fieldArea: (existingAtBat.field_area as string) || '',
          fieldZone: (existingAtBat.field_zone as string) || '',
          hitDistance: (existingAtBat.hit_distance as string) || '',
          hitAngle: (existingAtBat.hit_angle as string) || '',
          xCoordinate: Number(existingAtBat.hit_x ?? existingAtBat.x_coordinate) || 0,
          yCoordinate: Number(existingAtBat.hit_y ?? existingAtBat.y_coordinate) || 0
        })
        const hx = Number(existingAtBat.hit_x)
        const hy = Number(existingAtBat.hit_y)
        if (Number.isFinite(hx) && Number.isFinite(hy) && (hx !== 0 || hy !== 0)) setBallLandingPosition({ x: hx, y: hy })
        console.log('Loaded field location data:', {
          fieldArea: existingAtBat.field_area,
          fieldZone: existingAtBat.field_zone,
          hitDistance: existingAtBat.hit_distance,
          hitAngle: existingAtBat.hit_angle
        })
      }
      
      // Check if result is an out (Errors and Fielder's Choice are NOT outs for batter)
      const outResults = ['strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out']
      const resultStr = ((existingAtBat.result as string) || '').toLowerCase()
      const notationStr = ((existingAtBat.notation as string) || '').toUpperCase()
      const isError = notationStr === 'E' || resultStr === 'error'
      const isFieldersChoice = notationStr === 'FC' || resultStr === 'fielders_choice' || resultStr === 'fielder_choice'
      const isBuntHit = notationStr === 'BUNT' || resultStr === 'bunt'
      // If any of the above hit-like outcomes, ensure not marked as out
      if (isError || isFieldersChoice || isBuntHit) {
        setIsOut(false)
      } else {
        setIsOut(outResults.includes(resultStr))
      }
      
      // Load base runner outs if available
      if (existingAtBat.base_runner_outs) {
        setBaseRunnerOuts(existingAtBat.base_runner_outs as { first: boolean, second: boolean, third: boolean, home: boolean })
        console.log('Loaded base runner outs:', existingAtBat.base_runner_outs)
        
        // Check if any base runner was out (tagged, caught stealing, or force out)
        const baseRunnerOuts = existingAtBat.base_runner_outs as { first: boolean, second: boolean, third: boolean, home: boolean }
        if (baseRunnerOuts.first || baseRunnerOuts.second || baseRunnerOuts.third || baseRunnerOuts.home) {
          // Remove yellow highlight from bases where runners were out
          setBaseRunners(prev => ({
            first: prev.first && !baseRunnerOuts.first,
            second: prev.second && !baseRunnerOuts.second,
            third: prev.third && !baseRunnerOuts.third,
            home: prev.home && !baseRunnerOuts.home
          }))
          // Mark as out (but don't lock - allow editing base runner outs)
          setIsOut(true)
        }
      }
    }
    // Don't reset state when existingAtBat is undefined - let user set base runners manually
  }, [existingAtBat])

  /** Tap on a base of the infield view: the batter (or the runner) is on that base. */
  const handleBaseClick = (base: BaseName) => {
    // Don't allow interaction if locked (view only)
    if (isLocked) return
    // Don't allow base selection if it's an out
    if (isOut) return
    // Lock everything if a run has been scored
    if (runScored) return
    // Allow base selection for hit-like outcomes even when at-bat is locked
    const hitLikeOutcomes = ['E', 'FC', 'BUNT', 'H1', 'H2', 'H3', 'HR']
    const isHitLikeOutcome = hitLikeOutcomes.includes(handwritingInput)
    // Check if there are active runners (for marking outs on existing at-bats)
    const hasActiveRunners = (baseRunners.first && !baseRunnerOuts.first && !runScored) ||
                             (baseRunners.second && !baseRunnerOuts.second && !runScored) ||
                             (baseRunners.third && !baseRunnerOuts.third && !runScored) ||
                             (baseRunners.home && !baseRunnerOuts.home && !runScored)
    if (atBatLocked && !isHitLikeOutcome && !hasActiveRunners) return
    setSelectedBase(base)
    setBaseRunners({ first: base === 'first', second: base === 'second', third: base === 'third', home: base === 'home' })
  }

  const clearSelection = () => setSelectedBase(null)

  const addStrike = () => {
    setCount(prev => {
      const newStrikes = Math.min(prev.strikes + 1, 3)
      return { ...prev, strikes: newStrikes }
    })
    setPitchCount(prev => prev + 1)
  }

  const addBall = () => {
    setCount(prev => {
      const newBalls = Math.min(prev.balls + 1, 4)
      return { ...prev, balls: newBalls }
    })
    setPitchCount(prev => prev + 1)
  }

  // Auto-detect 3 strikes or 4 balls
  useEffect(() => {
    if (count.strikes === 3 && !atBatLocked && !showStrikeoutConfirm && !isOut) {
      // Show confirmation modal for strikeout
      setShowStrikeoutConfirm(true)
    }
    
    if (count.balls === 4 && !atBatLocked && !showWalkConfirm && !isOut) {
      // Show confirmation modal for walk
      setShowWalkConfirm(true)
    }
  }, [count.strikes, count.balls, atBatLocked, showStrikeoutConfirm, showWalkConfirm, isOut])

  const confirmStrikeout = () => {
    setShowStrikeoutConfirm(false)
    setHandwritingInput('K')
    setIsOut(true)
    setAtBatLocked(true)
  }

  const cancelStrikeout = () => {
    setShowStrikeoutConfirm(false)
    setCount(prev => ({ ...prev, strikes: prev.strikes - 1 }))
  }

  const confirmWalk = () => {
    setShowWalkConfirm(false)
    setBaseRunners(prev => ({ ...prev, first: true }))
    setHandwritingInput('BB')
    setAtBatLocked(true)
    // Forced runners move on a walk
    openRunnerStep('BB', false)
  }

  const cancelWalk = () => {
    setShowWalkConfirm(false)
    setCount(prev => ({ ...prev, balls: prev.balls - 1 }))
  }

  const confirmRBI = () => {
    console.log('confirmRBI called - selectedRBI:', selectedRBI)
    setShowRBISelection(false)
    setShowOutcomeSelection(false)
    // RBI is stored in selectedRBI state, will be passed to saveDrawing
  }

  const cancelRBI = () => {
    console.log('cancelRBI called')
    setShowRBISelection(false)
    setShowOutcomeSelection(false)
    setSelectedRBI(0)
  }

  /**
   * After the batter's result: if other runners are on base, ask what happened to
   * them (pre-filled with the usual outcome). Otherwise fall back to the RBI question
   * for hits, or nothing for outs.
   */
  const openRunnerStep = (result: string, askRbiWithoutRunners: boolean) => {
    if (activeRunners.length > 0) {
      const moves = defaultRunnerMoves(result, activeRunners)
      setRunnerResult(result)
      setRunnerMoves(moves)
      setSelectedRBI(countScored(moves) + (result === 'HR' ? 1 : 0))
      setShowRunnerStep(true)
    } else if (askRbiWithoutRunners) {
      setSelectedRBI(result === 'HR' ? 1 : 0)
      setRbiEligibleCount(4)
      setShowRBISelection(true)
    }
  }

  const setRunnerMove = (atBatId: string, move: RunnerMove) => {
    const next = { ...runnerMoves, [atBatId]: move }
    setRunnerMoves(next)
    setSelectedRBI(countScored(next) + (runnerResult === 'HR' ? 1 : 0))
  }

  const confirmRunnerStep = () => {
    setPendingRunnerUpdates(activeRunners.map((r) => runnerUpdateFor(r, runnerMoves[r.atBatId] ?? 'stay', runnerResult)))
    setShowRunnerStep(false)
    setShowOutcomeSelection(false)
  }

  const cancelRunnerStep = () => {
    setShowRunnerStep(false)
    setShowOutcomeSelection(false)
    setPendingRunnerUpdates([])
  }

  // Runners who can steal / be picked off right now: this box's own runner (when editing) plus the others
  const selfBase = existingAtBat ? runnerBaseOf(existingAtBat as { base_runners?: BaseFlags | null; base_runner_outs?: BaseFlags | null }) : null
  const runnerOptions: RunnerOption[] = [
    ...(existingAtBat && selfBase ? [{ atBatId: String(existingAtBat.id), playerId: (existingAtBat.player_id as string) ?? null, playerName, base: selfBase }] : []),
    ...activeRunners.map((r) => ({ atBatId: r.atBatId, playerId: r.playerId ?? null, playerName: r.playerName, base: r.base })),
  ]
  const canRunnerPlay = !!onRunnerEvent && !isLocked && runnerOptions.length > 0

  // Out number of this play: outs already in the inning + batter out + runners put out here
  const BATTER_OUT_CODES = ['K', 'KC', 'GO', 'FO', 'LO', 'PO', 'SF', 'SAC', 'BUNT_OUT', 'DP']
  const batterOut = BATTER_OUT_CODES.includes(handwritingInput.toUpperCase()) || ['strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out', 'sacrifice_fly', 'sacrifice_bunt'].includes(handwritingInput.toLowerCase())
  const runnerOutsHere = Object.values(baseRunnerOuts).filter(Boolean).length + pendingRunnerUpdates.filter((u) => u.move === 'out').length
  const outsThisPlay = (batterOut ? 1 : 0) + runnerOutsHere
  const outNumber = outsThisPlay > 0 ? Math.min(3, outsBefore + outsThisPlay) : 0

  // Bases occupied by the other runners (after the play once it is decided, before it otherwise)
  const occupiedBases = (() => {
    const o = { first: false, second: false, third: false, home: false }
    if (pendingRunnerUpdates.length > 0) {
      for (const u of pendingRunnerUpdates) {
        if (u.move === 'home' || u.move === 'out') continue
        const b = u.move === 'stay' ? activeRunners.find((r) => r.atBatId === u.atBatId)?.base : u.move
        if (b) o[b] = true
      }
    } else {
      for (const r of activeRunners) o[r.base] = true
    }
    return o
  })()

  const addFoul = () => {
    setCount(prev => {
      const newFouls = prev.fouls + 1
      // Foul = strike, but if already 2 strikes, count stays the same
      const newStrikes = prev.strikes < 2 ? prev.strikes + 1 : prev.strikes
      return { ...prev, strikes: newStrikes, fouls: newFouls }
    })
    setPitchCount(prev => prev + 1)
  }

  const resetCount = () => {
    setCount({ strikes: 0, balls: 0, fouls: 0 })
    setPitchCount(0)
  }

  const handleFieldClick = (fieldArea: string, event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | null = null) => {
    console.log('Field area clicked:', fieldArea)
    
    // Capture pixel-perfect coordinates
    let xCoordinate = 0
    let yCoordinate = 0
    
    if (event) {
      const fieldContainer = document.getElementById('field-container')
      if (fieldContainer) {
        const rect = fieldContainer.getBoundingClientRect()
        const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
        const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
        
        // Calculate relative coordinates within the field container
        xCoordinate = Math.round(((clientX - rect.left) / rect.width) * 10000) / 100 // Percentage with 2 decimals
        yCoordinate = Math.round(((clientY - rect.top) / rect.height) * 10000) / 100 // Percentage with 2 decimals
      }
    }
    
    // Determine field zone and hit characteristics
    const fieldZone = fieldArea
    let hitDistance = 'MEDIUM'
    let hitAngle = 'CENTER'
    
    // Determine distance based on field area
    if (fieldArea.includes('DEEP_')) {
      hitDistance = 'DEEP'
    } else if (fieldArea.includes('INFIELD') || fieldArea.includes('FOUL')) {
      hitDistance = 'SHORT'
    }
    
    // Determine angle based on field area
    if (fieldArea.includes('LEFT_')) {
      hitAngle = 'PULL'
    } else if (fieldArea.includes('RIGHT_')) {
      hitAngle = 'OPPO'
    }
    
    // Set field location data with pixel coordinates
    setFieldLocationData({
      fieldArea: selectedFieldArea || '',
      fieldZone: fieldZone,
      hitDistance: hitDistance,
      hitAngle: hitAngle,
      xCoordinate: xCoordinate,
      yCoordinate: yCoordinate
    })
    
    // Set visual ball landing position
    setBallLandingPosition({ x: xCoordinate, y: yCoordinate })
    
    setSelectedFieldArea(selectedFieldArea + '_' + fieldArea)
    setShowFieldSelection(false)
    setShowOutcomeSelection(true)
  }

  const handleHitLikeOutcome = (notation: string) => {
    // Set the notation
    setHandwritingInput(notation)
    
    // Lock the at-bat (count and buttons will be disabled)
    setAtBatLocked(true)
    
    // Set base runners - batter reaches first base for hit-like outcomes
    setBaseRunners({ first: true, second: false, third: false, home: false })
    
    // Other runners first (if any), then RBIs
    openRunnerStep(notation, true)
  }

  const handleHitTypeSelection = (hitType: string) => {
    // Set the notation
    setHandwritingInput(hitType)
    
    // Lock the at-bat (count and buttons will be disabled)
    setAtBatLocked(true)
    
    // Set base runners based on hit type
    let newBaseRunners = { first: false, second: false, third: false, home: false }
    
    if (hitType === 'H1') {
      // Single - runner on first base
      newBaseRunners = { first: true, second: false, third: false, home: false }
    } else if (hitType === 'H2') {
      // Double - runner on second base
      newBaseRunners = { first: false, second: true, third: false, home: false }
    } else if (hitType === 'H3') {
      // Triple - runner on third base
      newBaseRunners = { first: false, second: false, third: true, home: false }
    } else if (hitType === 'HR') {
      // Home run - mark as scored (home run)
      newBaseRunners = { first: false, second: false, third: false, home: true }
      setRunScored(true)
    }
    
    // Check if there are active runners on base BEFORE the hit
    const activeRunnersCount = (baseRunners.first ? 1 : 0) + (baseRunners.second ? 1 : 0) + (baseRunners.third ? 1 : 0)
    console.log('=== RBI CHECK === | (1, 2, 3) runners on base BEFORE hit:', activeRunnersCount)
    console.log('Runners on base before hit:', baseRunners)
    console.log('Active runners count:', activeRunnersCount)
    console.log('Hit type:', hitType)
    console.log('================')
    
    // Store the pre-hit runners count for RBI selection
    setPreHitRunnersCount(activeRunnersCount)
    
    // Update base runners
    setBaseRunners(newBaseRunners)
    
    // Other runners first (if any), then RBIs
    openRunnerStep(hitType, true)
  }

  const saveDrawing = () => {
    // If run was scored, set home to true in baseRunners
    const finalBaseRunners = runScored ? { first: false, second: false, third: false, home: true } : baseRunners
    
    console.log('=== SAVING AT-BAT ===')
    console.log('handwritingInput:', handwritingInput)
    console.log('finalBaseRunners:', finalBaseRunners)
    console.log('runScored:', runScored)
    console.log('fieldLocationData:', fieldLocationData)
    console.log('===================')
    
    onSave(handwritingInput || 'DRAWING_SAVED', finalBaseRunners, fieldLocationData || undefined, baseRunnerOuts, baseRunnerOutTypes, selectedRBI, pendingRunnerUpdates)
    
    // Mark out as saved so button can't be clicked again
    if (isOut) {
      setOutSaved(true)
    }
    
    // Mark run as saved so button can't be clicked again
    if (runScored) {
      setRunSaved(true)
    }
  }

  if (scoringMode === 'classic') {
    return (
      <ClassicAtBatPad
        playerName={playerName}
        inning={inning}
        existingAtBat={existingAtBat}
        isLocked={isLocked}
        onSave={onSave}
        onClose={onClose}
        onSwitchMode={() => switchMode('digital')}
        matchup={matchup}
        activeRunners={activeRunners.map((r) => ({ atBatId: r.atBatId, playerId: r.playerId ?? null, playerName: r.playerName, base: r.base }))}
        onRunnerEvent={onRunnerEvent}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[95vh] max-h-[700px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-2 sm:p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-base sm:text-xl font-bold text-gray-800">
              Score At-Bat - {playerName} (Inning {inning})
            </h3>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-lg bg-gray-100 p-0.5">
                <button type="button" onClick={() => switchMode('classic')} className="rounded-md px-3 py-1 text-xs font-semibold text-gray-500 hover:text-gray-800">Clásico</button>
                <button type="button" aria-pressed className="rounded-md bg-white px-3 py-1 text-xs font-semibold shadow-sm">Digital</button>
              </div>
              {canRunnerPlay && (
                <button type="button" onClick={() => setShowRunnerPlay(true)} className="whitespace-nowrap rounded-lg border border-amber-500 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100" title="Stolen base, pickoff, wild pitch…">
                  SB/PK
                </button>
              )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
            >
              ×
            </button>
            </div>
          </div>
          {matchup && (
            <p className="mt-1 text-xs text-blue-900">
              <span className="font-semibold">vs {matchup.pitcherName}</span> · {matchupLine(matchup, 'en')}
            </p>
          )}
          <p className="text-xs sm:text-sm text-gray-600 mt-1 hidden sm:block">
            Draw on the diamond: K for strikeout, 6-3 for groundout, arrows for base paths, etc.
          </p>
        </div>

        {/* Other runners on this play (decided in the step after the result) */}
        {pendingRunnerUpdates.length > 0 && (
          <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-3 py-1.5 text-xs text-blue-900">
            <span className="min-w-0 flex-1 truncate">
              {pendingRunnerUpdates.map((u) => {
                const from = activeRunners.find((r) => r.atBatId === u.atBatId)?.base
                const what = u.move === 'stay' ? 'stays ' + (from ? BASE_SHORT[from] : '') : u.move === 'home' ? 'scores' : u.move === 'out' ? 'out' : 'to ' + BASE_SHORT[u.move]
                return u.playerName.split(' ')[0] + ' ' + what
              }).join(' · ')}
            </span>
            {!isLocked && (
              <button type="button" onClick={() => setShowRunnerStep(true)} className="shrink-0 font-semibold underline">Edit</button>
            )}
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 p-2 sm:p-6 flex items-center justify-center bg-gray-50 overflow-auto">
          <div className="relative">
            {/* Same field as the classic box, zoomed into the infield so the runners and home plate are big.
                Hit / Out zoom it out to the whole field to tap where the ball went. */}
            <div
              id="field-container"
              className={`relative overflow-hidden rounded-lg border border-gray-300 bg-[#fffdf7] shadow-inner ${showFieldSelection ? 'cursor-crosshair' : ''}`}
              style={{ width: 'min(100vw - 2rem, 400px)', height: 'min(100vw - 2rem, 400px)' }}
              onClick={showFieldSelection ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = ((e.clientX - rect.left) / rect.width) * 100
                const y = ((e.clientY - rect.top) / rect.height) * 100
                handleFieldClick(fieldAreaAt([x, y]), e)
              } : undefined}
            >
              <FieldSvg
                className="absolute inset-0 h-full w-full"
                view={showFieldSelection || ballLandingPosition ? 'full' : 'infield'}
                runners={baseRunners}
                selectedBase={selectedBase}
                runnerOuts={baseRunnerOuts}
                occupied={occupiedBases}
                runScored={runScored}
                landing={ballLandingPosition ? [ballLandingPosition.x, ballLandingPosition.y] : null}
                onBaseClick={showFieldSelection ? undefined : handleBaseClick}
              />
            </div>

            {/* Picking where the ball landed: caption + cancel over the full field */}
            {showFieldSelection && (
              <>
                <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/85 px-3 py-1 text-xs font-semibold text-white shadow">
                  {selectedFieldArea === 'OUT' ? 'Tap where the ball was fielded' : 'Tap where the ball landed'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowFieldSelection(false)
                    setBallLandingPosition(null)
                  }}
                  className="absolute bottom-2 left-2 z-10 rounded-lg bg-gray-500 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-gray-600"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Everything below sits on top of the infield view and hides while picking a landing spot */}
            <div hidden={showFieldSelection}>

            {/* Out circle, bottom right like the paper box: which out of the inning this play made */}
            {outNumber > 0 && (
              <div
                className={`pointer-events-none absolute right-2 flex size-12 items-center justify-center rounded-full border-[3px] border-gray-800 bg-white/95 text-2xl font-black leading-none text-gray-900 shadow-lg ${isOut || isLocked ? 'bottom-2' : 'bottom-14'}`}
                title={`Out ${outNumber}`}
              >
                {outNumber}
              </div>
            )}

            {/* Count - top right (new at-bats; existing ones show the locked play there) */}
            {!existingAtBat && (
              <div className="pointer-events-none absolute right-1 top-1 rounded-lg border border-gray-200 bg-white/90 px-2 py-1 text-right shadow sm:right-2 sm:top-2">
                <div className="text-lg font-bold leading-tight text-gray-900">{count.balls}-{count.strikes}</div>
                <div className="text-[10px] font-semibold text-gray-500">Pitches: {pitchCount}{count.fouls > 0 ? ` · Fouls: ${count.fouls}` : ''}</div>
              </div>
            )}
            
    {/* Hit/Out Buttons - Top Center */}
    {(() => {
      // Check if there are active runners (runners on base who are not already out and haven't scored)
      const hasActiveRunners = (baseRunners.first && !baseRunnerOuts.first && !runScored) ||
                               (baseRunners.second && !baseRunnerOuts.second && !runScored) ||
                               (baseRunners.third && !baseRunnerOuts.third && !runScored) ||
                               (baseRunners.home && !baseRunnerOuts.home && !runScored)
      
      // Show Hit/Out buttons for new at-bats when not locked
      const shouldShowHitOutButtons = !existingAtBat && !isOut && !isLocked && !atBatLocked
      // Show Out button when there are active runners (works for both new and existing at-bats)
      // Only hide if game is locked or all runners have scored
      const shouldShowOutButtonForRunners = !isLocked && hasActiveRunners && !runScored
      
      if (!shouldShowHitOutButtons && !shouldShowOutButtonForRunners) return null
      
      return (
        <div className="absolute top-3 sm:top-4 left-1/2 transform -translate-x-1/2 flex gap-5 sm:gap-8">
          {shouldShowHitOutButtons && (
            <button
              onClick={() => {
                setShowFieldSelection(true)
                setSelectedFieldArea('HIT')
              }}
              disabled={atBatLocked}
              className="bg-green-600 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-green-700 active:bg-green-800 shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Hit
            </button>
          )}
          {(shouldShowHitOutButtons || shouldShowOutButtonForRunners) && (
            <button
              onClick={() => {
                // If there are active runners, show base selection prompt first, then out type modal
                if (hasActiveRunners) {
                  // Check if a base is already selected
                  if (selectedBase && 
                      baseRunners[selectedBase] && 
                      !baseRunnerOuts[selectedBase] && 
                      !(selectedBase === 'home' && runScored)) {
                    // Base is selected and has active runner, show out type modal directly
                    setShowOutTypeModal(true)
                  } else {
                    // No base selected or selected base doesn't have active runner, prompt user
                    alert('Please select a base with a runner first by clicking on it')
                  }
                } else {
                  // No active runners, show field selection as before
                  setShowFieldSelection(true)
                  setSelectedFieldArea('OUT')
                }
              }}
              className="bg-red-600 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-red-700 active:bg-red-800 shadow-lg"
            >
              Out
            </button>
          )}
        </div>
      )
    })()}
    
    {/* Show locked notation for existing at-bats - positioned in upper right corner (where pitch count normally is) */}
    {existingAtBat && (
      <div className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10">
        <div className="bg-gray-100 text-gray-700 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-bold border-2 border-gray-300 shadow-lg max-w-[120px] sm:max-w-[150px]">
          <div className="text-center">Play: {handwritingInput}</div>
          <div className="text-center text-[10px] sm:text-xs text-gray-500 mt-0.5">(Locked)</div>
        </div>
        {/* Show base runner outs if any */}
        {(baseRunnerOuts.first || baseRunnerOuts.second || baseRunnerOuts.third || baseRunnerOuts.home) && (
          <div className="mt-1.5 space-y-0.5">
            {baseRunnerOuts.first && (
              <div className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-300 text-center">
                Out: {baseRunnerOutTypes.first || 'OUT'} (1st)
              </div>
            )}
            {baseRunnerOuts.second && (
              <div className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-300 text-center">
                Out: {baseRunnerOutTypes.second || 'OUT'} (2nd)
              </div>
            )}
            {baseRunnerOuts.third && (
              <div className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-300 text-center">
                Out: {baseRunnerOutTypes.third || 'OUT'} (3rd)
              </div>
            )}
            {baseRunnerOuts.home && (
              <div className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-300 text-center">
                Out: {baseRunnerOutTypes.home || 'OUT'} (Home)
              </div>
            )}
          </div>
        )}
      </div>
    )}

    {/* Show base runner outs for current at-bats */}
    {!existingAtBat && (baseRunnerOuts.first || baseRunnerOuts.second || baseRunnerOuts.third || baseRunnerOuts.home) && (
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2">
        {baseRunnerOuts.first && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-300 mb-1">
            Runner Out: {baseRunnerOutTypes.first || 'OUT'} (1st)
          </div>
        )}
        {baseRunnerOuts.second && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-300 mb-1">
            Runner Out: {baseRunnerOutTypes.second || 'OUT'} (2nd)
          </div>
        )}
        {baseRunnerOuts.third && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-300 mb-1">
            Runner Out: {baseRunnerOutTypes.third || 'OUT'} (3rd)
          </div>
        )}
        {baseRunnerOuts.home && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-300 mb-1">
            Runner Out: {baseRunnerOutTypes.home || 'OUT'} (Home)
          </div>
        )}
      </div>
    )}

            {/* Count Buttons - Top Left (only show for new at-bats, not scored, and not out and not locked) */}
            {!existingAtBat && !runScored && !isOut && !isLocked && !atBatLocked && (
              <div className="absolute top-24 left-2 sm:left-4 flex flex-col gap-4 sm:gap-5">
                <button
                  onClick={addStrike}
                  disabled={atBatLocked}
                  className="bg-red-500 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-red-600 active:bg-red-700 shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Strike
                </button>
                <button
                  onClick={addBall}
                  disabled={atBatLocked}
                  className="bg-blue-500 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-blue-600 active:bg-blue-700 shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Ball
                </button>
              </div>
            )}
            
            {/* Foul - same column, lower: between third base and Reset Count */}
            {!existingAtBat && !runScored && !isOut && !isLocked && !atBatLocked && (
              <div className="absolute left-2 top-[64%] sm:left-4">
                <button
                  onClick={addFoul}
                  disabled={atBatLocked}
                  className="bg-yellow-500 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-yellow-600 active:bg-yellow-700 shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Foul
                </button>
              </div>
            )}

            {/* Show locked count for existing at-bats, scored runs, or outs or locked at-bat */}
            {(existingAtBat || runScored || isOut || atBatLocked) && (
              <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                <div className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold border border-gray-300">
                  {count.strikes}S-{count.balls}B-{count.fouls}F
                </div>
              </div>
            )}
            
            {/* Reset Button - Bottom Left (only show for new at-bats and not out and not locked) */}
            {!existingAtBat && !isOut && !isLocked && !atBatLocked && (
              <div className="absolute bottom-1 sm:bottom-4 left-1 sm:left-4">
                <button
                  onClick={resetCount}
                  className="bg-gray-500 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-gray-600 active:bg-gray-700 shadow-lg"
                >
                  Reset Count
                </button>
              </div>
            )}

            {/* Base Runner Out Button - Bottom Center (only show if there are base runners and not out, not locked, and not already scored) */}
            {!isOut && !isLocked && !atBatLocked && !runScored && (baseRunners.first || baseRunners.second || baseRunners.third || baseRunners.home) && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <button
                  onClick={() => {
                    console.log('=== MARK OUT CLICKED ===')
                    console.log('selectedBase:', selectedBase)
                    console.log('baseRunners:', baseRunners)
                    console.log('=======================')
                    if (selectedBase) {
                      setShowOutTypeModal(true)
                    } else {
                      alert('Please select a base first by clicking on it')
                    }
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 active:bg-red-800 shadow-lg"
                >
                  Mark Out
                </button>
              </div>
            )}

            {/* Carrera Button - Bottom Right (available for hit-like outcomes, walks, or when not locked) */}
            {!isOut && !isLocked && (
              (() => {
                const hitLikeOutcomes = ['E', 'FC', 'BUNT', 'H1', 'H2', 'H3', 'HR']
                const isHitLikeOutcome = hitLikeOutcomes.includes(handwritingInput)
                const isWalk = handwritingInput === 'BB'
                const shouldShow = !atBatLocked || isHitLikeOutcome || isWalk
                
                if (!shouldShow) return null
                
                return (
                  <div className="absolute bottom-1 sm:bottom-4 right-1 sm:right-4">
                    <button
                      onClick={() => {
                        console.log('=== CARRERA CLICKED ===')
                        console.log('Clearing all base runners - Run scored!')
                        console.log('=======================')
                        setSelectedBase(null)
                        setBaseRunners({ first: false, second: false, third: false, home: false })
                        setRunScored(true) // Set run scored to fill diamond with blue
                      }}
                      disabled={runScored && runSaved}
                      className="bg-green-600 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-green-700 active:bg-green-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Carrera
                    </button>
                  </div>
                )
              })()
            )}
            </div>
          </div>
        </div>

        {/* Out Type Selection Modal */}
        {showOutTypeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4 text-center">
                How was the runner out?
              </h3>
              <p className="text-sm text-gray-600 mb-4 text-center">
                Selected base: {selectedBase}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSelectedOutType('TAGGED_OUT')
                    setBaseRunnerOuts(prev => ({
                      ...prev,
                      [selectedBase!]: true
                    }))
                    setBaseRunnerOutTypes(prev => ({
                      ...prev,
                      [selectedBase!]: 'TAGGED_OUT'
                    }))
                    // Remove the yellow highlight from the base
                    setBaseRunners(prev => ({
                      ...prev,
                      [selectedBase!]: false
                    }))
                    // Mark as out (but don't lock the at-bat - allow multiple base runner outs)
                    setIsOut(true)
                    setShowOutTypeModal(false)
                  }}
                  className="w-full bg-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-red-700 active:bg-red-800 shadow-lg"
                >
                  Tagged Out
                </button>
                
                <button
                  onClick={() => {
                    setSelectedOutType('CAUGHT_STEALING')
                    setBaseRunnerOuts(prev => ({
                      ...prev,
                      [selectedBase!]: true
                    }))
                    setBaseRunnerOutTypes(prev => ({
                      ...prev,
                      [selectedBase!]: 'CAUGHT_STEALING'
                    }))
                    // Remove the yellow highlight from the base
                    setBaseRunners(prev => ({
                      ...prev,
                      [selectedBase!]: false
                    }))
                    // Mark as out (but don't lock the at-bat - allow multiple base runner outs)
                    setIsOut(true)
                    setShowOutTypeModal(false)
                  }}
                  className="w-full bg-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-red-700 active:bg-red-800 shadow-lg"
                >
                  Caught Stealing
                </button>
                
                <button
                  onClick={() => {
                    setSelectedOutType('FORCE_OUT')
                    setBaseRunnerOuts(prev => ({
                      ...prev,
                      [selectedBase!]: true
                    }))
                    setBaseRunnerOutTypes(prev => ({
                      ...prev,
                      [selectedBase!]: 'FORCE_OUT'
                    }))
                    // Remove the yellow highlight from the base
                    setBaseRunners(prev => ({
                      ...prev,
                      [selectedBase!]: false
                    }))
                    // Mark as out (but don't lock the at-bat - allow multiple base runner outs)
                    setIsOut(true)
                    setShowOutTypeModal(false)
                  }}
                  className="w-full bg-red-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-red-700 active:bg-red-800 shadow-lg"
                >
                  Force Out
                </button>
                
                <button
                  onClick={() => setShowOutTypeModal(false)}
                  className="w-full bg-gray-500 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-gray-600 active:bg-gray-700 shadow-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Outcome Selection Modal */}
        {showOutcomeSelection && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
              <h3 className="text-xl font-bold mb-2 text-center">
                Select the outcome
              </h3>
              <p className="text-sm text-gray-600 mb-4 text-center">
                Field area: {selectedFieldArea?.replace('HIT_', '').replace('OUT_', '')}
              </p>
              
              {/* Visual confirmation of ball landing spot */}
              <div className="mb-4 p-2 bg-gray-50 rounded border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Ball landing position:</div>
                <div className="text-sm font-mono">X: {fieldLocationData?.xCoordinate.toFixed(2)}% | Y: {fieldLocationData?.yCoordinate.toFixed(2)}%</div>
              </div>
              
              {selectedFieldArea?.includes('HIT') ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-600">Hit Types:</h4>
                  
                  {/* Hit buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleHitTypeSelection('H1')}
                      className="w-full p-3 bg-green-100 border-2 border-green-600 rounded-lg hover:bg-green-200 font-semibold"
                    >
                      Single
                    </button>
                    <button
                      onClick={() => handleHitTypeSelection('H2')}
                      className="w-full p-3 bg-green-100 border-2 border-green-600 rounded-lg hover:bg-green-200 font-semibold"
                    >
                      Double
                    </button>
                    <button
                      onClick={() => handleHitTypeSelection('H3')}
                      className="w-full p-3 bg-green-100 border-2 border-green-600 rounded-lg hover:bg-green-200 font-semibold"
                    >
                      Triple
                    </button>
                    <button
                      onClick={() => handleHitTypeSelection('HR')}
                      className="w-full p-3 bg-green-100 border-2 border-green-600 rounded-lg hover:bg-green-200 font-semibold"
                    >
                      Home Run
                    </button>
                  </div>
                  
                  {/* Separator */}
                  <div className="border-t-2 border-gray-300 my-4"></div>
                  
                  {/* Other options */}
                  <h4 className="font-semibold text-blue-600">Other Outcomes:</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleHitLikeOutcome('E')}
                      className="w-full p-3 bg-yellow-100 border-2 border-yellow-600 rounded-lg hover:bg-yellow-200 font-semibold"
                    >
                      Error
                    </button>
                    <button
                      onClick={() => handleHitLikeOutcome('FC')}
                      className="w-full p-3 bg-orange-100 border-2 border-orange-600 rounded-lg hover:bg-orange-200 font-semibold"
                    >
                      Fielder&apos;s Choice
                    </button>
                    <button
                      onClick={() => handleHitLikeOutcome('BUNT')}
                      className="w-full p-3 bg-purple-100 border-2 border-purple-600 rounded-lg hover:bg-purple-200 font-semibold"
                    >
                      Bunt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-semibold text-red-600">Out Options:</h4>
                  
                  {/* Infield outs */}
                  {selectedFieldArea && selectedFieldArea.includes('INFIELD') && (
                    <>
                      <button
                        onClick={() => {
                          setHandwritingInput('BUNT_OUT')
                          setIsOut(true)
                          setShowOutcomeSelection(false)
                          openRunnerStep('BUNT_OUT', false)
                        }}
                        className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                      >
                        BUNT OUT - Bunt Out
                      </button>
                      <button
                        onClick={() => {
                          setHandwritingInput('SAC')
                          setIsOut(true)
                          setShowOutcomeSelection(false)
                          openRunnerStep('SAC', false)
                        }}
                        className="w-full p-3 bg-orange-100 border-2 border-orange-600 rounded-lg hover:bg-orange-200 font-semibold"
                      >
                        SAC - Sacrifice Bunt
                      </button>
                      <button
                        onClick={() => {
                          setHandwritingInput('GO')
                          setIsOut(true)
                          setShowOutcomeSelection(false)
                          openRunnerStep('GO', false)
                        }}
                        className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                      >
                        INFIELD OUT - Ground Out
                      </button>
                      <button
                        onClick={() => handleHitLikeOutcome('E')}
                        className="w-full p-3 bg-yellow-100 border-2 border-yellow-600 rounded-lg hover:bg-yellow-200 font-semibold"
                      >
                        ERROR - Fielding Error
                      </button>
                    </>
                  )}
                  
                  {/* Outfield outs */}
                  {selectedFieldArea && (selectedFieldArea.includes('LEFT_FIELD') || selectedFieldArea.includes('CENTER_FIELD') || selectedFieldArea.includes('RIGHT_FIELD') || selectedFieldArea.includes('DEEP_')) && (
                    <>
                      <button
                        onClick={() => {
                          setHandwritingInput('FO')
                          setIsOut(true)
                          setShowOutcomeSelection(false)
                          openRunnerStep('FO', false)
                        }}
                        className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                      >
                        Fly Out
                      </button>
                      <button
                        onClick={() => {
                          setHandwritingInput('SF')
                          setIsOut(true)
                          setShowOutcomeSelection(false)
                          openRunnerStep('SF', false)
                        }}
                        className="w-full p-3 bg-orange-100 border-2 border-orange-600 rounded-lg hover:bg-orange-200 font-semibold"
                      >
                        Sacrifice Fly
                      </button>
                      <button
                        onClick={() => {
                          setHandwritingInput('LO')
                          setIsOut(true)
                          setShowOutcomeSelection(false)
                          openRunnerStep('LO', false)
                        }}
                        className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                      >
                        Line Out
                      </button>
                    </>
                  )}
                  
                  {/* Foul territory */}
                  {selectedFieldArea && selectedFieldArea.includes('FOUL') && (
                    <button
                      onClick={() => {
                        setHandwritingInput('FOUL')
                        setShowOutcomeSelection(false)
                      }}
                      className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                    >
                      Foul Ball
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setHandwritingInput('K')
                      setIsOut(true)
                      setShowOutcomeSelection(false)
                      openRunnerStep('K', false)
                    }}
                    className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                  >
                    Strike Out
                  </button>
                </div>
              )}
              
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setShowOutcomeSelection(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={clearSelection}
            disabled={isLocked}
            className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
          {/* Show Save button - disabled after run saved or out saved */}
          {(!isOut || !outSaved || (atBatLocked && handwritingInput === 'BB')) && (
            <button
              onClick={saveDrawing}
              disabled={isLocked || (runScored && runSaved)}
              className="px-3 py-1.5 sm:px-6 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLocked ? 'View' : runScored && runSaved ? 'Run Saved' : 'Save'}
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Strikeout Confirmation Modal */}
      {showStrikeoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-center">Strikeout?</h3>
            <p className="text-center mb-6 text-gray-600">Third strike was called. Confirm strikeout?</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={confirmStrikeout}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
              >
                Yes, Strikeout
              </button>
              <button
                onClick={cancelStrikeout}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walk Confirmation Modal */}
      {showWalkConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-center">Base por Bola?</h3>
            <p className="text-center mb-6 text-gray-600">Fourth ball was called. Confirm walk?</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={confirmWalk}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
              >
                Yes, Walk
              </button>
              <button
                onClick={cancelWalk}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RBI Selection Modal */}
      {/* Runner play during the at-bat: stolen base, caught stealing, pickoff, wild pitch, passed ball, balk */}
      {showRunnerPlay && (
        <RunnerPlayModal
          runners={runnerOptions}
          enteredVia="digital"
          onConfirm={async (ev) => {
            await onRunnerEvent?.(ev)
            setShowRunnerPlay(false)
          }}
          onClose={() => setShowRunnerPlay(false)}
        />
      )}

      {/* Runners step: what happened to the other runners on this play */}
      {showRunnerStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-3">
          <div className="bg-white p-5 rounded-lg shadow-xl max-w-md w-full max-h-[92vh] overflow-auto">
            <h3 className="text-xl font-bold mb-1 text-center">Runners on base</h3>
            <p className="text-center text-sm text-gray-600 mb-4">
              {RESULT_LABEL[runnerResult] ?? runnerResult}: the usual moves are pre-selected. Fix any that went differently.
            </p>
            <div className="space-y-3">
              {activeRunners.map((r) => {
                const move = runnerMoves[r.atBatId] ?? 'stay'
                const options: { value: RunnerMove; label: string }[] = [{ value: 'stay', label: 'Stays ' + BASE_SHORT[r.base] }]
                if (r.base === 'first') options.push({ value: 'second', label: 'To 2B' })
                if (r.base !== 'third') options.push({ value: 'third', label: 'To 3B' })
                options.push({ value: 'home', label: 'Scores' }, { value: 'out', label: 'Out' })
                return (
                  <div key={r.atBatId} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{r.playerName}</span>
                      <span className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">{BASE_SHORT[r.base]}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {options.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setRunnerMove(r.atBatId, o.value)}
                          className={
                            'rounded-lg px-3 py-2 text-sm font-bold ' +
                            (move === o.value
                              ? o.value === 'out' ? 'bg-red-600 text-white' : o.value === 'home' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                          }
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 border-t border-gray-200 pt-3">
              <div className="mb-2 text-center text-sm font-semibold">RBIs for {playerName}</div>
              <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedRBI(n)}
                    className={'px-4 py-2 rounded-lg font-bold ' + (selectedRBI === n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-center mt-5">
              <button type="button" onClick={confirmRunnerStep} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">
                Confirm
              </button>
              <button type="button" onClick={cancelRunnerStep} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-bold">
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {showRBISelection && (() => {
        console.log('RBI Modal rendering - showRBISelection:', showRBISelection)
        console.log('RBI Modal rendering - eligibleCount:', rbiEligibleCount)
        const activeRunnersCount = rbiEligibleCount
        const rbiOptions = Array.from({ length: activeRunnersCount + 1 }, (_, i) => i)
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4 text-center">Select RBIs</h3>
              <p className="text-center mb-6 text-gray-600">
                How many runs batted in? (0 to 4)
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                {rbiOptions.map(rbi => (
                  <button
                    key={rbi}
                    onClick={() => setSelectedRBI(rbi)}
                    className={`px-4 py-2 rounded-lg font-bold ${
                      selectedRBI === rbi
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {rbi}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 justify-center mt-6">
                <button
                  onClick={confirmRBI}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                >
                  Confirm ({selectedRBI} RBI{selectedRBI !== 1 ? 's' : ''})
                </button>
                <button
                  onClick={cancelRBI}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
