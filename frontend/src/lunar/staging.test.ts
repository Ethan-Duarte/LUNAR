import {it,expect} from 'vitest'
import {findDaylight} from './daylight'
import {clockRange,type Ephem} from '../lib/ephem'
import {boundedSpan} from './TimelineControls'
import {comparisonDifferences,failureIntervals,type ComparableReport} from './BaseComparison'
import {DEFAULT_ENGINEERING} from './engineering'
import {sceneGround} from './MissionScene'
const DAY=86400000
function ephem(){const count=160*24,data=new Float32Array(count*8);for(let i=0;i<count;i++)data.set([1,0,0,149597870.7,0,1,0,384400],i*8);return {t0Ms:Date.parse('2026-01-01T00:00:00Z'),stepS:3600,count,data,kernels:[]} satisfies Ephem}
it('finds a clear solar-disc sample and returns no sample for an obstructed horizon',()=>{
 const e=ephem(),time=clockRange(e)[0],h={lat:0,lon:0,observerHeightM:2,azStepDeg:90,elevDeg:new Float32Array(4),distKm:new Float32Array(4)};
 expect(findDaylight(e,h,0,time)).toBe(time);h.elevDeg.fill(90);expect(findDaylight(e,h,0,time)).toBeNull();
})
it('keeps scrub presets within ephemeris bounds without expanding short datasets',()=>{
 expect(boundedSpan(0,7,[0,30*DAY])).toEqual([0,7*DAY]);expect(boundedSpan(30*DAY,7,[0,30*DAY])).toEqual([23*DAY,30*DAY]);expect(boundedSpan(DAY,30,[0,2*DAY])).toEqual([0,2*DAY]);
})
it('flags calculation changes rather than calling unlike scenarios layout improvements',()=>{
 const a={model:'screening',start:1,settings:{...DEFAULT_ENGINEERING},criteria:{earthMaskDeg:0},azimuthStepDeg:2,horizonRadiusKm:100} as ComparableReport;
 expect(comparisonDifferences(a,{...a})).toEqual([]);const b={...a,start:2,settings:{...a.settings,initialSoc:0}};
 expect(comparisonDifferences(a,b)).toEqual(['start UTC','setting: initialSoc']);
})
it('includes initial and terminal blackout samples with exclusive end indices',()=>{
 expect(failureIntervals([true,true,false,true],v=>!!v)).toEqual([{start:0,end:2},{start:3,end:4}]);expect(failureIntervals([false,false],v=>!!v)).toEqual([]);
})
it('uses measured elevation and lunar curvature in the educational ground mesh',()=>{
 const source={terrains:[],global:{width:8,height:4,h:new Float32Array(32).fill(100)}};
 const g=sceneGround(source,0,0,8,600),center=(4*9+4)*3;
 expect(g.missing).toBe(0);expect(g.base).toBeCloseTo(100);expect(g.positions[center+1]).toBeCloseTo(0);expect(g.positions[1]).toBeLessThan(0);expect(g.indices).toHaveLength(8*8*6);expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
 const missing=sceneGround({terrains:[],global:null},0,0,4,600);expect(missing.missing).toBe(25);
})
