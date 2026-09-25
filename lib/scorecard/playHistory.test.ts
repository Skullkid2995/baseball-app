import { describe, it, expect } from 'vitest'
import { playHistory, type SavedRunnerEvent } from './playHistory'
const event = (patch: Partial<SavedRunnerEvent>): SavedRunnerEvent => ({ id:'1',runner_at_bat_id:'ab',event_type:'SB',from_base:'first',to_base:'second',is_out:false,created_at:'2026-09-25T01:00:00Z',...patch })
describe('read-only scorecard history', () => {
  it('keeps the single, stolen second, and out attempting third in order', () => {
    const steps = playHistory({result:'single',notation:'H1',out_type:'CAUGHT_STEALING',base_runner_outs:{second:true}}, [event({id:'2',event_type:'CS',from_base:'second',to_base:'third',is_out:true,created_at:'2026-09-25T02:00:00Z'}),event({})])
    expect(steps.map(s=>[s.code,s.to,s.out])).toEqual([['H1',1,false],['SB',2,false],['CS',3,true]])
  })
  it('does not invent the destination or cause of missing historical advances', () => {
    const steps=playHistory({result:'single',out_type:'TAGGED_OUT',base_runner_outs:{second:true}},[])
    expect(steps[1]).toMatchObject({code:'ADV',to:2,inferred:true})
    expect(steps[2]).toMatchObject({code:'OUT',to:null,inferred:true})
  })
  it('does not draw a strikeout as reaching first', () => {
    expect(playHistory({result:'strikeout',base_runner_outs:{first:true}},[])).toEqual([{code:'K',from:0,to:0,out:true}])
  })
  it('keeps the home-run notation and full path', () => {
    expect(playHistory({result:'home_run',runs_scored:1},[])[0]).toMatchObject({code:'HR',to:4})
  })
})
