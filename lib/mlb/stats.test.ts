import { describe, expect, it } from 'vitest'
import { averageFromLine, battingStats, directionShares, historyDrag, loadMlbMatchup, mlbPlayer, pitchingStats, totalStat } from './stats'

describe('official MLB identity and sample sizes', () => {
  it('links only an explicitly named MLB team and full player name', () => {
    expect(mlbPlayer('Jose Ramirez', 'Cleveland Guardians · PRUEBA')?.id).toBe(608070)
    expect(mlbPlayer('Steven Kwan', 'Local league')).toBeNull()
    expect(mlbPlayer('Steven', 'Cleveland Guardians')).toBeNull()
  })
  it('does not double-count traded players, and filters to the requested pitcher', () => {
    const data = { stats: [{ type: { displayName: 'season' }, splits: [{ stat: { hits: 180, atBats: 600 } }, { team: { id: 1 }, stat: { hits: 100, atBats: 300 } }, { team: { id: 2 }, stat: { hits: 80, atBats: 300 } }] }] }
    expect(battingStats(totalStat(data, 'season'))?.avg).toBe('.300')
    const versus = { stats: [{ type: { displayName: 'vsPlayerTotal' }, splits: [{ pitcher: { id: 1 }, stat: { hits: 1, atBats: 9 } }, { pitcher: { id: 2 }, stat: { hits: 8, atBats: 9 } }] }] }
    expect(battingStats(totalStat(versus, 'vsPlayerTotal', 1))?.hits).toBe(1)
  })
  it('uses AB for hits and PA for walks and strikeouts; zero AB is unavailable', () => {
    const s = battingStats({ hits: 2, atBats: 8, plateAppearances: 10, baseOnBalls: 2, strikeOuts: 3 })!
    expect([s.avg, s.hitPercent, s.walkPercent, s.strikeoutPercent]).toEqual(['.250', 25, 20, 30])
    expect(battingStats({ atBats: 0 })?.avg).toBeNull()
    expect(averageFromLine('0-0')).toBe('—')
    expect(averageFromLine('1-3')).toBe('.333')
  })
  it('calculates pitching with outs, rather than treating 5.2 IP as a decimal', () => {
    const s = pitchingStats({ outs: 17, inningsPitched: '5.2', earnedRuns: 2, hits: 4, baseOnBalls: 1 })!
    expect(s.era).toBe('3.18'); expect(s.whip).toBe('0.88')
  })
  it('does not turn empty spray charts into fabricated percentages', () => {
    const response = (stat: Record<string, unknown>) => ({ stats: [{ type: { displayName: 'sprayChart' }, splits: [{ stat }] }] })
    expect(directionShares(response({}))).toEqual([])
    expect(directionShares(response({ leftField: 20, leftCenterField: 20, centerField: 20, rightCenterField: 20, rightField: 20 }))).toHaveLength(5)
  })
  it('keeps postseason, regular season and career separate; survives partial failure', async () => {
    const urls: string[] = []
    const batter = mlbPlayer('Steven Kwan', 'Cleveland Guardians')!, pitcher = mlbPlayer('Freddy Peralta', 'Tampa Bay Rays')!
    const result = await loadMlbMatchup(batter, pitcher, 2026, async url => {
      urls.push(url)
      const q = new URL(url).searchParams
      if (q.get('stats') === 'sprayChart') throw new Error('unavailable')
      return { stats: [{ type: { displayName: q.get('stats') === 'career' ? 'career' : 'season' }, splits: [{ stat: { hits: q.get('gameType') === 'P' ? 1 : 2, atBats: 4 } }] }] }
    })
    expect(result.regular?.avg).toBe('.500'); expect(result.postseason?.avg).toBe('.250')
    expect(result.career?.avg).toBe('.500'); expect(result.errors).toEqual(['directions', 'versusDirections'])
    expect(urls.some(u => new URL(u).searchParams.get('stats') === 'season,career')).toBe(true)
  })
  it('only interprets a deliberate vertical drag as an open/close request', () => {
    expect(historyDrag(30, 5)).toBe('open'); expect(historyDrag(-30, 5)).toBe('close')
    expect(historyDrag(5, 40)).toBeNull(); expect(historyDrag(8, 2)).toBeNull()
  })
})
