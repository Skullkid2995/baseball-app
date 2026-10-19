import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), access: vi.fn(), load: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/access', () => ({ getAccessStatus: mocks.access }))
vi.mock('@/lib/mlb/stats', async importOriginal => ({ ...await importOriginal<object>(), loadMlbMatchup: mocks.load }))
import { GET } from '@/app/api/mlb/matchup/route'
const request = (query = 'batter=680757&pitcher=642547&season=2026') => new NextRequest(`https://app.test/api/mlb/matchup?${query}`)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { email: 'user@example.test' } }, error: null })
  mocks.access.mockResolvedValue('authorized')
  mocks.load.mockResolvedValue({ regular: { avg: '.282' } })
})
it('does not accept arbitrary remote targets, unlinked players or malformed seasons', async () => {
  expect((await GET(request('batter=1&season=2026'))).status).toBe(400)
  expect((await GET(request('batter=680757&season=oops'))).status).toBe(400)
  expect(mocks.getUser).not.toHaveBeenCalled()
})
it('requires an authorized signed-in account before fetching MLB data', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect((await GET(request())).status).toBe(401)
  expect(mocks.load).not.toHaveBeenCalled()
})
it('returns a recoverable error when authorization cannot be checked', async () => {
  mocks.access.mockResolvedValue('unavailable')
  expect((await GET(request())).status).toBe(503)
  expect(mocks.load).not.toHaveBeenCalled()
})
it('keeps stats private and returns upstream failure without invented fallback values', async () => {
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  mocks.load.mockRejectedValueOnce(new Error('MLB offline'))
  const failure = await GET(request())
  expect(failure.status).toBe(502)
  expect((await failure.json()).regular).toBeUndefined()
})
