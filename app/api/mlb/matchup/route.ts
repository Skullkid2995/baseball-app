import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getAccessStatus } from '@/lib/access'
import { loadMlbMatchup, mlbPlayerById } from '@/lib/mlb/stats'

export const maxDuration = 30
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams
  const batter = mlbPlayerById(Number(query.get('batter')))
  const pitcher = query.has('pitcher') ? mlbPlayerById(Number(query.get('pitcher'))) : null
  const season = Number(query.get('season'))
  if (!batter || (query.has('pitcher') && !pitcher) || !Number.isInteger(season) || season < 1876 || season > new Date().getFullYear() + 1) {
    return NextResponse.json({ error: 'Invalid MLB player or season' }, { status: 400 })
  }
  try {
    const db = await createClient()
    const { data, error } = await db.auth.getUser()
    if (error || !data.user) return NextResponse.json({ error: 'Sign in to view stats' }, { status: 401 })
    const access = await getAccessStatus(db, data.user.email)
    if (access !== 'authorized') return NextResponse.json({ error: 'Stats access unavailable' }, { status: access === 'unavailable' ? 503 : 403 })
    const result = await loadMlbMatchup(batter, pitcher, season, async url => {
      const response = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error('MLB request failed')
      const json = await response.json()
      if (!Array.isArray(json.stats)) throw new Error('Invalid MLB response')
      return json
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'MLB statistics are temporarily unavailable. Try again.' }, { status: 502 })
  }
}
