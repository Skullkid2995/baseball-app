// Owner-requested setup for the 2026 Brewers–Rays World Series. Dry-run by default.
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd())
const apply = process.argv.includes('--apply')
const oldId = 'adb12cab-e37a-4254-91e6-09d3ef9fd92a', today = '2026-10-23'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data }
const get = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(`MLB ${r.status}`); return r.json() }
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const positionNames = { P: 'Pitcher (P)', C: 'Catcher (C)', '1B': 'First Base (1B)', '2B': 'Second Base (2B)', '3B': 'Third Base (3B)', SS: 'Shortstop (SS)', LF: 'Left Field (LF)', CF: 'Center Field (CF)', RF: 'Right Field (RF)', DH: 'Designated Hitter (DH)' }
const specs = [{ id: 139, name: 'Tampa Bay Rays', city: 'St. Petersburg', stadium: 'Tropicana Field' }, { id: 158, name: 'Milwaukee Brewers', city: 'Milwaukee', stadium: 'American Family Field' }]
const schedule = await get(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=139&startDate=${today}&endDate=2026-11-02&hydrate=probablePitcher,venue`)
const games = schedule.dates.flatMap(d => d.games).filter(g => g.gameType === 'W' && [139, 158].includes(g.teams.home.team.id) && [139, 158].includes(g.teams.away.team.id)).sort((a,b) => a.seriesGameNumber - b.seriesGameNumber)
if (games.length !== 7 || games[0].officialDate !== today || games.some((g,i) => g.seriesGameNumber !== i+1 || !g.gameDate)) throw new Error('Unexpected World Series schedule')
const box = await get(`https://statsapi.mlb.com/api/v1/game/${games[0].gamePk}/boxscore`)
const rosters = await Promise.all(specs.map(async s => ({ ...s, roster: (await get(`https://statsapi.mlb.com/api/v1/teams/${s.id}/roster?rosterType=active&date=${today}`)).roster })))
if (rosters.some(s => s.roster?.length !== 26)) throw new Error('Expected two official 26-player active rosters')
const profiles = (await get(`https://statsapi.mlb.com/api/v1/people?personIds=${rosters.flatMap(t => t.roster.map(r => r.person.id)).join(',')}`)).people
// MLB's Game 1 preview, used only when official boxscore batting orders are still empty.
const projected = {
  139: [[650490,'DH'],[666018,'1B'],[691406,'3B'],[689414,'C'],[802415,'LF'],[683748,'RF'],[676356,'CF'],[680700,'2B'],[670764,'SS']],
  158: [[694192,'LF'],[668930,'2B'],[661388,'C'],[641343,'1B'],[592885,'DH'],[669003,'CF'],[806198,'SS'],[686217,'RF'],[666152,'3B']],
}
const starting = {}, lineupStatus = {}
for (const side of ['home','away']) {
  const teamId = games[0].teams[side].team.id, official = box.teams?.[side]
  const order = official?.battingOrder ?? []
  starting[teamId] = order.length === 9 ? order.map(id => [id, official.players[`ID${id}`]?.position?.abbreviation]) : projected[teamId]
  lineupStatus[teamId] = order.length === 9 ? 'confirmed' : 'projected'
  if (!starting[teamId] || new Set(starting[teamId].map(x=>x[0])).size !== 9 || new Set(starting[teamId].map(x=>x[1])).size !== 9) throw new Error('Invalid starting lineup')
  if (!games[0].teams[side].probablePitcher?.id) throw new Error('Missing Game 1 starter')
}
const league = check(await db.from('leagues').select('id,name').eq('name','MLB · Pruebas de anotación').single())
const teamsBefore = check(await db.from('teams').select('*').eq('league_id',league.id))
const old = check(await db.from('games').select('*').eq('id',oldId).maybeSingle())
if (old && (old.game_date !== '2026-10-19' || old.opponent !== 'Cleveland Guardians · PRUEBA')) throw new Error('Old game identity mismatch')
const oldRows = {}
if (old) for (const table of ['at_bats','game_pitchers','scorecard_ink','scorecard_player_changes','faceoff_rooms','runner_events']) {
  const result = await db.from(table).select('*').eq('game_id',oldId)
  if (result.error && ['42P01','PGRST205'].includes(result.error.code)) continue
  oldRows[table] = check(result)
}
if (oldRows.at_bats?.length || (old && (old.our_score || old.opponent_score))) throw new Error('The old game has scoring data; review before replacing it')
const dateTime = date => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Tijuana',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(new Date(date)).map(p=>[p.type,p.value]))
  return { date:`${parts.year}-${parts.month}-${parts.day}`, time:`${parts.hour}:${parts.minute}:00` }
}
const plan = { fetchedAt:new Date().toISOString(), old, oldRows, schedule:games, lineupStatus, starting, rosters, profiles }
await fs.mkdir('tmp',{recursive:true})
await fs.writeFile(`tmp/world-series-${apply?'apply':'plan'}.json`,JSON.stringify(plan,null,2))
console.log(JSON.stringify({mode:apply?'apply':'dry-run',oldGame:old?.id,oldAtBats:oldRows.at_bats?.length??0,lineups:lineupStatus,starters:games[0].teams,games:games.map(g=>({game:g.seriesGameNumber,...dateTime(g.gameDate),home:g.teams.home.team.name,away:g.teams.away.team.name,conditional:g.seriesGameNumber>=5}))}))
if (!apply) process.exit(0)
const localTeams = {}, playerIds = {}, currentRosterIds = {}
let added = 0, updated = 0
for (const team of rosters) {
  let local = teamsBefore.find(t=>t.name===`${team.name} · PRUEBA`)
  const teamPayload = { name:`${team.name} · PRUEBA`,city:team.city,stadium:team.stadium,league_id:league.id,logo_url:`https://www.mlbstatic.com/team-logos/${team.id}.svg` }
  local = local ? check(await db.from('teams').update(teamPayload).eq('id',local.id).select('*').single()) : check(await db.from('teams').insert(teamPayload).select('*').single())
  localTeams[team.id] = local; playerIds[team.id] = {}; currentRosterIds[team.id] = []
  const existing = check(await db.from('players').select('id,first_name,last_name,is_active').eq('team_id',local.id))
  for (const r of team.roster) {
    const p = profiles.find(p=>p.id===r.person.id)
    if (!p?.birthDate || !positionNames[r.position.abbreviation] || !['L','R','S'].includes(p.batSide?.code) || !['L','R'].includes(p.pitchHand?.code)) throw new Error('Incomplete official profile')
    const matches = existing.filter(x=>norm(`${x.first_name} ${x.last_name}`)===norm(p.fullName))
    if (matches.length>1) throw new Error(`Duplicate local identity: ${p.fullName}`)
    const height = /^(\d+)'\s*(\d+)/.exec(p.height??'')
    const n = String(r.jerseyNumber??p.primaryNumber??'')
    const payload = { jersey_number:/^\d+$/.test(n)?Number(n):null,date_of_birth:p.birthDate,positions:[positionNames[r.position.abbreviation]],handedness:({L:'Lefty',R:'Righty',S:'Switch'})[p.batSide.code],batting_hand:p.batSide.code,throwing_hand:p.pitchHand.code,height_inches:height?Number(height[1])*12+Number(height[2]):null,weight_lbs:Number.isInteger(p.weight)?p.weight:null,debut_date:p.mlbDebutDate?.slice(0,10)??null,photo_url:`https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${p.id}/headshot/67/current`,is_active:true }
    const parts=p.fullName.split(' ')
    const row=matches[0] ? check(await db.from('players').update(payload).eq('id',matches[0].id).eq('team_id',local.id).select('id').single()) : check(await db.from('players').insert({...payload,team_id:local.id,first_name:parts[0],last_name:parts.slice(1).join(' ')}).select('id').single())
    playerIds[team.id][p.id]=row.id;currentRosterIds[team.id].push(row.id)
    if(matches[0])updated++;else added++
  }
  const inactive = existing.filter(p=>!currentRosterIds[team.id].includes(p.id)).map(p=>p.id)
  if(inactive.length)check(await db.from('players').update({is_active:false}).eq('team_id',local.id).in('id',inactive).select('id'))
}
const templateIds = {}
for (const team of rosters) {
  const side = games[0].teams.home.team.id===team.id?'home':'away'
  const pitcherId = games[0].teams[side].probablePitcher.id
  const existing = check(await db.from('lineup_templates').select('id').eq('team_id',localTeams[team.id].id).maybeSingle())
  const template = existing ?? check(await db.from('lineup_templates').insert({team_id:localTeams[team.id].id,name:'World Series Game 1',description:`MLB Game 1 ${today}; ${lineupStatus[team.id]}; probable starter ${pitcherId}`}).select('id').single())
  templateIds[team.id]=template.id
  const rows=starting[team.id].map(([id,position],index)=>{
    if(!playerIds[team.id][id] || !playerIds[team.id][pitcherId])throw new Error('Lineup player missing from active roster')
    return {template_id:template.id,player_id:playerIds[team.id][id],batting_order:index+1,position,batting_for:position==='DH'?playerIds[team.id][pitcherId]:null}
  })
  const saved = check(await db.from('lineup_template_players').select('player_id,batting_order,position,batting_for').eq('template_id',template.id).order('batting_order'))
  const comparable = rows.map(row=>({player_id:row.player_id,batting_order:row.batting_order,position:row.position,batting_for:row.batting_for}))
  if (JSON.stringify(saved)!==JSON.stringify(comparable)) {
    check(await db.from('lineup_template_players').delete().eq('template_id',template.id).select('id'))
    check(await db.from('lineup_template_players').insert(rows).select('id'))
  }
}
const created = []
for (const g of games) {
  const home = localTeams[g.teams.home.team.id],away=localTeams[g.teams.away.team.id], when=dateTime(g.gameDate)
  const existing=check(await db.from('games').select('*').eq('league_id',league.id).eq('game_date',when.date).eq('team_id',home.id).eq('opponent_team_id',away.id).maybeSingle())
  if(existing){created.push(existing);continue}
  const ready=g.seriesGameNumber===1
  const reserves={}
  if(ready)for(const[localSide,officialSide]of [['home','home'],['opponent','away']]){
    const teamId=g.teams[officialSide].team.id,pitcher=g.teams[officialSide].probablePitcher.id
    const starters=new Set([...starting[teamId].map(x=>x[0]),pitcher])
    const unused=rosters.find(t=>t.id===teamId).roster.filter(r=>!starters.has(r.person.id))
    reserves[localSide]={bench:unused.filter(r=>r.position.abbreviation!=='P').map(r=>playerIds[teamId][r.person.id]),bullpen:unused.filter(r=>r.position.abbreviation==='P').map(r=>playerIds[teamId][r.person.id])}
  }
  const note=ready?`WS G1 · ${lineupStatus[139]==='confirmed'&&lineupStatus[158]==='confirmed'?'Alineaciones oficiales':'Alineaciones proyectadas MLB'} · 17:00 Tijuana`:`WS G${g.seriesGameNumber} · Alineaciones pendientes${g.seriesGameNumber>=5?' · Si es necesario':''}`
  const row=check(await db.from('games').insert({team_id:home.id,opponent_team_id:away.id,opponent:away.name,league_id:league.id,game_date:when.date,game_time:when.time,stadium:g.venue.name,weather_conditions:note,our_score:0,opponent_score:0,innings_played:0,game_status:ready?'in_progress':'scheduled',batting_first:'opponent',lineup_template_id:ready?templateIds[g.teams.home.team.id]:null,opponent_lineup_template_id:ready?templateIds[g.teams.away.team.id]:null,roster_reserves:reserves}).select('*').single())
  if(ready)for(const[side,officialSide]of [['home','home'],['opponent','away']]) check(await db.from('game_pitchers').insert({game_id:row.id,team_side:side,pitcher_id:playerIds[g.teams[officialSide].team.id][g.teams[officialSide].probablePitcher.id],sequence:1,from_inning:1}).select('id'))
  created.push(row)
}
// Verify the replacement and pending games before removing the unused Cleveland test game.
for(const row of created){
  const stored=check(await db.from('games').select('*').eq('id',row.id).single())
  if(stored.our_score||stored.opponent_score)throw new Error('Unexpected scored game; no deletion performed')
  if(stored.game_date!==today&&(stored.lineup_template_id||stored.opponent_lineup_template_id))throw new Error('Future lineup must remain pending')
}
if(old){
  const latest=check(await db.from('at_bats').select('id').eq('game_id',oldId))
  if(latest.length)throw new Error('The old game was scored during setup; deletion stopped')
  check(await db.from('faceoff_rooms').delete().eq('game_id',oldId).select('game_id'))
  const removed=check(await db.from('games').delete().eq('id',oldId).eq('opponent','Cleveland Guardians · PRUEBA').select('id'))
  if(removed.length!==1)throw new Error('Old game deletion was not confirmed')
}
const registry=JSON.parse(await fs.readFile('lib/mlb/players.json','utf8'))
for(const team of rosters)for(const r of team.roster){const p=profiles.find(p=>p.id===r.person.id);if(!registry.some(x=>x.id===p.id&&x.team===team.name))registry.push({id:p.id,name:p.fullName,team:team.name})}
await fs.writeFile('lib/mlb/players.json',JSON.stringify(registry.sort((a,b)=>a.id-b.id),null,2)+'\n')
const result={addedPlayers:added,updatedPlayers:updated,oldGameDeleted:!!old,game1:created[0].id,games:created.map(g=>({id:g.id,date:g.game_date,time:g.game_time,status:g.game_status,home:g.team_id,away:g.opponent,notes:g.weather_conditions,lineup:g.lineup_template_id,opponentLineup:g.opponent_lineup_template_id}))}
await fs.writeFile('tmp/world-series-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
