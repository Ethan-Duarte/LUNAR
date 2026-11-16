import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {dsnCovers,stationAccess,type DsnTable} from './dsn'
import {computeHorizon} from '../lib/horizon'
import {outageDurationLabel} from './BaseComparison'
it('never extrapolates DSN and applies both terrestrial and lunar terrain gates',()=>{
 const data=new Float32Array([384400,0,0,20,384400,0,0,20]),table:DsnTable={start:0,stepMs:1000,count:2,stations:[{name:'test'}],data},h=computeHorizon({terrains:[],global:{width:4,height:2,h:new Float32Array(8)}},0,0,{azStepDeg:90,maxRangeKm:1});
 expect(dsnCovers(table,-1,0)).toBe(false);expect(stationAccess(table,-1,0,0,2,h)).toBeNull();expect(stationAccess(table,500,0,0,2,h)).toEqual([true]);data[3]=data[7]=5;expect(stationAccess(table,500,0,0,2,h)).toEqual([false]);data[3]=data[7]=20;h.elevDeg.fill(90);expect(stationAccess(table,500,0,10,2,h)).toEqual([false]);
})
it('retains the independently checked station sample evidence',()=>{
 const j=JSON.parse(readFileSync(new URL('../../../qa/v17/dsn_horizons.json',import.meta.url),'utf8'));expect(j.checks).toHaveLength(12);expect(j.maxErrorDeg).toBeLessThanOrEqual(.05);expect(j.status).toBe('PASS');
})
it('labels boundary-touching outages as observed lower bounds',()=>{expect(outageDurationLabel(0,3,10,60)).toContain('at least 3.00');expect(outageDurationLabel(2,5,10,60)).toBe('3.00 h');expect(outageDurationLabel(7,10,10,60)).toContain('window boundary')})
