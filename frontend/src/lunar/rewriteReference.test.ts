/** Newly written checks against retained scientific reference data. Fixture agreement
 * is regression evidence; it is not independent validation of the fixture producer. */
import {it,expect} from 'vitest'
import {readEphem,readPolarTerrain,readGlobalDem,readPatchIndex,readPatch,readVectors,readJson} from '../lib/testData'
import {computeHorizon,discVisibleFraction,horizonAt,type Horizon} from '../lib/horizon'
import {skyAt} from '../lib/ephem'
import {localFrame,dot,spProject,spUnproject,upVector} from '../lib/geo'
import {eclipseFactor} from '../lib/windows'
import {runFinder,type FinderGrid,type FinderCriteria} from '../lib/finder'
const ephemeris=readEphem(),polar=readPolarTerrain(),global=readGlobalDem(),index=readPatchIndex()!
for(const file of ['terrain/horizon_testvectors.json','patches/patch_testvectors.json']){
 for(const reference of readVectors(file)??[]){
  it('reproduces retained skyline fixture '+reference.name,()=>{
   const terrains=reference.patch?[readPatch(index,reference.patch),polar]:[polar]
   const result=computeHorizon({terrains,global},reference.lat,reference.lon,{observerHeightM:reference.observer_height_m,azStepDeg:reference.az_step_deg})
   const differences=reference.elev_deg.map((value,i)=>Math.abs(value-result.elevDeg[i]))
   expect(Math.max(...differences)).toBeLessThan(.001)
  })
 }
}
it('checks every retained Horizons direction with the regenerated NASA ephemeris table',()=>{
 const references=readJson<{lat:number;lon:number;h_m:number;utc:string;sun_az:number;sun_el:number;earth_az:number;earth_el:number}[]>('ephem/validation_vectors.json')!
 expect(references.length).toBeGreaterThanOrEqual(30)
 let worst=0
 for(const point of references){
  const sky=skyAt(ephemeris,Date.parse(point.utc),point.lat,point.lon,point.h_m)
  for(const body of ['sun','earth'] as const){
   const az=point[body==='sun'?'sun_az':'earth_az'],el=point[body==='sun'?'sun_el':'earth_el']
   const a=upVector(sky[body].el,sky[body].az),b=upVector(el,az)
   worst=Math.max(worst,Math.acos(Math.max(-1,Math.min(1,dot(a,b))))*180/Math.PI)
  }
 }expect(worst).toBeLessThan(.02)
})
it('keeps coordinate transforms orthonormal and longitude-consistent across poles and seam',()=>{
 for(const [lat,lon] of [[-89.999,179.99],[-45,270],[0,0],[70,-135]]){
  const axes=localFrame(lat,lon),point=spProject(lat,lon,1737.4),back=spUnproject(...point,1737.4)
  expect(dot(axes.e,axes.n)).toBeCloseTo(0,12);expect(dot(axes.u,axes.u)).toBeCloseTo(1,12);expect(back.lat).toBeCloseTo(lat,8)
  expect(upVector(back.lat,back.lon).every((value,i)=>Math.abs(value-upVector(lat,lon)[i])<1e-10)).toBe(true)
 }
})
it('resolves a sloping skyline over the disc footprint rather than just its centre',()=>{
 const profile:Horizon={lat:0,lon:0,observerHeightM:2,azStepDeg:.1,elevDeg:new Float32Array(3600),distKm:new Float32Array(3600)}
 profile.elevDeg[1]=2
 expect(horizonAt(profile,360)).toBe(0)
 expect(discVisibleFraction(profile,0,0,.266)).toBeGreaterThan(0)
 expect(discVisibleFraction(profile,0,0,.266)).toBeLessThan(.5)
 expect(discVisibleFraction(profile,0,10,.266)).toBe(1)
})
it('reproduces total, partial and unobscured eclipse states at the Blue Ghost location',()=>{
 const eclipse=(utc:string)=>eclipseFactor(skyAt(ephemeris,Date.parse(utc),18.56,61.81,0))
 expect(eclipse('2025-03-14T06:59:00Z')).toBe(0);expect(eclipse('2025-03-13T06:59:00Z')).toBe(1)
 expect(eclipse('2025-03-14T05:40:00Z')).toBeGreaterThan(0);expect(eclipse('2025-03-14T05:40:00Z')).toBeLessThan(1)
})
it('enforces finder hard limits independently of preference weights',()=>{
 const size=16,length=size*size,grid:FinderGrid={size,pixelM:300,xMin:-2400,yMax:2400,radiusM:1737400,slope:new Float32Array(length).fill(2),sun:new Float32Array(length).fill(.7),earth:new Float32Array(length).fill(.8),psr:new Uint8Array(length),psrKm:new Float32Array(length).fill(1)}
 for(let i=0;i<length;i++)if(i%size<5)grid.slope[i]=20
 const criteria:FinderCriteria={maxSlopeDeg:10,sunMin:.3,sunMax:1,sunPrefer:'high',earthMin:.5,earthMax:1,earthPrefer:'high',psr:'outside',maxPsrKm:5}
 const plain=runFinder(grid,criteria,{minSeparationKm:1}),weighted=runFinder(grid,{...criteria,weights:{sun:4,slope:.2}},{minSeparationKm:1})
 expect(plain.candidates.length).toBeGreaterThan(0);expect(plain.candidates.every(p=>p.slopeDeg<=10&&p.earth>=.5)).toBe(true)
 expect(plain.eligibleKm2).toBe(weighted.eligibleKm2)
 expect(Array.from(plain.score,x=>x>0)).toEqual(Array.from(weighted.score,x=>x>0))
})
