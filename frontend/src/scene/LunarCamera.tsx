/** LUNAR camera controller: public Three.js OrbitControls plus great-circle flights.
 * Directions and radii interpolate independently to avoid flying through the Moon. */
import {useRef,useEffect} from 'react'
import {useFrame,useThree,invalidate} from '@react-three/fiber'
import {OrbitControls} from '@react-three/drei'
import type {OrbitControls as Controls} from 'three-stdlib'
import * as T from 'three'
import {useStore,type ViewGoal} from '../store'
import {upVector,localFrame,sitePosKm,latLonOf} from '../lib/geo'
const R=1737.4
interface Pose{eye:T.Vector3;target:T.Vector3;up:T.Vector3}
export function lunarCameraPose(goal:ViewGoal,current:T.Vector3,elevation?:(lat:number,lon:number)=>number):Pose{
 if(goal.kind==='pole')return {eye:new T.Vector3(260,-180,-R-330),target:new T.Vector3(0,0,-R),up:new T.Vector3(0,0,-1)}
 if(goal.kind==='globe'){
  const d=goal.lat===undefined?current.clone().normalize():new T.Vector3(...upVector(goal.lat,goal.lon??0))
  return {eye:d.multiplyScalar(R*3.2),target:new T.Vector3(),up:new T.Vector3(0,0,1)}
 }
 const axes=localFrame(goal.lat,goal.lon),up=new T.Vector3(...axes.u),ground=new T.Vector3(...sitePosKm(goal.lat,goal.lon,elevation?elevation(goal.lat,goal.lon):goal.hM))
 const side=current.clone().sub(ground).addScaledVector(up,-current.clone().sub(ground).dot(up))
 if(side.lengthSq()<1e-6)side.set(...axes.n)
 side.normalize();const near=goal.kind==='approach'
 return {eye:ground.clone().addScaledVector(up,near?1.2:26).addScaledVector(side,near?4:48),target:ground,up}
}
export function LunarCamera({elevation}:{elevation?:(lat:number,lon:number)=>number}){
 const {camera}=useThree(),controls=useRef<Controls>(null),goal=useStore(s=>s.view)
 const flight=useRef<{elapsed:number;seq:number;start:Pose;end:Pose;duration:number}|null>(null)
 useEffect(()=>{
  const ctl=controls.current;if(!ctl)return
  const end=lunarCameraPose(goal,camera.position,elevation),distance=camera.position.distanceTo(end.eye)
  const reduced=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches
  flight.current={elapsed:0,seq:goal.seq,start:{eye:camera.position.clone(),target:ctl.target.clone(),up:camera.up.clone()},end,duration:reduced?.001:T.MathUtils.clamp(Math.log1p(distance)*.22,.8,2.8)}
  ctl.enabled=false;invalidate()
 },[goal.seq,camera,elevation])
 useFrame((_,dt)=>{
  const ctl=controls.current;if(!ctl)return
  const move=flight.current
  if(move){
   move.elapsed=Math.min(move.duration,move.elapsed+Math.min(.05,dt));const fraction=move.elapsed/move.duration,t=fraction*fraction*(3-2*fraction)
   const from=move.start.eye.clone().normalize(),to=move.end.eye.clone().normalize(),rotation=new T.Quaternion().setFromUnitVectors(from,to)
   const partial=new T.Quaternion().slerp(rotation,t),distance=T.MathUtils.lerp(move.start.eye.length(),move.end.eye.length(),t)+Math.sin(Math.PI*t)*Math.min(700,move.start.eye.distanceTo(move.end.eye)*.15)
   camera.position.copy(from.applyQuaternion(partial).multiplyScalar(distance));camera.up.copy(move.start.up).applyQuaternion(new T.Quaternion().slerp(new T.Quaternion().setFromUnitVectors(move.start.up,move.end.up),t))
   if(camera.up.lengthSq()<1e-6)camera.up.set(0,1,0);camera.up.normalize();ctl.target.copy(move.start.target).lerp(move.end.target,t);camera.lookAt(ctl.target);invalidate()
   if(fraction===1){flight.current=null;ctl.enabled=true;ctl.minDistance=move.end.target.length()>1?.002:R+1;ctl.update();useStore.getState().setArrived(move.seq)}
  }
  const coordinate=latLonOf([camera.position.x,camera.position.y,camera.position.z]),surface=R+(elevation?.(coordinate.lat,coordinate.lon)??0)*.001
  if(camera.position.length()<surface+.002){camera.position.setLength(surface+.002);invalidate()}
  if(camera instanceof T.PerspectiveCamera){const near=T.MathUtils.clamp((camera.position.length()-surface)*.02,.0001,2);if(Math.abs(camera.near-near)>.00001){camera.near=near;camera.updateProjectionMatrix()}}
 })
 return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.12} minDistance={.002} maxDistance={20000} zoomSpeed={.6} rotateSpeed={.65} screenSpacePanning onChange={()=>invalidate()} onStart={()=>{flight.current=null;if(controls.current)controls.current.enabled=true}}/>
}
