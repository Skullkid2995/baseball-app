'use client'
import { useState } from 'react'
import { mlbPlayer } from '@/lib/mlb/stats'

const teams = [{ id: 114, name: 'Cleveland Guardians', color: '#b52232' }, { id: 139, name: 'Tampa Bay Rays', color: '#092c5c' }]
export function mlbTeam(name: string) { return teams.find(t => t.name.toLowerCase() === name.replace(/\s*·\s*PRUEBA\s*$/i, '').trim().toLowerCase()) }
/** Zero is a legitimate jersey number; null means unconfirmed. */
export function jerseyLabel(number: number | null | undefined, team: string): string | null {
  void team
  return number == null ? null : String(number)
}
export function MlbTeamLogo({ name, className = 'size-9' }: { name: string; className?: string }) {
  const [failed, setFailed] = useState(false), team = mlbTeam(name)
  if (!team || failed) return <span aria-hidden="true" className={'inline-flex shrink-0 items-center justify-center font-black ' + className}>{name.trim().slice(0, 1).toUpperCase()}</span>
  // Official MLB CDN; a native image keeps the lightweight logo usable without an image proxy.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://www.mlbstatic.com/team-logos/${team.id}.svg`} alt={team.name} width={48} height={48} loading="lazy" onError={() => setFailed(true)} className={'shrink-0 object-contain ' + className} />
}
export function MlbPortrait({ name, team, className = 'size-12' }: { name: string; team: string; className?: string }) {
  const [failed, setFailed] = useState(false), player = mlbPlayer(name, team)
  if (!player || failed) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${player.id}/headshot/67/current`} alt={name} width={96} height={96} loading="lazy" onError={() => setFailed(true)} className={'shrink-0 rounded-xl border border-slate-300 bg-white object-cover object-top ' + className} />
}
