// Explicitly scoped to the owner's MLB practice game. Dry-run unless --apply is supplied.
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd())
const gameId = 'adb12cab-e37a-4254-91e6-09d3ef9fd92a'
const apply = process.argv.includes('--apply')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data }
const get = async url => { const res = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (!res.ok) throw new Error(`MLB HTTP ${res.status}`); return res.json() }
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const positionNames = { P: 'Pitcher (P)', C: 'Catcher (C)', '1B': 'First Base (1B)', '2B': 'Second Base (2B)', '3B': 'Third Base (3B)', SS: 'Shortstop (SS)', LF: 'Left Field (LF)', CF: 'Center Field (CF)', RF: 'Right Field (RF)', DH: 'Designated Hitter (DH)' }
const game = check(await db.from('games').select('id,team_id,opponent_team_id,game_date').eq('id', gameId).single())
const teams = check(await db.from('teams').select('id,name').in('id', [game.team_id, game.opponent_team_id]))
if (teams.length !== 2 || !['Tampa Bay Rays · PRUEBA', 'Cleveland Guardians · PRUEBA'].every(name => teams.some(t => t.name === name))) throw new Error('Practice team identity mismatch')
const existing = check(await db.from('players').select('id,team_id,first_name,last_name,jersey_number,date_of_birth,positions,handedness,batting_hand,throwing_hand,height_inches,weight_lbs,debut_date,photo_url').in('team_id', teams.map(t => t.id)))
const officialTeams = [{ id: 114, name: 'Cleveland Guardians' }, { id: 139, name: 'Tampa Bay Rays' }]
const rosters = await Promise.all(officialTeams.map(async t => ({ ...t, ...(await get(`https://statsapi.mlb.com/api/v1/teams/${t.id}/roster?rosterType=active&date=${game.game_date}`)) })))
if (rosters.some(t => !t.roster?.length || t.roster.length > 40)) throw new Error('Unexpected official roster size')
const all = rosters.flatMap(t => t.roster.map(r => ({ ...r, team: t.name })))
const profiles = (await get(`https://statsapi.mlb.com/api/v1/people?personIds=${all.map(r => r.person.id).join(',')}`)).people
const changes = all.map(r => {
  const p = profiles.find(p => p.id === r.person.id), team = teams.find(t => t.name === `${r.team} · PRUEBA`)
  if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) || !positionNames[r.position.abbreviation]) throw new Error(`Incomplete official profile: ${r.person.fullName}`)
  const matches = existing.filter(x => x.team_id === team.id && normalize(`${x.first_name} ${x.last_name}`) === normalize(p.fullName))
  if (matches.length > 1) throw new Error(`Ambiguous local identity: ${p.fullName}`)
  const number = String(r.jerseyNumber ?? p.primaryNumber ?? '')
  const height = /^(\d+)'\s*(\d+)/.exec(p.height ?? '')
  const payload = {
    jersey_number: /^\d+$/.test(number) ? Number(number) : null, date_of_birth: p.birthDate,
    positions: [positionNames[r.position.abbreviation]],
    handedness: ({ L: 'Lefty', R: 'Righty', S: 'Switch' })[p.batSide?.code] ?? 'Righty',
    batting_hand: ['L', 'R', 'S'].includes(p.batSide?.code) ? p.batSide.code : null,
    throwing_hand: ['L', 'R'].includes(p.pitchHand?.code) ? p.pitchHand.code : null,
    height_inches: height ? Number(height[1]) * 12 + Number(height[2]) : null,
    weight_lbs: Number.isInteger(p.weight) ? p.weight : null, debut_date: p.mlbDebutDate?.slice(0, 10) ?? null,
    photo_url: `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${p.id}/headshot/67/current`,
  }
  if (!payload.batting_hand || !payload.throwing_hand) throw new Error(`Unconfirmed handedness: ${p.fullName}`)
  const parts = p.fullName.split(' ')
  return { officialId: p.id, name: p.fullName, team: r.team, teamId: team.id, existingId: matches[0]?.id, payload,
    insert: { ...payload, first_name: parts[0], last_name: parts.slice(1).join(' '), team_id: team.id, is_active: true } }
})
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', gameId, date: game.game_date, updates: changes.filter(c => c.existingId).length, additions: changes.filter(c => !c.existingId).length, teams: rosters.map(t => ({ name: t.name, active: t.roster.length, pitchers: t.roster.filter(r => r.position.abbreviation === 'P').length })) }))
await fs.mkdir('tmp', { recursive: true })
await fs.writeFile(`tmp/mlb-profile-plan${apply ? '-applied' : ''}.json`, JSON.stringify({ retrievedAt: new Date().toISOString(), before: existing, changes }, null, 2))
if (apply) {
  for (const c of changes) {
    const result = c.existingId ? await db.from('players').update(c.payload).eq('id', c.existingId).eq('team_id', c.teamId).select('id').single() : await db.from('players').insert(c.insert).select('id').single()
    check(result)
  }
  const verified = check(await db.from('players').select('id,team_id,first_name,last_name,jersey_number,date_of_birth,photo_url').in('team_id', teams.map(t => t.id)))
  for (const c of changes) {
    const row = verified.find(x => x.team_id === c.teamId && normalize(`${x.first_name} ${x.last_name}`) === normalize(c.name))
    if (!row || row.jersey_number !== c.payload.jersey_number || row.date_of_birth !== c.payload.date_of_birth || row.photo_url !== c.payload.photo_url) throw new Error(`Verification failed: ${c.name}`)
  }
  await fs.writeFile('lib/mlb/players.json', JSON.stringify(changes.map(c => ({ id: c.officialId, name: c.name, team: c.team })).sort((a, b) => a.id - b.id), null, 2) + '\n')
  console.log(`Verified ${changes.length} official profiles; existing lineup slots and game scores were preserved.`)
}
