import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd())
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data }
const gameId = 'adb12cab-e37a-4254-91e6-09d3ef9fd92a'
const game = check(await db.from('games').select('team_id,opponent_team_id,lineup_template_id,opponent_lineup_template_id,roster_reserves,updated_at').eq('id', gameId).single())
const teams = check(await db.from('teams').select('id,name').in('id', [game.team_id, game.opponent_team_id]))
if (!['Tampa Bay Rays · PRUEBA', 'Cleveland Guardians · PRUEBA'].every(name => teams.some(t => t.name === name))) throw new Error('Practice team mismatch')
const reserves = { ...game.roster_reserves }
for (const side of ['home', 'opponent']) {
  const teamId = side === 'home' ? game.team_id : game.opponent_team_id, templateId = side === 'home' ? game.lineup_template_id : game.opponent_lineup_template_id
  const roster = check(await db.from('players').select('id,first_name,last_name,positions').eq('team_id', teamId))
  const slots = check(await db.from('lineup_template_players').select('player_id,batting_for').eq('template_id', templateId))
  if (roster.length !== 26 || slots.length !== 9) throw new Error('Expected a 26-player roster and nine batters')
  const starters = new Set(slots.flatMap(s => [s.player_id, s.batting_for].filter(Boolean)))
  const unused = roster.filter(p => !starters.has(p.id)), isPitcher = p => p.positions.some(pos => /^(P|PITCHER)$/i.test(pos) || /\(P\)\s*$/i.test(pos))
  // Preserve selections that the owner has already customized.
  reserves[side] ??= { bench: unused.filter(p => !isPitcher(p)).map(p => p.id), bullpen: unused.filter(isPitcher).map(p => p.id) }
  console.log(JSON.stringify({ side, team: teams.find(t => t.id === teamId).name, bench: reserves[side].bench.length, bullpen: reserves[side].bullpen.length }))
}
if (process.argv.includes('--apply')) {
  await fs.writeFile('tmp/mlb-practice-reserves-before.json', JSON.stringify(game.roster_reserves, null, 2))
  const saved = check(await db.from('games').update({ roster_reserves: reserves }).eq('id', gameId).eq('updated_at', game.updated_at).select('roster_reserves').single())
  for (const side of ['home', 'opponent']) for (const role of ['bench', 'bullpen']) {
    if (JSON.stringify([...saved.roster_reserves[side][role]].sort()) !== JSON.stringify([...reserves[side][role]].sort())) throw new Error('Reserve verification failed')
  }
  console.log('Practice bench and bullpen saved. Batting orders, scores and pitching appearances were preserved.')
}
