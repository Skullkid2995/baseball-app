'use client'

import { useRef, useEffect, useState } from 'react'

interface DiamondCanvasProps {
  onSave: (notation: string, baseRunners?: { first: boolean, second: boolean, third: boolean, home: boolean }, fieldLocationData?: Record<string, unknown>, baseRunnerOuts?: { first: boolean, second: boolean, third: boolean, home: boolean }, baseRunnerOutTypes?: { first: string, second: string, third: string, home: string }) => void
  onClose: () => void
  playerName: string
  inning: number
  existingAtBat?: Record<string, unknown> // For editing existing at-bats
  isLocked?: boolean // Game is locked and view-only
}

export default function DiamondCanvas({ onSave, onClose, playerName, inning, existingAtBat, isLocked = false }: DiamondCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 })
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
      
      // Set run scored if home is true
      if ((existingAtBat.base_runners as { first: boolean, second: boolean, third: boolean, home: boolean })?.home) {
        setRunScored(true)
        console.log('Run was scored in this at-bat')
      }
      
      // Load field location data if available
      if (existingAtBat.field_area || existingAtBat.field_zone) {
        setFieldLocationData({
          fieldArea: (existingAtBat.field_area as string) || '',
          fieldZone: (existingAtBat.field_zone as string) || '',
          hitDistance: (existingAtBat.hit_distance as string) || '',
          hitAngle: (existingAtBat.hit_angle as string) || ''
        })
        console.log('Loaded field location data:', {
          fieldArea: existingAtBat.field_area,
          fieldZone: existingAtBat.field_zone,
          hitDistance: existingAtBat.hit_distance,
          hitAngle: existingAtBat.hit_angle
        })
      }
      
      // Check if result is an out
      const outResults = ['strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out', 'error']
      setIsOut(outResults.includes(existingAtBat.result as string))
      
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
    } else {
      console.log('No existing at-bat, resetting state')
      // Reset state for new at-bat
      setBaseRunners({ first: false, second: false, third: false, home: false })
      setHandwritingInput('')
      setRunScored(false)
      setSelectedBase(null)
      setIsOut(false)
      setBaseRunnerOuts({ first: false, second: false, third: false, home: false })
      setBaseRunnerOutTypes({ first: '', second: '', third: '', home: '' })
    }
  }, [existingAtBat])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    console.log('Canvas redrawing, selectedBase:', selectedBase, 'baseRunners:', baseRunners)

    // Set up canvas
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 4
    ctx.strokeStyle = '#000000'

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw baseball field design
      drawBaseballField(ctx, canvas.width, canvas.height, baseRunners, runScored)

    // Draw count in top right corner
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`${count.balls}-${count.strikes}`, canvas.width - 15, 30)
    
    // Draw pitch count underneath
    ctx.font = 'bold 14px Arial'
    ctx.fillText(`Pitches: ${pitchCount}`, canvas.width - 15, 55)
    
    // Draw foul count if any
    if (count.fouls > 0) {
      ctx.font = 'bold 12px Arial'
      ctx.fillText(`Fouls: ${count.fouls}`, canvas.width - 15, 75)
    }

    // Reset stroke style for drawing
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 4
  }, [count, pitchCount, baseRunners, runScored, selectedBase])

  function drawBaseballField(ctx: CanvasRenderingContext2D, width: number, height: number, baseRunners: {first: boolean, second: boolean, third: boolean, home: boolean}, runScored: boolean = false) {
    const centerX = width / 2
    const centerY = height / 2
    
    // Field dimensions - leave space for buttons (top-left and bottom-left)
    const fieldWidth = Math.min(width - 120, height - 80) // Leave space for buttons
    const fieldHeight = fieldWidth * 0.8 // Slightly shorter than wide
    
    // Position field to avoid button areas
    const fieldX = centerX - fieldWidth / 2
    const fieldY = centerY - fieldHeight / 2 + 20 // Slightly lower to avoid top buttons
    
    // No outfield background - just the infield diamond
    
    // Draw infield dirt area (diamond shape)
    const diamondSize = fieldWidth * 0.6
    const diamondX = centerX - diamondSize / 2
    const diamondY = centerY + fieldHeight * 0.1
    
    // Fill diamond with blue if run scored, otherwise dirt color
    ctx.fillStyle = runScored ? '#1E3A8A' : '#DEB887' // Dodgers blue or light orange/tan dirt color
    ctx.beginPath()
    ctx.moveTo(centerX, diamondY + diamondSize / 2) // Home plate (bottom)
    ctx.lineTo(centerX + diamondSize / 2, diamondY) // First base (right)
    ctx.lineTo(centerX, diamondY - diamondSize / 2) // Second base (top)
    ctx.lineTo(centerX - diamondSize / 2, diamondY) // Third base (left)
    ctx.closePath()
    ctx.fill()
    
    // Draw base paths
    ctx.strokeStyle = '#DEB887'
    ctx.lineWidth = 8
    ctx.beginPath()
    // Home to first
    ctx.moveTo(centerX, diamondY + diamondSize / 2)
    ctx.lineTo(centerX + diamondSize / 2, diamondY)
    // First to second
    ctx.moveTo(centerX + diamondSize / 2, diamondY)
    ctx.lineTo(centerX, diamondY - diamondSize / 2)
    // Second to third
    ctx.moveTo(centerX, diamondY - diamondSize / 2)
    ctx.lineTo(centerX - diamondSize / 2, diamondY)
    // Third to home
    ctx.moveTo(centerX - diamondSize / 2, diamondY)
    ctx.lineTo(centerX, diamondY + diamondSize / 2)
    ctx.stroke()
    
    // No base runner lines - just highlight the selected base
    
    // Draw pitcher's mound
    const moundRadius = diamondSize * 0.08
    ctx.fillStyle = '#DEB887'
    ctx.beginPath()
    ctx.arc(centerX, diamondY, moundRadius, 0, 2 * Math.PI)
    ctx.fill()
    
    // Draw pitcher's rubber (white line)
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(centerX - moundRadius * 0.6, diamondY)
    ctx.lineTo(centerX + moundRadius * 0.6, diamondY)
    ctx.stroke()
    
    // Draw home plate (white pentagon)
    const homePlateSize = diamondSize * 0.08
    ctx.fillStyle = '#FFFFFF'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerX, diamondY + diamondSize / 2 + homePlateSize)
    ctx.lineTo(centerX + homePlateSize / 2, diamondY + diamondSize / 2)
    ctx.lineTo(centerX + homePlateSize, diamondY + diamondSize / 2 + homePlateSize / 2)
    ctx.lineTo(centerX + homePlateSize / 2, diamondY + diamondSize / 2 + homePlateSize)
    ctx.lineTo(centerX - homePlateSize / 2, diamondY + diamondSize / 2 + homePlateSize)
    ctx.lineTo(centerX - homePlateSize, diamondY + diamondSize / 2 + homePlateSize / 2)
    ctx.lineTo(centerX - homePlateSize / 2, diamondY + diamondSize / 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    
    // Draw bases (white squares with runner status)
    const baseSize = diamondSize * 0.15 // Make bases larger for easier clicking
    ctx.fillStyle = '#FFFFFF'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    
    // First base (right) - with selection indicator
    ctx.fillRect(centerX + diamondSize / 2 - baseSize / 2, diamondY - baseSize / 2, baseSize, baseSize)
    ctx.strokeRect(centerX + diamondSize / 2 - baseSize / 2, diamondY - baseSize / 2, baseSize, baseSize)
    if (selectedBase === 'first' || baseRunners.first) {
      console.log('Drawing yellow first base - SELECTED or RUNNER')
      ctx.fillStyle = '#FCD34D' // Yellow for selected base or runner
      ctx.fillRect(centerX + diamondSize / 2 - baseSize / 2 + 1, diamondY - baseSize / 2 + 1, baseSize - 2, baseSize - 2)
    }
    
    // Second base (top) - with selection indicator
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(centerX - baseSize / 2, diamondY - diamondSize / 2 - baseSize / 2, baseSize, baseSize)
    ctx.strokeRect(centerX - baseSize / 2, diamondY - diamondSize / 2 - baseSize / 2, baseSize, baseSize)
    if (selectedBase === 'second' || baseRunners.second) {
      ctx.fillStyle = '#FCD34D' // Yellow for selected base or runner
      ctx.fillRect(centerX - baseSize / 2 + 1, diamondY - diamondSize / 2 - baseSize / 2 + 1, baseSize - 2, baseSize - 2)
    }
    
    // Third base (left) - with selection indicator
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(centerX - diamondSize / 2 - baseSize / 2, diamondY - baseSize / 2, baseSize, baseSize)
    ctx.strokeRect(centerX - diamondSize / 2 - baseSize / 2, diamondY - baseSize / 2, baseSize, baseSize)
    if (selectedBase === 'third' || baseRunners.third) {
      ctx.fillStyle = '#FCD34D' // Yellow for selected base or runner
      ctx.fillRect(centerX - diamondSize / 2 - baseSize / 2 + 1, diamondY - baseSize / 2 + 1, baseSize - 2, baseSize - 2)
    }
    
    // Home plate - with selection indicator
    if (selectedBase === 'home' || baseRunners.home) {
      ctx.fillStyle = '#FCD34D' // Yellow for selected home plate or runner
      ctx.beginPath()
      ctx.moveTo(centerX, diamondY + diamondSize / 2 + homePlateSize)
      ctx.lineTo(centerX + homePlateSize / 2, diamondY + diamondSize / 2)
      ctx.lineTo(centerX + homePlateSize, diamondY + diamondSize / 2 + homePlateSize / 2)
      ctx.lineTo(centerX + homePlateSize / 2, diamondY + diamondSize / 2 + homePlateSize)
      ctx.lineTo(centerX - homePlateSize / 2, diamondY + diamondSize / 2 + homePlateSize)
      ctx.lineTo(centerX - homePlateSize, diamondY + diamondSize / 2 + homePlateSize / 2)
      ctx.lineTo(centerX - homePlateSize / 2, diamondY + diamondSize / 2)
      ctx.closePath()
      ctx.fill()
    }
    
    // No field border - just the diamond
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Don't allow interaction if locked (view only)
    if (isLocked) return
    
    // Don't allow base selection if it's an out
    if (isOut) return
    
    // Lock everything if a run has been scored
    if (runScored) return

    const rect = canvas.getBoundingClientRect()
    const clientX = e.clientX
    const clientY = e.clientY
    
    // Scale click coordinates to match internal canvas size (600x600)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    
    console.log('Click coordinates:', x, y)
    
    // Check if click is on a base
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const diamondSize = 300
    const baseSize = diamondSize * 0.15 // Make bases larger for easier clicking
    const diamondY = centerY + 20
    
    console.log('Base positions:')
    console.log('1st base:', centerX + diamondSize / 2 - baseSize / 2, diamondY - baseSize / 2, 'to', centerX + diamondSize / 2 + baseSize / 2, diamondY + baseSize / 2)
    console.log('2nd base:', centerX - baseSize / 2, diamondY - diamondSize / 2 - baseSize / 2, 'to', centerX + baseSize / 2, diamondY - diamondSize / 2 + baseSize / 2)
    console.log('3rd base:', centerX - diamondSize / 2 - baseSize / 2, diamondY - baseSize / 2, 'to', centerX - diamondSize / 2 + baseSize / 2, diamondY + baseSize / 2)
    
    // First base (right)
    if (x >= centerX + diamondSize / 2 - baseSize / 2 && 
        x <= centerX + diamondSize / 2 + baseSize / 2 &&
        y >= diamondY - baseSize / 2 && 
        y <= diamondY + baseSize / 2) {
      console.log('Clicked first base, current selectedBase:', selectedBase)
      setSelectedBase('first')
      setBaseRunners(prev => ({ ...prev, first: true, second: false, third: false, home: false }))
      return
    }
    
    // Second base (top) - Fixed coordinates to match drawing
    if (x >= centerX - baseSize / 2 && 
        x <= centerX + baseSize / 2 &&
        y >= diamondY - diamondSize / 2 - baseSize / 2 && 
        y <= diamondY - diamondSize / 2 + baseSize / 2) {
      console.log('Clicked second base, current selectedBase:', selectedBase)
      setSelectedBase('second')
      setBaseRunners(prev => ({ ...prev, first: false, second: true, third: false, home: false }))
      return
    }
    
    // Third base (left)
    if (x >= centerX - diamondSize / 2 - baseSize / 2 && 
        x <= centerX - diamondSize / 2 + baseSize / 2 &&
        y >= diamondY - baseSize / 2 && 
        y <= diamondY + baseSize / 2) {
      console.log('Clicked third base, current selectedBase:', selectedBase)
      setSelectedBase('third')
      setBaseRunners(prev => ({ ...prev, first: false, second: false, third: true, home: false }))
      return
    }
    
    // Home plate - Fixed coordinates to match drawing
    const homePlateSize = diamondSize * 0.08
    if (x >= centerX - homePlateSize && 
        x <= centerX + homePlateSize &&
        y >= diamondY + diamondSize / 2 && 
        y <= diamondY + diamondSize / 2 + homePlateSize) {
      console.log('Clicked home plate, current selectedBase:', selectedBase)
      setSelectedBase('home')
      setBaseRunners(prev => ({ ...prev, first: false, second: false, third: false, home: true }))
      return
    }
    
    // Base selection only - no drawing
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // This will be called by handleCanvasClick if not clicking on a base
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const currentX = clientX - rect.left
    const currentY = clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(lastPoint.x, lastPoint.y)
    ctx.lineTo(currentX, currentY)
    ctx.stroke()

    setLastPoint({ x: currentX, y: currentY })
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw baseball field design
      drawBaseballField(ctx, canvas.width, canvas.height, baseRunners, runScored)

    // Draw count in top right corner
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`${count.balls}-${count.strikes}`, canvas.width - 15, 30)
    
    // Draw pitch count underneath
    ctx.font = 'bold 14px Arial'
    ctx.fillText(`Pitches: ${pitchCount}`, canvas.width - 15, 55)
    
    // Draw foul count if any
    if (count.fouls > 0) {
      ctx.font = 'bold 12px Arial'
      ctx.fillText(`Fouls: ${count.fouls}`, canvas.width - 15, 75)
    }

    // Reset for drawing
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 4
  }

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
  }

  const cancelWalk = () => {
    setShowWalkConfirm(false)
    setCount(prev => ({ ...prev, balls: prev.balls - 1 }))
  }

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

  const getLeftFieldArea = (x: number, y: number): string => {
    // Left field precision mapping
    const depth = y < 20 ? 'DEEP' : y < 35 ? 'MEDIUM' : 'SHALLOW'
    const angle = x < 10 ? 'LINE' : x < 20 ? 'GAP' : 'CENTER'
    return `LEFT_FIELD_${depth}_${angle}`
  }

  const getCenterFieldArea = (x: number, y: number): string => {
    // Center field precision mapping
    const depth = y < 20 ? 'DEEP' : y < 35 ? 'MEDIUM' : 'SHALLOW'
    const angle = x < 10 ? 'LEFT_GAP' : x < 20 ? 'CENTER' : 'RIGHT_GAP'
    return `CENTER_FIELD_${depth}_${angle}`
  }

  const getRightFieldArea = (x: number, y: number): string => {
    // Right field precision mapping
    const depth = y < 20 ? 'DEEP' : y < 35 ? 'MEDIUM' : 'SHALLOW'
    const angle = x < 10 ? 'CENTER' : x < 20 ? 'GAP' : 'LINE'
    return `RIGHT_FIELD_${depth}_${angle}`
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
    
    // Update base runners
    setBaseRunners(newBaseRunners)
    
    // Close the outcome selection modal
    setShowOutcomeSelection(false)
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
    
    onSave(handwritingInput || 'DRAWING_SAVED', finalBaseRunners, fieldLocationData || undefined, baseRunnerOuts, baseRunnerOutTypes)
    
    // Mark out as saved so button can't be clicked again
    if (isOut) {
      setOutSaved(true)
    }
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
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 hidden sm:block">
            Draw on the diamond: K for strikeout, 6-3 for groundout, arrows for base paths, etc.
          </p>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-2 sm:p-6 flex items-center justify-center bg-gray-50 overflow-auto">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={600}
              height={600}
              className="border border-gray-300 rounded-lg bg-white cursor-pointer max-w-full max-h-full w-auto h-auto"
              style={{ width: 'min(100vw - 2rem, 400px)', height: 'min(100vw - 2rem, 400px)' }}
              onClick={handleCanvasClick}
              onTouchEnd={(e) => {
                e.preventDefault()
                const touch = e.changedTouches[0]
                const mouseEvent = new MouseEvent('click', {
                  clientX: touch.clientX,
                  clientY: touch.clientY,
                  bubbles: true,
                  cancelable: true
                })
                canvasRef.current?.dispatchEvent(mouseEvent)
              }}
            />
            
    {/* Hit/Out Buttons - Top Center (only show for new at-bats and not out and not locked) */}
    {!existingAtBat && !isOut && !isLocked && !atBatLocked && (
      <div className="absolute top-1 sm:top-4 left-1/2 transform -translate-x-1/2 flex space-x-2 sm:space-x-4">
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
        <button
          onClick={() => {
            setShowFieldSelection(true)
            setSelectedFieldArea('OUT')
          }}
          className="bg-red-600 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-red-700 active:bg-red-800 shadow-lg"
        >
          Out
        </button>
      </div>
    )}
    
    {/* Show locked notation for existing at-bats */}
    {existingAtBat && (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
        <div className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg text-sm font-bold border-2 border-gray-300">
          Play: {handwritingInput} (Locked)
        </div>
        {/* Show base runner outs if any */}
        {baseRunnerOuts.first && (
          <div className="mt-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-300">
            Runner Out: {baseRunnerOutTypes.first || 'OUT'} (1st)
          </div>
        )}
        {baseRunnerOuts.second && (
          <div className="mt-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-300">
            Runner Out: {baseRunnerOutTypes.second || 'OUT'} (2nd)
          </div>
        )}
        {baseRunnerOuts.third && (
          <div className="mt-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-300">
            Runner Out: {baseRunnerOutTypes.third || 'OUT'} (3rd)
          </div>
        )}
        {baseRunnerOuts.home && (
          <div className="mt-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-xs font-bold border border-red-300">
            Runner Out: {baseRunnerOutTypes.home || 'OUT'} (Home)
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
              <div className="absolute top-20 left-1 sm:left-4 flex flex-col space-y-2 sm:space-y-4">
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

            {/* Carrera Button - Bottom Right (available for all at-bats except outs, not locked, and not already scored, or when walk occurs) */}
            {!isOut && !isLocked && !runScored && (!atBatLocked || handwritingInput === 'BB') && (
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
                className="bg-green-600 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-sm font-bold hover:bg-green-700 active:bg-green-800 shadow-lg"
              >
                Carrera
              </button>
              </div>
            )}
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

        {/* Field Selection Modal */}
        {showFieldSelection && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-2">
            <div className="bg-white rounded-lg p-3 sm:p-6 max-w-4xl w-full mx-2 sm:mx-4 max-h-[95vh] overflow-auto">
              <h3 className="text-base sm:text-xl font-bold mb-2 sm:mb-4 text-center">
                Click where the ball landed on the field
              </h3>
              
              {/* Simple Field Selection */}
              <div id="field-container" className="relative w-full h-[350px] sm:h-[450px] bg-gradient-to-b from-green-200 to-green-300 border-2 sm:border-4 border-green-800 rounded-lg overflow-hidden">
                
                {/* Foul Lines */}
                <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 5 }}>
                  {/* Left foul line - continues line from home through third base */}
                  <line
                    x1="50%"
                    y1="100%"
                    x2="-50%"
                    y2="0%"
                    stroke="#000000"
                    strokeWidth="2"
                  />
                  {/* Right foul line - continues line from home through first base */}
                  <line
                    x1="50%"
                    y1="100%"
                    x2="150%"
                    y2="0%"
                    stroke="#000000"
                    strokeWidth="2"
                  />
                </svg>
                
                {/* Visual Ball Marker - shows where ball landed */}
                {ballLandingPosition && (
                  <div
                    className="absolute"
                    style={{
                      left: `${ballLandingPosition.x}%`,
                      top: `${ballLandingPosition.y}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 100,
                      pointerEvents: 'none'
                    }}
                  >
                    <div className="w-6 h-6 bg-white border-3 border-black rounded-full shadow-lg flex items-center justify-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                  </div>
                )}
                
                {/* Infield Diamond */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2" style={{ zIndex: 10 }}>
                  <div className="relative w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64">
                    {/* Infield Dirt Area - Diamond shape */}
                    <div 
                      className="absolute inset-0 bg-orange-200 cursor-pointer hover:bg-orange-300 hover:bg-opacity-80 transition-colors"
                      style={{
                        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
                      }}
                      onClick={(e) => handleFieldClick('INFIELD', e)}
                      title="Infield"
                    >
                      {/* Diamond outline */}
                      <div className="absolute inset-0 border-2 border-gray-600"></div>
                      
                      {/* Base paths - SVG for diamond shape */}
                      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 11 }}>
                        {/* Home to First Base (bottom to right) */}
                        <line
                          x1="50%"
                          y1="100%"
                          x2="100%"
                          y2="50%"
                          stroke="#374151"
                          strokeWidth="2"
                        />
                        
                        {/* First to Second Base (right to top) */}
                        <line
                          x1="100%"
                          y1="50%"
                          x2="50%"
                          y2="0%"
                          stroke="#374151"
                          strokeWidth="2"
                        />
                        
                        {/* Second to Third Base (top to left) */}
                        <line
                          x1="50%"
                          y1="0%"
                          x2="0%"
                          y2="50%"
                          stroke="#374151"
                          strokeWidth="2"
                        />
                        
                        {/* Third to Home Base (left to bottom) */}
                        <line
                          x1="0%"
                          y1="50%"
                          x2="50%"
                          y2="100%"
                          stroke="#374151"
                          strokeWidth="2"
                        />
                      </svg>
                      
                      {/* Large, Clear Bases positioned at diamond corners */}
                      {/* Home Plate (bottom point) */}
                      <div 
                        className="absolute bg-white border-4 border-black shadow-lg"
                        style={{
                          left: '50%',
                          bottom: '0%',
                          width: '24px',
                          height: '24px',
                          transform: 'translate(-50%, 50%)',
                          zIndex: 20
                        }}
                      ></div>
                      
                      {/* First Base (right point) */}
                      <div 
                        className="absolute bg-white border-4 border-black shadow-lg"
                        style={{
                          right: '0%',
                          top: '50%',
                          width: '24px',
                          height: '24px',
                          transform: 'translate(50%, -50%)',
                          zIndex: 20
                        }}
                      ></div>
                      
                      {/* Second Base (top point) */}
                      <div 
                        className="absolute bg-white border-4 border-black shadow-lg"
                        style={{
                          left: '50%',
                          top: '0%',
                          width: '24px',
                          height: '24px',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 20
                        }}
                      ></div>
                      
                      {/* Third Base (left point) */}
                      <div 
                        className="absolute bg-white border-4 border-black shadow-lg"
                        style={{
                          left: '0%',
                          top: '50%',
                          width: '24px',
                          height: '24px',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 20
                        }}
                      ></div>
                      
                      {/* Pitcher's Mound */}
                      <div 
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-orange-300 rounded-full border border-gray-600"
                        style={{ zIndex: 11 }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                {/* Ultra-Precise Outfield Mapping */}
                <div className="absolute inset-0">
                  {/* Left Field - precise clickable areas covering entire outfield */}
                  <div className="absolute top-0 left-0 w-1/3" style={{ height: '70%', zIndex: 6 }}>
                    {Array.from({ length: 70 }, (_, row) => 
                      Array.from({ length: 20 }, (_, col) => {
                        const x = (col / 20) * 100
                        const y = (row / 70) * 100
                        const area = getLeftFieldArea(x, y)
                        
                        return (
                          <div
                            key={`left-${row}-${col}`}
                            className="absolute cursor-pointer hover:bg-green-400 hover:bg-opacity-50 transition-colors"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              width: '5%',
                              height: '2%'
                            }}
                            onClick={(e) => handleFieldClick(area, e)}
                            title={area}
                          />
                        )
                      })
                    )}
                  </div>
                  
                  {/* Center Field - precise clickable areas covering entire outfield */}
                  <div className="absolute top-0 left-1/3 w-1/3" style={{ height: '70%', zIndex: 6 }}>
                    {Array.from({ length: 70 }, (_, row) => 
                      Array.from({ length: 20 }, (_, col) => {
                        const x = (col / 20) * 100
                        const y = (row / 70) * 100
                        const area = getCenterFieldArea(x, y)
                        
                        return (
                          <div
                            key={`center-${row}-${col}`}
                            className="absolute cursor-pointer hover:bg-green-400 hover:bg-opacity-50 transition-colors"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              width: '5%',
                              height: '2%'
                            }}
                            onClick={(e) => handleFieldClick(area, e)}
                            title={area}
                          />
                        )
                      })
                    )}
                  </div>
                  
                  {/* Right Field - precise clickable areas covering entire outfield */}
                  <div className="absolute top-0 right-0 w-1/3" style={{ height: '70%', zIndex: 6 }}>
                    {Array.from({ length: 70 }, (_, row) => 
                      Array.from({ length: 20 }, (_, col) => {
                        const x = (col / 20) * 100
                        const y = (row / 70) * 100
                        const area = getRightFieldArea(x, y)
                        
                        return (
                          <div
                            key={`right-${row}-${col}`}
                            className="absolute cursor-pointer hover:bg-green-400 hover:bg-opacity-50 transition-colors"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              width: '5%',
                              height: '2%'
                            }}
                            onClick={(e) => handleFieldClick(area, e)}
                            title={area}
                          />
                        )
                      })
                    )}
                  </div>
                </div>
                
                {/* Foul Territory */}
                <div 
                  className="absolute bottom-0 left-0 w-1/2 h-1/2 cursor-pointer hover:bg-gray-300 hover:bg-opacity-30 transition-colors"
                  style={{ zIndex: 6 }}
                  onClick={(e) => handleFieldClick('FOUL_LEFT', e)}
                  title="Foul Territory (Left)"
                ></div>
                
                <div 
                  className="absolute bottom-0 right-0 w-1/2 h-1/2 cursor-pointer hover:bg-gray-300 hover:bg-opacity-30 transition-colors"
                  style={{ zIndex: 6 }}
                  onClick={(e) => handleFieldClick('FOUL_RIGHT', e)}
                  title="Foul Territory (Right)"
                ></div>
              </div>
              
              <div className="mt-2 sm:mt-4 flex justify-center">
                <button
                  onClick={() => {
                    setShowFieldSelection(false)
                    setBallLandingPosition(null)
                  }}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600"
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
                      onClick={() => {
                        setHandwritingInput('E')
                        setShowOutcomeSelection(false)
                      }}
                      className="w-full p-3 bg-yellow-100 border-2 border-yellow-600 rounded-lg hover:bg-yellow-200 font-semibold"
                    >
                      Error
                    </button>
                    <button
                      onClick={() => {
                        setHandwritingInput('FC')
                        setShowOutcomeSelection(false)
                      }}
                      className="w-full p-3 bg-orange-100 border-2 border-orange-600 rounded-lg hover:bg-orange-200 font-semibold"
                    >
                      Fielder's Choice
                    </button>
                    <button
                      onClick={() => {
                        setHandwritingInput('BUNT')
                        setShowOutcomeSelection(false)
                      }}
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
                        }}
                        className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                      >
                        BUNT OUT - Bunt Out
                      </button>
                      <button
                        onClick={() => {
                          setHandwritingInput('GO')
                          setIsOut(true)
                          setShowOutcomeSelection(false)
                        }}
                        className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                      >
                        INFIELD OUT - Ground Out
                      </button>
                      <button
                        onClick={() => {
                          setHandwritingInput('E')
                          setShowOutcomeSelection(false)
                        }}
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
                        }}
                        className="w-full p-3 bg-red-100 border-2 border-red-600 rounded-lg hover:bg-red-200 font-semibold"
                      >
                        Fly Out
                      </button>
                      <button
                        onClick={() => {
                          setHandwritingInput('LO')
                          setIsOut(true)
                          setShowOutcomeSelection(false)
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
            onClick={clearCanvas}
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
          {/* Show Save button if no run scored, and either no out OR out not saved yet, or when walk occurs */}
          {!runScored && (!isOut || !outSaved || (atBatLocked && handwritingInput === 'BB')) && (
            <button
              onClick={saveDrawing}
              disabled={isLocked}
              className="px-3 py-1.5 sm:px-6 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLocked ? 'View' : 'Save'}
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
    </div>
  )
}
