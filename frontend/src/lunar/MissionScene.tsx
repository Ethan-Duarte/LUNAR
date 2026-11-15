// Original LUNAR educational scene. All spacecraft shapes below are authored here;
// illustrative archetypes, not extracted upstream showcase assets or flight-accurate models.
import {useEffect,useMemo,useState} from 'react'
import {Canvas} from '@react-three/fiber'
import {OrbitControls} from '@react-three/drei'
import * as THREE from 'three'
import type {Mission} from '../scene/Missions'
import {sourceHeight,type HeightSource} from '../lib/terrain'
import {localFrame,R_KM,upVector} from '../lib/geo'
import type {BodySky} from '../lib/ephem'
export function sceneGround(source:HeightSource,lat:number,lon:number,grid=128,half=600){
 const frame=localFrame(lat,lon),up=upVector(lat,lon),height=sourceHeight(source,...up),base=Number.isFinite(height)?height:0,positions=new Float32Array((grid+1)**2*3),indices:number[]=[]
 let missing=0
 for(let j=0;j<=grid;j++)for(let i=0;i<=grid;i++){
  const east=(i/grid*2-1)*half,north=(1-j/grid*2)*half,d=Math.hypot(east,north),a=d/(R_KM*1000)
  const v=frame.u.map((x,k)=>x*Math.cos(a)+(d?(east*frame.e[k]+north*frame.n[k])/d:0)*Math.sin(a)) as [number,number,number]
  const h=sourceHeight(source,...v);if(!Number.isFinite(h))missing++
  const r=R_KM*1000+(Number.isFinite(h)?h:base),k=(j*(grid+1)+i)*3
  const factor=d?Math.sin(a)*r/d:1
  positions[k]=east*factor;positions[k+1]=Math.cos(a)*r-(R_KM*1000+base);positions[k+2]=-north*factor
  if(i<grid&&j<grid){const q=j*(grid+1)+i,n=grid+1;indices.push(q,q+n,q+1,q+1,q+n,q+n+1)}
 }
 return {positions,indices,missing,base}
}
function Strut({from,to,radius=.065}:{from:[number,number,number];to:[number,number,number];radius?:number}){
 const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),d=b.clone().sub(a),rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize())
 return <mesh position={a.add(b).multiplyScalar(.5)} quaternion={rotation} castShadow><cylinderGeometry args={[radius,radius,d.length(),8]}/><meshStandardMaterial color="#d5d8d9" metalness={.65} roughness={.35}/></mesh>
}
function FieldRover(){return <group position={[-7,.1,3]} rotation={[0,.6,0]}>
 <mesh position={[0,.8,0]} castShadow><boxGeometry args={[2.7,.15,1.5]}/><meshStandardMaterial color="#b7b7ac" metalness={.5} roughness={.6}/></mesh>
 {[-.9,.9].flatMap(x=>[-.85,.85].map(z=><mesh key={x+':'+z} position={[x,.48,z]} castShadow><torusGeometry args={[.37,.09,8,20]}/><meshStandardMaterial color="#484c4d" metalness={.4} roughness={.8}/></mesh>))}
 {[-.4,.4].map(z=><group key={z}><mesh position={[.1,1,z]} castShadow><boxGeometry args={[.6,.12,.55]}/><meshStandardMaterial color="#c5c2aa" roughness={1}/></mesh><mesh position={[-.25,1.28,z]} rotation={[0,0,-.15]} castShadow><boxGeometry args={[.1,.65,.55]}/><meshStandardMaterial color="#c5c2aa" roughness={1}/></mesh></group>)}
 <Strut from={[1,.9,0]} to={[1,2.3,0]} radius={.025}/><mesh position={[1,2.4,0]} rotation={[.6,0,0]} castShadow><sphereGeometry args={[.4,16,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#d9dddc" side={THREE.DoubleSide} roughness={.6}/></mesh>
 </group>}
function RoboticCraft(){return <group>
 <mesh position={[0,1.5,0]} castShadow><cylinderGeometry args={[.9,1.1,.75,6]}/><meshStandardMaterial color="#baa568" metalness={.6} roughness={.5}/></mesh>
 {[0,1,2].map(i=>{const a=i*2*Math.PI/3,foot:[number,number,number]=[2.2*Math.cos(a),.1,2.2*Math.sin(a)];return <group key={i}><Strut from={[.8*Math.cos(a),1.7,.8*Math.sin(a)]} to={foot}/><mesh position={foot} castShadow><cylinderGeometry args={[.3,.35,.1,12]}/><meshStandardMaterial color="#a8b2ba"/></mesh></group>})}
 <Strut from={[0,1.9,0]} to={[0,3.6,0]} radius={.07}/><mesh position={[0,3.4,0]} rotation={[.5,0,0]} castShadow><sphereGeometry args={[.6,20,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#d6dcdf" side={THREE.DoubleSide} metalness={.3} roughness={.5}/></mesh>
 <mesh position={[.55,2.3,.4]} castShadow><boxGeometry args={[.5,.5,.55]}/><meshStandardMaterial color="#dde0e3"/></mesh><mesh position={[.55,2.3,.69]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.15,.15,.05,16]}/><meshStandardMaterial color="#07121c"/></mesh>
 </group>}
function ExpeditionCraft({crewed}:{crewed:boolean}){
 if(!crewed)return <RoboticCraft/>
 const deck=2.6,scale=1
 return <group scale={scale}>
 <mesh position={[0,deck,0]} castShadow><cylinderGeometry args={[2.1,2.4,1.6,8]}/><meshStandardMaterial color="#b58e42" metalness={.65} roughness={.48}/></mesh>
 {Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <mesh key={i} position={[2.16*Math.sin(a),deck,2.16*Math.cos(a)]} rotation={[0,a,0]} castShadow><boxGeometry args={[1.55,1.3,.06]}/><meshStandardMaterial color={i%2?'#c7a65d':'#8f7136'} metalness={.65} roughness={.55}/></mesh>})}
 <mesh position={[0,deck-1.1,0]} castShadow><cylinderGeometry args={[.45,.8,.9,16]}/><meshStandardMaterial color="#30383e" metalness={.7} roughness={.6}/></mesh>
 <mesh position={[0,deck+1.6,0]} castShadow><boxGeometry args={[2.4,2,2]}/><meshStandardMaterial color="#c6cbd0" metalness={.5} roughness={.38}/></mesh>
 <mesh position={[0,deck+2.2,.7]} rotation={[.2,0,0]} castShadow><cylinderGeometry args={[1.1,1.4,1.5,6]}/><meshStandardMaterial color="#bcc5ce" metalness={.6} roughness={.4}/></mesh>
 {[-.65,.65].map(x=><mesh key={x} position={[x,deck+1.9,1.015]} rotation={[0,0,x>0?-.12:.12]}><boxGeometry args={[.7,.55,.025]}/><meshStandardMaterial color="#07121b" metalness={.3} roughness={.15}/></mesh>)}
 {[0,1,2,3].map(i=>{const a=Math.PI/4+i*Math.PI/2,foot:[number,number,number]=[3.8*Math.cos(a),.15,3.8*Math.sin(a)];return <group key={i}><Strut from={[1.8*Math.cos(a),deck,1.8*Math.sin(a)]} to={foot}/><Strut from={[1.7*Math.cos(a),deck-.6,1.7*Math.sin(a)]} to={[foot[0],.5,foot[2]]} radius={.045}/><mesh position={foot} castShadow><cylinderGeometry args={[.5,.55,.14,16]}/><meshStandardMaterial color="#a9adb0" metalness={.7} roughness={.5}/></mesh></group>})}
 <Strut from={[-.9,deck+2.5,-.5]} to={[-.9,deck+4,-.5]} radius={.035}/><mesh position={[-.9,deck+4,-.5]} rotation={[.7,0,.3]} castShadow><sphereGeometry args={[.45,16,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#e0e3e4" side={THREE.DoubleSide} metalness={.5} roughness={.4}/></mesh>
 </group>
}
export function MissionScene({mission,source,sun,onClose}:{mission:Mission;source:HeightSource;sun?:BodySky;onClose:()=>void}){
 const [studio,setStudio]=useState(true)
 const [supported]=useState(()=>{try{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true}catch{return false}})
 const data=useMemo(()=>sceneGround(source,mission.lat,mission.lon),[source,mission.lat,mission.lon])
 const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data.positions,3));g.setIndex(data.indices);g.computeVertexNormals();return g},[data])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 const az=(sun?.az??130)*Math.PI/180,el=(sun?.el??30)*Math.PI/180,light:[number,number,number]=studio?[35,45,20]:[Math.sin(az)*Math.cos(el)*80,Math.sin(el)*80,-Math.cos(az)*Math.cos(el)*80]
 return <section className="mission-scene" aria-label={'Educational 3D scene: '+mission.name}>
 {supported?<Canvas shadows frameloop="demand" camera={{position:[13,8,17],near:.05,far:2500,fov:42}} dpr={[1,1.5]} gl={{antialias:true}}><color attach="background" args={['#020508']}/><ambientLight intensity={studio ? .12 : .025}/><directionalLight position={light} intensity={studio?3:Math.max(0,sun?.el??0)>0?3:0} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-near={.5} shadow-camera-far={180} shadow-normalBias={.025}/><mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#777b80" roughness={1} metalness={0}/></mesh><ExpeditionCraft crewed={mission.kind==='crewed'}/>{["apollo-15","apollo-16","apollo-17"].includes(mission.id)&&<FieldRover/>}<OrbitControls makeDefault target={[0,3,0]} minDistance={7} maxDistance={250} maxPolarAngle={Math.PI*.49}/></Canvas>:<div className="lunar-gl-fallback"><h2>3D needs WebGL 2</h2><p>Mission notes and the measured observatory remain available.</p></div>}
 <div className="mission-scene-top"><button aria-pressed={studio} onClick={()=>setStudio(!studio)}>{studio?'Studio light · illustrative':'Simulation sunlight'}</button><button onClick={onClose}>Return to observatory</button></div>
 <div className="mission-scene-caption"><p className="v1-eyebrow">LUNAR / EXPEDITION STUDY</p><h2>{mission.name}</h2><p>Original {mission.kind==='crewed'?'crewed':'robotic'} lander archetype—not a flight-accurate reconstruction or verified vehicle placement. Measured regional elevation, synthetic surface material. {studio?'Studio illumination is for inspection and does not represent the selected UTC.':'Lighting follows the selected simulation Sun; terrain shadows remain a visual approximation.'} Drag to orbit · scroll to zoom.</p>{data.missing>0&&<p>Some elevation samples are unavailable and use a level fallback. Do not interpret this scene as validated local terrain.</p>}</div>
 </section>
}
