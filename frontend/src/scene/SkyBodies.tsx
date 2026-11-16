/** LUNAR sky objects. Earth photograph: NASA Blue Marble (credited in data metadata).
 * Earth orientation is illustrative; direction and illumination use the supplied ephemeris. */
import {useEffect,useMemo} from 'react'
import * as T from 'three'
import {invalidate} from '@react-three/fiber'
import type {Vec3} from '../lib/geo'
export const EARTH_AT_KM=13000,SUN_AT_KM=19000
export function glowTexture():T.Texture{
 const size=128,data=new Uint8Array(size*size*4)
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const r=Math.hypot((col+.5)*2/size-1,(row+.5)*2/size-1),disc=1-T.MathUtils.smoothstep(r,.095,.13),halo=.18*Math.exp(-r*r*28),i=(row*size+col)*4
  data[i]=255;data[i+1]=250;data[i+2]=230;data[i+3]=Math.round(Math.min(1,disc+halo)*255)
 }
 const texture=new T.DataTexture(data,size,size);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture
}
export function SkyBodies({sun,earth,tMs:_time}:{sun:Vec3;earth:Vec3;tMs:number}){
 const assets=useMemo(()=>{
  const texture=new T.TextureLoader().load(import.meta.env.BASE_URL+'data/globe/earth_2k.jpg',()=>invalidate());texture.colorSpace=T.NoColorSpace
  const material=new T.ShaderMaterial({uniforms:{image:{value:texture},sunlight:{value:new T.Vector3()}},vertexShader:'varying vec2 st;varying vec3 worldNormal;void main(){st=uv;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D image;uniform vec3 sunlight;varying vec2 st;varying vec3 worldNormal;void main(){vec3 linear=pow(texture2D(image,st).rgb,vec3(2.2));float light=max(0.,dot(normalize(worldNormal),sunlight));gl_FragColor=vec4(pow(linear*(light+.015),vec3(1./2.2)),1.);}'})
  return {texture,material,glow:glowTexture()}
 },[])
 useEffect(()=>()=>{assets.texture.dispose();assets.material.dispose();assets.glow.dispose()},[assets])
 const direction=new T.Vector3(...sun).normalize(),earthPosition=new T.Vector3(...earth).normalize().multiplyScalar(EARTH_AT_KM),sunPosition=direction.clone().multiplyScalar(SUN_AT_KM)
 assets.material.uniforms.sunlight.value.copy(direction)
 return <><mesh position={earthPosition} rotation={[Math.PI/2,0,0]} material={assets.material} frustumCulled={false}><sphereGeometry args={[EARTH_AT_KM*Math.tan(1.9*Math.PI/180),48,32]}/></mesh><sprite position={sunPosition} scale={[SUN_AT_KM*Math.tan(.81*Math.PI/180)*15,SUN_AT_KM*Math.tan(.81*Math.PI/180)*15,1]}><spriteMaterial map={assets.glow} transparent depthWrite={false} toneMapped={false}/></sprite></>
}
