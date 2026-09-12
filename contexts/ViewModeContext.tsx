'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

/**
 * auto    – layout follows the screen size (default)
 * mobile  – always the phone/tablet layout: drawer menu, single column, narrow content
 * desktop – always the desktop layout: fixed sidebar, wide content
 */
export type ViewMode = 'auto' | 'mobile' | 'desktop'

interface ViewModeContextType {
  mode: ViewMode
  setMode: (mode: ViewMode) => void
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined)
const STORAGE_KEY = 'viewMode'

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>('auto')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
      if (saved === 'auto' || saved === 'mobile' || saved === 'desktop') {
        setModeState(saved)
      }
    } catch {
      // storage unavailable (private mode); keep the default
    }
  }, [])

  // Expose the mode to CSS so global rules can collapse grids in mobile mode
  useEffect(() => {
    document.documentElement.dataset.view = mode
  }, [mode])

  const setMode = (next: ViewMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return <ViewModeContext.Provider value={{ mode, setMode }}>{children}</ViewModeContext.Provider>
}

export function useViewMode() {
  const context = useContext(ViewModeContext)
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider')
  }
  return context
}
