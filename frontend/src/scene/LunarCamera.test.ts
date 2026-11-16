import {it,expect} from 'vitest'
import {Vector3} from 'three'
import {lunarCameraPose} from './LunarCamera'
import {sitePosKm,upVector} from '../lib/geo'
it('keeps site and approach targets registered to measured elevation, with positive clearance',()=>{
 for(const [lat,lon] of [[0,179.99],[-89.4399,222.8524],[60,-120]]){
  const current=new Vector3(300,200,-4000),target=new Vector3(...sitePosKm(lat,lon,1234))
  for(const kind of ['site','approach'] as const){
   const pose=lunarCameraPose({kind,seq:3,lat,lon,hM:0},current,()=>1234)
   expect(pose.target.distanceTo(target)).toBeLessThan(1e-8)
   expect(pose.eye.clone().sub(target).dot(new Vector3(...upVector(lat,lon)))).toBeCloseTo(kind==='site'?26:1.2,7)
   expect(pose.eye.length()).toBeGreaterThan(target.length())
  }
 }
})
it('uses Moon-centred framing for a globe request and a stable polar target',()=>{
 const globe=lunarCameraPose({kind:'globe',seq:1,lat:20,lon:30},new Vector3(0,0,-3000))
 expect(globe.target.length()).toBe(0);expect(globe.eye.length()).toBeCloseTo(1737.4*3.2,7)
 const pole=lunarCameraPose({kind:'pole',seq:2},globe.eye)
 expect(pole.eye.length()).toBeGreaterThan(pole.target.length());expect(pole.target.z).toBe(-1737.4)
})
