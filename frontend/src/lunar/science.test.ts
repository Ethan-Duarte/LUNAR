import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {batteryKWh,closestSample,exportCSV,intervals,studyFromResponse,type Study} from './science'
const get=(id:string):Study=>JSON.parse(readFileSync(new URL(`../../public/lunar/data/sites/${id}.json`,import.meta.url),'utf8'))
describe('LUNAR saved-study integration',()=>{
 it('unwraps the real science-server contract and rejects incomplete results',()=>{const s=get('ridge-2m');expect(studyFromResponse({site:s,science_version:'0.10.0'})).toBe(s);expect(()=>studyFromResponse(s)).toThrow('incomplete study');expect(()=>studyFromResponse({error:'failed'})).toThrow('incomplete study')})
 for(const id of ['ridge-2m','ridge-10m','earth-control']){
  const s=get(id)
  it(`${id}: event bands preserve published durations and full coverage`,()=>{
   const a=Date.parse(s.study.start_utc),b=Date.parse(s.study.end_utc)
   for(const body of ['sun','earth'] as const){const q=intervals(s,body);expect(q[0].start).toBe(a);expect(q.at(-1)?.end).toBe(b);for(let i=1;i<q.length;i++)expect(q[i].start).toBe(q[i-1].end);expect(q.reduce((v,r)=>v+(r.on?r.end-r.start:0),0)/(b-a)).toBeCloseTo(s.metrics[body+'_fraction' as 'sun_fraction'|'earth_fraction'],5)}
  })
  it(`${id}: nearest sample clamps and CSV retains every output`,()=>{expect(closestSample(s,0)).toBe(s.samples[0]);expect(closestSample(s,Infinity)).toBe(s.samples.at(-1));const i=100;expect(closestSample(s,Date.parse(s.samples[i].time)+1000)).toBe(s.samples[i]);expect(exportCSV(s).split('\n')).toHaveLength(s.samples.length+1)})
 }
 it('darkness budget is dimensionally W × hours / 1000 / usable fraction',()=>{const s=get('ridge-2m');expect(batteryKWh(s,100,.8)).toBeCloseTo(14.83723958,6);expect(batteryKWh(s,0,.8)).toBe(0)})
})
