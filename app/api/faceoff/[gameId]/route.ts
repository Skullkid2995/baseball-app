import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { isBootstrapAdmin } from '@/lib/permissions'
import { createGame, type LineupInput, type LineupPlayer, type Side } from '@/lib/rules/engine'
import { review, submit, WorkflowError, type Room } from '@/lib/faceoff/workflow'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ gameId: string }> }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function handle(req: NextRequest, ctx: Context) {
  try {
    const { gameId } = await ctx.params
    if (!uuid.test(gameId)) return json({ error: 'Invalid game' }, 400)
    if (req.method === 'POST' && req.headers.get('origin') !== req.nextUrl.origin) return json({ error: 'Invalid request origin' }, 403)
    const session = await createClient()
    const { data: auth, error: authError } = await session.auth.getUser()
    if (authError || !auth.user?.email) return json({ error: 'Sign in to continue' }, 401)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) return json({ error: 'Faceoff setup is incomplete: configure the server-only Supabase key.' }, 503)
    const db = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: me, error: meError } = await db.from('app_users').select('role, active, team_id').ilike('email', auth.user.email.replace(/[\\%_]/g, '\\$&')).maybeSingle()
    if (meError) throw meError
    const admin = isBootstrapAdmin(auth.user.email) || (me?.active && me.role === 'super_admin')
    if (!admin && (!me?.active || me.role !== 'coach')) return json({ error: 'Manager access required' }, 403)
    const { data, error } = await db.from('faceoff_rooms').select('*').eq('game_id', gameId).maybeSingle()
    if (error) return json({ error: 'Faceoff setup is incomplete: apply the manager faceoff database migration.' }, 503)
    const room = data as Room | null
    const side: Side | null = room && me?.team_id === room.home_team_id ? 'home' : room && me?.team_id === room.opponent_team_id ? 'opponent' : null
    if (room && !admin && !side) return json({ error: 'You are not a manager of either team' }, 403)
    if (req.method === 'GET') return json({ room, side, canStart: !!admin, isSuperAdmin: !!admin })
    const raw = await req.text()
    if (raw.length > 500000) return json({ error: 'Submission is too large' }, 413)
    const body = JSON.parse(raw)
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400)
    if (body.action === 'start') {
      if (!admin) return json({ error: 'An administrator must start the shared scorecard' }, 403)
      if (room) return json({ error: 'The shared scorecard already exists' }, 409)
      const { data: game, error: gameError } = await db.from('games').select('*').eq('id', gameId).single()
      if (gameError || !game) return json({ error: 'Game not found' }, 404)
      if (!game.team_id || !game.opponent_team_id || game.team_id === game.opponent_team_id) return json({ error: 'Link two different teams before starting' }, 400)
      if (game.game_status === 'completed') return json({ error: 'Choose an unfinished game' }, 400)
      const { count, error: countError } = await db.from('at_bats').select('id', { count: 'exact', head: true }).eq('game_id', gameId)
      if (countError) throw countError
      if (count) return json({ error: 'Use a new game: importing existing scorebook plays is not supported yet' }, 400)
      if (!['home', 'opponent'].includes(game.batting_first)) return json({ error: 'Choose which team bats first in game preparation' }, 400)
      async function lineup(teamId: string, templateId: string, side: Side): Promise<LineupInput> {
        if (!templateId) throw new WorkflowError('Prepare both lineups first')
        const { data: template, error: te } = await db.from('lineup_templates').select('team_id').eq('id', templateId).single()
        if (te || template?.team_id !== teamId) throw new WorkflowError('Lineup belongs to a different team')
        const { data: slots, error: se } = await db.from('lineup_template_players').select('player_id, position, batting_order, batting_for').eq('template_id', templateId).order('batting_order')
        const { data: roster, error: re } = await db.from('players').select('id, first_name, last_name').eq('team_id', teamId)
        if (se || re) throw new WorkflowError('Could not load the lineup')
        const player = (id: string, position: string): LineupPlayer => {
          const p = roster?.find(p => p.id === id)
          if (!p) throw new WorkflowError('Every lineup player must belong to the assigned team')
          return { playerId: p.id, name: `${p.first_name} ${p.last_name}`, position }
        }
        if (!slots || slots.length < 9 || slots.length > 10 || new Set(slots.map(s => s.player_id)).size !== slots.length) throw new WorkflowError('Prepare a complete, unique 9–10 player lineup')
        const batters = slots.map(s => player(s.player_id, s.position))
        const dh = slots.find(s => s.position === 'DH')
        const pitcher = dh?.batting_for ? player(dh.batting_for, 'P') : batters.find(p => p.position === 'P')
        if (!pitcher) throw new WorkflowError('Assign a starting pitcher for both teams')
        return { side, batters, pitcher }
      }
      const [home, opponent, namesResult] = await Promise.all([
        lineup(game.team_id, game.lineup_template_id, 'home'),
        lineup(game.opponent_team_id, game.opponent_lineup_template_id, 'opponent'),
        db.from('teams').select('id, name').in('id', [game.team_id, game.opponent_team_id]),
      ])
      if (namesResult.error) throw namesResult.error
      const initial: Room = { game_id: gameId, version: 0, home_team_id: game.team_id, opponent_team_id: game.opponent_team_id,
        names: { home: namesResult.data.find(t => t.id === game.team_id)?.name || 'Home', opponent: namesResult.data.find(t => t.id === game.opponent_team_id)?.name || 'Opponent' },
        state: createGame({ battingFirst: game.batting_first, lineups: { home, opponent } }), pending: null, history: [] }
      const { error: ie } = await db.from('faceoff_rooms').insert(initial)
      if (ie?.code === '23505') return json({ error: 'The room was already started; refresh' }, 409)
      if (ie) throw ie
      return json({ ok: true })
    }
    if (!room) return json({ error: 'Ask an administrator to start the shared scorecard' }, 404)
    if (!Number.isInteger(body.version) || body.version !== room.version) return json({ error: 'The game changed. Refresh and review the latest play.' }, 409)
    if (typeof body.id !== 'string' || !uuid.test(body.id)) return json({ error: 'Invalid play identifier' }, 400)
    const adminTest = !!admin && ['home', 'opponent'].includes(body.testSide)
    const actor = { id: auth.user.id, side: adminTest ? body.testSide as Side : side, adminTest }
    let next: Room
    if (body.action === 'submit') next = submit(room, actor, body, new Date().toISOString())
    else if (body.action === 'accept' || body.action === 'correct') next = review(room, actor, body.id, body.action === 'accept', typeof body.note === 'string' ? body.note : '', new Date().toISOString())
    else return json({ error: 'Unknown action' }, 400)
    // Atomic compare-and-swap: two devices can never accept the same version twice.
    const { data: saved, error: saveError } = await db.from('faceoff_rooms').update({ version: next.version, state: next.state, pending: next.pending, history: next.history }).eq('game_id', gameId).eq('version', room.version).select('version').maybeSingle()
    if (saveError) throw saveError
    if (!saved) return json({ error: 'Another device updated this game. Refresh before retrying.' }, 409)
    return json({ ok: true })
  } catch (e) {
    if (e instanceof WorkflowError || e instanceof SyntaxError) return json({ error: e.message }, 400)
    console.error('Faceoff request failed', e)
    return json({ error: 'Could not save or load the shared scorecard. Please retry.' }, 500)
  }
}
export const GET = handle
export const POST = handle
