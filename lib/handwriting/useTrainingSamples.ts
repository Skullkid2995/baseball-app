'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadTrainingSamples, templatesFor, type TrainingSample } from './templates'
const UPDATED = 'scorecard-training-updated'
export function notifyTrainingSaved() {
  window.dispatchEvent(new Event(UPDATED))
  try { localStorage.setItem(UPDATED, String(Date.now())) } catch { /* Polling still refreshes other tabs. */ }
}
export function useTrainingSamples() {
  const [samples, setSamples] = useState<TrainingSample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const active = useRef(false)
  const inFlight = useRef<Promise<void> | null>(null)
  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current
    inFlight.current = (async () => {
      try {
        const rows = await loadTrainingSamples((from, to) => supabase.from('handwriting_samples')
          .select('id, writer, symbol, strokes, recognized, correct, pointer_type')
          .order('created_at').order('id').range(from, to))
        if (active.current) {
          setSamples(prev => JSON.stringify(prev) === JSON.stringify(rows) ? prev : rows)
          setError('')
        }
      } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Could not load training samples.') }
      finally { if (active.current) setLoading(false); inFlight.current = null }
    })()
    return inFlight.current
  }, [])
  useEffect(() => {
    active.current = true
    void refresh()
    const update = () => { if (document.visibilityState === 'visible') void refresh() }
    const storage = (e: StorageEvent) => { if (e.key === UPDATED) update() }
    const timer = window.setInterval(update, 30000)
    window.addEventListener(UPDATED, update)
    window.addEventListener('storage', storage)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      active.current = false
      clearInterval(timer)
      window.removeEventListener(UPDATED, update)
      window.removeEventListener('storage', storage)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [refresh])
  const templates = useMemo(() => templatesFor(samples), [samples])
  return { samples, templates, loading, error, refresh }
}
