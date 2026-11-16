/** LUNAR globe experiment: radial displacement, tangent-plane height gradients and
 * an independent photographic response. This does not replace the terrain renderer. */
import { useEffect, useMemo } from 'react'
import * as T from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { Cut, GlobeMap, GlobeRelief } from './shading'
import { useStore } from '../store'

const radius = 1737.4
const capacity = 5
const coordinates = `
vec2 chart(vec3 p, float origin) {
  return vec2(fract((atan(p.y,p.x)-origin)/6.28318530718),0.5+asin(clamp(p.z,-1.0,1.0))/3.14159265359);
}`
const vertex = `
uniform sampler2D elevation;
uniform float hasElevation;
varying vec3 direction;
${coordinates}
void main(){
 direction=normalize(position);
 float altitude=hasElevation*texture2D(elevation,chart(direction,-3.14159265359)).r;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(direction*(1737.4+altitude),1.0);
}`
const fragment = `
uniform sampler2D elevation;
uniform sampler2D photograph;
uniform float hasElevation,hasPhoto,photoOrigin,gain,fill;
uniform vec2 pixel;
uniform vec3 sunlight;
uniform int regionCount;
uniform vec3 regionEast[5],regionNorth[5],regionUp[5];
uniform float regionSize[5];
varying vec3 direction;
${coordinates}
vec3 ground(vec3 p){
 vec3 d=normalize(p);
 return d*(1737.4+texture2D(elevation,chart(d,-3.14159265359)).r);
}
void main(){
 vec3 d=normalize(direction);
 for(int j=0;j<5;j++){
  if(j>=regionCount)break;
  float facing=dot(d,regionUp[j]);
  vec2 projected=3474.8*vec2(dot(d,regionEast[j]),dot(d,regionNorth[j]))/(1.0+facing);
  if(facing>0.5 && max(abs(projected.x),abs(projected.y))<regionSize[j])discard;
 }
 vec3 normal=d;
 if(hasElevation>0.5){
  // Rotate the sampling stencil on the sphere: no divergent longitude derivative at poles.
  vec3 east=normalize(cross(abs(d.z)<0.98?vec3(0.,0.,1.):vec3(0.,1.,0.),d));
  vec3 north=cross(d,east);
  float stepAngle=max(pixel.x*6.28318530718,pixel.y*3.14159265359);
  vec3 de=ground(d+stepAngle*east)-ground(d-stepAngle*east);
  vec3 dn=ground(d+stepAngle*north)-ground(d-stepAngle*north);
  normal=normalize(cross(de,dn));
 }
 float incidence=max(0.0,dot(normal,sunlight));
 vec3 reflectance=mix(vec3(0.4),pow(texture2D(photograph,chart(d,photoOrigin)).rgb,vec3(2.2)),hasPhoto);
 // Bounded exponential film response, followed by display gamma.
 vec3 energy=reflectance*(incidence+fill)*gain;
 vec3 display=vec3(1.)-exp(-energy);
 gl_FragColor=vec4(pow(max(display,vec3(0.)),vec3(1./2.2)),1.);
}`
export interface LunarGlobeProps {
 sunDir: [number,number,number]; cuts: Cut[]; map: GlobeMap|null; relief: GlobeRelief|null;
 segments:[number,number]; onPick:(latitude:number,longitude:number)=>void;
}
function inRegion(p:T.Vector3,regions:Cut[]){
 return regions.some(({frame,halfKm})=>{
  const vertical=p.x*frame.up[0]+p.y*frame.up[1]+p.z*frame.up[2]
  if(vertical<=0.5)return false
  const scale=2*radius/(1+vertical), extent=Math.max(0,halfKm-1.5)
  return [frame.ax,frame.ay].every(axis=>Math.abs(scale*(p.x*axis[0]+p.y*axis[1]+p.z*axis[2]))<=extent)
 })
}
export function LunarGlobe(props:LunarGlobeProps){
 const shader=useMemo(()=>new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{
  elevation:{value:null},photograph:{value:null},hasElevation:{value:0},hasPhoto:{value:0},photoOrigin:{value:-Math.PI},
  gain:{value:1.32},fill:{value:.0015},pixel:{value:new T.Vector2(1/4096,1/2048)},sunlight:{value:new T.Vector3()},regionCount:{value:0},
  regionEast:{value:Array.from({length:capacity},()=>new T.Vector3())},regionNorth:{value:Array.from({length:capacity},()=>new T.Vector3())},regionUp:{value:Array.from({length:capacity},()=>new T.Vector3())},regionSize:{value:Array(capacity).fill(0)}
 }}),[])
 useEffect(()=>()=>shader.dispose(),[shader])
 const u=shader.uniforms
 u.sunlight.value.set(...props.sunDir);u.photograph.value=props.map?.tex??null;u.hasPhoto.value=Number(!!props.map);u.photoOrigin.value=props.map?.lonLeftRad??-Math.PI
 u.elevation.value=props.relief?.tex??null;u.hasElevation.value=Number(!!props.relief)
 if(props.relief)u.pixel.value.set(1/props.relief.dem.width,1/props.relief.dem.height)
 u.regionCount.value=Math.min(capacity,props.cuts.length)
 props.cuts.slice(0,capacity).forEach((c,i)=>{u.regionEast.value[i].set(...c.frame.ax);u.regionNorth.value[i].set(...c.frame.ay);u.regionUp.value[i].set(...c.frame.up);u.regionSize.value[i]=Math.max(0,c.halfKm-1.5)})
 const cast=useMemo(()=>function(this:T.Mesh,raycaster:T.Raycaster,hits:T.Intersection[]){
  const point=raycaster.ray.intersectSphere(new T.Sphere(new T.Vector3(),radius),new T.Vector3())
  if(!point)return
  const distance=point.distanceTo(raycaster.ray.origin)
  if(distance<raycaster.near||distance>raycaster.far||inRegion(point.clone().normalize(),props.cuts))return
  hits.push({point,distance,object:this})
 },[props.cuts])
 function select(e:ThreeEvent<MouseEvent>){
  if(e.delta>4||e.intersections.some(h=>h.object.visible&&h.object.userData.marker&&(!h.uv||h.uv.distanceTo(new T.Vector2(.5,.5))<=.5)))return
  e.stopPropagation();const p=e.point
  props.onPick(Math.atan2(p.z,Math.hypot(p.x,p.y))*180/Math.PI,Math.atan2(p.y,p.x)*180/Math.PI)
 }
 return <mesh material={shader} raycast={cast} onClick={select} frustumCulled={false} onBeforeRender={(_renderer,_scene,camera)=>{
  const altitude=Math.max(1,camera.position.length()-radius)
  const incidence=camera.position.clone().normalize().dot(u.sunlight.value)
  const localGain=Math.min(8.25,1.32/Math.max(.001,incidence))
  const blend=T.MathUtils.smoothstep(Math.log(altitude),Math.log(700),Math.log(3500))
  u.gain.value=Math.exp((1-blend)*Math.log(localGain)+blend*Math.log(1.32));u.fill.value=useStore.getState().shadowFill
 }}><sphereGeometry args={[radius,...props.segments]}/></mesh>
}
