// Original LUNAR educational scene. All spacecraft shapes below are authored here;
// illustrative archetypes, not extracted upstream showcase assets or flight-accurate models.
import {useEffect,useMemo,useState} from 'react'
import {Canvas} from '@react-three/fiber'
import {OrbitControls} from '@react-three/drei'
import * as THREE from 'three'
import type {Mission} from '../scene/Missions'
import {sourceHeight,type HeightSource} from '../lib/terrain'
import {localFrame,R_KM,upVector} from '../lib/geo'
import {MoonTerrain} from '../scene/MoonTerrain'
import type {GlobeMap,GlobeRelief} from '../scene/shading'
import {DETAIL,type Quality} from '../store'
import type {Horizon} from '../lib/horizon'
import {bodyToScene,sceneSunDirection,sceneLight,meshGroundHeight} from './historicalLighting'
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
function FieldRover({ground}:{ground:(x:number,z:number)=>number}){const base=ground(-7,3),wheelY=(x:number,z:number)=>ground(-7+x*Math.cos(.6)+z*Math.sin(.6),3-x*Math.sin(.6)+z*Math.cos(.6))-base+.46;return <group position={[-7,base,3]} rotation={[0,.6,0]}>
 <mesh position={[0,.8,0]} castShadow><boxGeometry args={[2.7,.15,1.5]}/><meshStandardMaterial color="#b7b7ac" metalness={.5} roughness={.6}/></mesh>
 {[-.9,.9].flatMap(x=>[-.85,.85].map(z=><mesh key={x+':'+z} position={[x,wheelY(x,z),z]} castShadow><torusGeometry args={[.37,.09,8,20]}/><meshStandardMaterial color="#484c4d" metalness={.4} roughness={.8}/></mesh>))}
 {[-.4,.4].map(z=><group key={z}><mesh position={[.1,1,z]} castShadow><boxGeometry args={[.6,.12,.55]}/><meshStandardMaterial color="#c5c2aa" roughness={1}/></mesh><mesh position={[-.25,1.28,z]} rotation={[0,0,-.15]} castShadow><boxGeometry args={[.1,.65,.55]}/><meshStandardMaterial color="#c5c2aa" roughness={1}/></mesh></group>)}
 <Strut from={[1,.9,0]} to={[1,2.3,0]} radius={.025}/><mesh position={[1,2.4,0]} rotation={[.6,0,0]} castShadow><sphereGeometry args={[.4,16,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#d9dddc" side={THREE.DoubleSide} roughness={.6}/></mesh>
 </group>}
function RoboticCraft({ground}:{ground:(x:number,z:number)=>number}){const feet=[0,1,2].map(i=>{const a=i*2*Math.PI/3;return [2.2*Math.cos(a),2.2*Math.sin(a)]});const base=Math.max(...feet.map(([x,z])=>ground(x,z)));return <group position={[0,base,0]}>
 <mesh position={[0,1.5,0]} castShadow><cylinderGeometry args={[.9,1.1,.75,6]}/><meshStandardMaterial color="#baa568" metalness={.6} roughness={.5}/></mesh>
 {[0,1,2].map(i=>{const a=i*2*Math.PI/3,foot:[number,number,number]=[2.2*Math.cos(a),ground(2.2*Math.cos(a),2.2*Math.sin(a))-base+.05,2.2*Math.sin(a)];return <group key={i}><Strut from={[.8*Math.cos(a),1.7,.8*Math.sin(a)]} to={foot}/><mesh position={foot} castShadow><cylinderGeometry args={[.3,.35,.1,12]}/><meshStandardMaterial color="#a8b2ba"/></mesh></group>})}
 <Strut from={[0,1.9,0]} to={[0,3.6,0]} radius={.07}/><mesh position={[0,3.4,0]} rotation={[.5,0,0]} castShadow><sphereGeometry args={[.6,20,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#d6dcdf" side={THREE.DoubleSide} metalness={.3} roughness={.5}/></mesh>
 <mesh position={[.55,2.3,.4]} castShadow><boxGeometry args={[.5,.5,.55]}/><meshStandardMaterial color="#dde0e3"/></mesh><mesh position={[.55,2.3,.69]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.15,.15,.05,16]}/><meshStandardMaterial color="#07121c"/></mesh>
 </group>}
function ExpeditionCraft({crewed,ground}:{crewed:boolean;ground:(x:number,z:number)=>number}){
 if(!crewed)return <RoboticCraft ground={ground}/>
 const deck=2.6,scale=1,base=Math.max(...[0,1,2,3].map(i=>{const a=Math.PI/4+i*Math.PI/2;return ground(3.8*Math.cos(a),3.8*Math.sin(a))}))
 return <group scale={scale} position={[0,base,0]}>
 <mesh position={[0,deck,0]} castShadow><cylinderGeometry args={[2.1,2.4,1.6,8]}/><meshStandardMaterial color="#b58e42" metalness={.65} roughness={.48}/></mesh>
 {Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <mesh key={i} position={[2.16*Math.sin(a),deck,2.16*Math.cos(a)]} rotation={[0,a,0]} castShadow><boxGeometry args={[1.55,1.3,.06]}/><meshStandardMaterial color={i%2?'#c7a65d':'#8f7136'} metalness={.65} roughness={.55}/></mesh>})}
 <mesh position={[0,deck-1.1,0]} castShadow><cylinderGeometry args={[.45,.8,.9,16]}/><meshStandardMaterial color="#30383e" metalness={.7} roughness={.6}/></mesh>
 <mesh position={[0,deck+1.6,0]} castShadow><boxGeometry args={[2.4,2,2]}/><meshStandardMaterial color="#c6cbd0" metalness={.5} roughness={.38}/></mesh>
 <mesh position={[0,deck+2.2,.7]} rotation={[.2,0,0]} castShadow><cylinderGeometry args={[1.1,1.4,1.5,6]}/><meshStandardMaterial color="#bcc5ce" metalness={.6} roughness={.4}/></mesh>
 {[-.65,.65].map(x=><mesh key={x} position={[x,deck+1.9,1.015]} rotation={[0,0,x>0?-.12:.12]}><boxGeometry args={[.7,.55,.025]}/><meshStandardMaterial color="#07121b" metalness={.3} roughness={.15}/></mesh>)}
 {[0,1,2,3].map(i=>{const a=Math.PI/4+i*Math.PI/2,foot:[number,number,number]=[3.8*Math.cos(a),ground(3.8*Math.cos(a),3.8*Math.sin(a))-base+.07,3.8*Math.sin(a)];return <group key={i}><Strut from={[1.8*Math.cos(a),deck,1.8*Math.sin(a)]} to={foot}/><Strut from={[1.7*Math.cos(a),deck-.6,1.7*Math.sin(a)]} to={[foot[0],foot[1]+.4,foot[2]]} radius={.045}/><mesh position={foot} castShadow><cylinderGeometry args={[.5,.55,.14,16]}/><meshStandardMaterial color="#a9adb0" metalness={.7} roughness={.5}/></mesh></group>})}
 {[0,1,2,3,4,5,6].map(i=><Strut key={'rung'+i} from={[-.35,.5+i*.4,3.35-i*.12]} to={[.35,.5+i*.4,3.35-i*.12]} radius={.035}/>)}<Strut from={[-.35,.5,3.35]} to={[-.35,3,2.6]} radius={.045}/><Strut from={[.35,.5,3.35]} to={[.35,3,2.6]} radius={.045}/>
 <Strut from={[-.9,deck+2.5,-.5]} to={[-.9,deck+4,-.5]} radius={.035}/><mesh position={[-.9,deck+4,-.5]} rotation={[.7,0,.3]} castShadow><sphereGeometry args={[.45,16,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#e0e3e4" side={THREE.DoubleSide} metalness={.5} roughness={.4}/></mesh>
 </group>
}
export function MissionScene({mission,source,sun,sunDirection,horizon,eclipse=1,map=null,relief=null,dataBase,quality='medium',onClose}:{mission:Mission;source:HeightSource;sun?:BodySky;sunDirection?:[number,number,number];horizon?:Horizon;eclipse?:number;map?:GlobeMap|null;relief?:GlobeRelief|null;dataBase:string;quality?:Quality;onClose:()=>void}){
 const [studio,setStudio]=useState(false)
 const cameraOptions=useMemo(()=>({position:(mission.kind==='crewed'?[14,8,19]:[8,5,11]) as [number,number,number],near:.15,far:50000,fov:42}),[mission.kind])
 const [supported]=useState(()=>{try{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true}catch{return false}})
 const data=useMemo(()=>sceneGround(source,mission.lat,mission.lon,128,600),[source,mission.lat,mission.lon])
 const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data.positions,3));g.setIndex(data.indices);g.computeVertexNormals();return g},[data])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 const transforms=useMemo(()=>{const local=bodyToScene(mission.lat,mission.lon,data.base);return {local,body:local.clone().invert()}},[mission.lat,mission.lon,data.base])
 const tiles=useMemo(()=>source.terrains.filter(t=>t.render!==false).sort((a,b)=>b.levels.at(-1)!.pixel-a.levels.at(-1)!.pixel),[source])
 const ground=(x:number,z:number)=>meshGroundHeight(data.positions,128,600,x,z)
 const effectiveSun=studio?{az:120,el:38,radius:.266,distKm:149597870}:sun
 const bodySun=!studio&&sunDirection?sunDirection:effectiveSun?sceneSunDirection(mission.lat,mission.lon,effectiveSun):[1,0,0] as [number,number,number]
 const light=sceneLight(sun,horizon,eclipse,studio),az=(effectiveSun?.az??0)*Math.PI/180,el=(effectiveSun?.el??0)*Math.PI/180
 const lightPosition:[number,number,number]=[Math.sin(az)*Math.cos(el)*120,Math.sin(el)*120,-Math.cos(az)*Math.cos(el)*120]
 return <section className="mission-scene" aria-label={'Educational 3D scene: '+mission.name}>
 {supported?<Canvas shadows frameloop="demand" camera={cameraOptions} dpr={[1,DETAIL[quality].dpr]} gl={{antialias:true}}><color attach="background" args={['#020508']}/><ambientLight intensity={studio ? .12 : .008}/><directionalLight position={lightPosition} intensity={light.intensity} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-camera-near={.5} shadow-camera-far={260} shadow-bias={-.00005} shadow-normalBias={.015}/>
 {tiles.length>0?<group>{tiles.map((tile,i)=><MoonTerrain key={tile.id??i} terrain={tile} sunDir={bodySun} sunRad={(effectiveSun?.radius??.266)*Math.PI/180} solarFactor={studio?1:eclipse} cameraToBody={transforms.body} renderTransform={transforms.local} layer="natural" dataBase={dataBase} map={map} relief={relief} overlays={false} detail={DETAIL[quality]} focus={{lat:mission.lat,lon:mission.lon}} cuts={tiles.slice(i+1).map(t=>({frame:t.frame,halfKm:t.levels[0].xMax/1000}))} onPick={()=>{}} interactive={false}/>)}</group>:<mesh geometry={geometry} receiveShadow castShadow><meshStandardMaterial color="#777b80" roughness={1}/></mesh>}
 {tiles.length>0&&<mesh geometry={geometry} position={[0,.035,0]} receiveShadow><shadowMaterial transparent opacity={.95} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>}
 <ExpeditionCraft crewed={mission.kind==='crewed'} ground={ground}/>{["apollo-15","apollo-16","apollo-17"].includes(mission.id)&&<FieldRover ground={ground}/>}
 <OrbitControls makeDefault target={[0,mission.kind==='crewed'?3:1.6,0]} minDistance={mission.kind==='crewed'?7:4} maxDistance={250} maxPolarAngle={Math.PI*.49}/></Canvas>:<div className="lunar-gl-fallback"><h2>3D needs WebGL 2</h2><p>Mission notes and the measured observatory remain available.</p></div>}
 <div className="mission-scene-top"><button aria-pressed={studio} onClick={()=>setStudio(!studio)}>{studio?'Studio light · illustrative':'Simulation sunlight'}</button><button onClick={onClose}>Return to terrain</button></div>
 <div className="mission-scene-caption"><p className="v1-eyebrow">LUNAR / EXPEDITION STUDY</p><h2>{mission.name}</h2><p>{studio?'Studio illumination · selected UTC unchanged':light.known?'Simulation sunlight · terrain horizon and eclipse applied at the observer':'Awaiting observer horizon · direct spacecraft light withheld'}. Original illustrative hardware, not verified vehicle placement. Drag to orbit · scroll to zoom.</p>{data.missing>0&&<p>Some elevation samples are unavailable and use a level fallback.</p>}</div>
 </section>
}
