import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createGame } from '@/lib/rules/engine'
import { demoLineup } from '@/lib/rules/scenarios'
import { submit, type Room } from './workflow'

const mock = vi.hoisted(() => ({
  role: 'coach', team: 'a', email: 'coach@example.com', active: true, userId: 'user-a',
  room: null as unknown, saved: null as unknown, conflict: false,
}))
vi.mock('@/lib/supabase-server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: mock.userId, email: mock.email } }, error: null }) } }) }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (table: string) => {
  let updating = false
  const builder = {
    select: () => builder, ilike: () => builder, eq: () => builder,
    update: (value: unknown) => { mock.saved = value; updating = true; return builder },
    maybeSingle: async () => ({ data: table === 'app_users' ? { active: mock.active, role: mock.role, team_id: mock.team } : updating ? (mock.conflict ? null : { version: 2 }) : mock.room, error: null }),
  }
  return builder
} }) }))
import { GET, POST } from '@/app/api/faceoff/[gameId]/route'
const gameId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const playId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const url = `http://localhost/api/faceoff/${gameId}`
const ctx = { params: Promise.resolve({ gameId }) }
function room(): Room {
  return { game_id: gameId, version: 0, home_team_id: 'a', opponent_team_id: 'b', names: { home: 'A', opponent: 'B' }, pending: null, history: [], state: createGame({ battingFirst: 'home', lineups: { home: demoLineup('home'), opponent: demoLineup('opponent') } }) }
}
function request(body: Record<string, unknown>, origin = 'http://localhost') { return new NextRequest(url, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-placeholder'
  mock.role = 'coach'; mock.team = 'a'; mock.email = 'coach@example.com'; mock.active = true; mock.userId = 'user-a'; mock.room = room(); mock.saved = null; mock.conflict = false
})
describe('faceoff API authorization and concurrency', () => {
  it('does not honor a regular coach forging the admin test flag', async () => {
    mock.room = submit(room(), { id: mock.userId, side: 'home' }, { id: playId, notation: 'HR', ink: [] }, 'now')
    const res = await POST(request({ action: 'accept', id: playId, version: 1, testSide: 'opponent', adminTest: true }), ctx)
    expect(res.status).toBe(400)
    expect(mock.saved).toBeNull()
  })
  it('allows a super admin to validate their own play after switching sides', async () => {
    mock.role = 'super_admin'
    mock.room = submit(room(), { id: mock.userId, side: 'home', adminTest: true }, { id: playId, notation: 'HR', ink: [] }, 'now')
    const res = await POST(request({ action: 'accept', id: playId, version: 1, testSide: 'opponent' }), ctx)
    expect(res.status).toBe(200)
    expect(mock.saved).toMatchObject({ history: [{ adminTest: true, reviewedBy: 'user-a' }], state: { score: { home: 1 } } })
  })
  it('prevents an inactive admin from using the test override', async () => {
    mock.role = 'super_admin'; mock.active = false
    const res = await POST(request({ action: 'submit', id: playId, version: 0, testSide: 'home', notation: 'HR', ink: [] }), ctx)
    expect(res.status).toBe(403)
  })
  it('denies reads by a coach of an unrelated team', async () => {
    mock.team = 'unrelated'
    expect((await GET(new NextRequest(url), ctx)).status).toBe(403)
  })
  it('rejects stale versions and does not write', async () => {
    const res = await POST(request({ action: 'submit', id: playId, version: 99, notation: 'HR', ink: [] }), ctx)
    expect(res.status).toBe(409)
    expect(mock.saved).toBeNull()
  })
  it('returns a conflict when another device wins the atomic update', async () => {
    mock.conflict = true
    const res = await POST(request({ action: 'submit', id: playId, version: 0, notation: 'HR', ink: [] }), ctx)
    expect(res.status).toBe(409)
  })
  it('blocks cross-origin writes', async () => {
    expect((await POST(request({ action: 'submit' }, 'https://other.example'), ctx)).status).toBe(403)
  })
})
