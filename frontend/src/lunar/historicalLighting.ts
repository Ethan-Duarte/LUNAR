// Display transforms and lighting only. Numerical visibility calculations retain their existing model.
import * as THREE from 'three'
import {localFrame,R_KM,type Vec3} from '../lib/geo'
import {discVisibleFraction,type Horizon} from '../lib/horizon'
import type {BodySky} from '../lib/ephem'
export function bodyToScene(lat:number,lon:number,baseM:number){
 const f=localFrame(lat,lon)
 return new THREE.Matrix4().set(...f.e.map(v=>v*1000) as Vec3,0,...f.u.map(v=>v*1000) as Vec3,-(R_KM*1000+baseM),...f.n.map(v=>-v*1000) as Vec3,0,0,0,0,1)
}
export function sceneSunDirection(lat:number,lon:number,sun:BodySky):Vec3{
 const f=localFrame(lat,lon),a=sun.az*Math.PI/180,e=sun.el*Math.PI/180
 return f.u.map((v,i)=>v*Math.sin(e)+(f.e[i]*Math.sin(a)+f.n[i]*Math.cos(a))*Math.cos(e)) as Vec3
}
export function sceneLight(sun:BodySky|undefined,horizon:Horizon|undefined,eclipse:number,studio:boolean){
 if(studio)return {fraction:1,intensity:3,known:true}
 if(!sun||!horizon)return {fraction:0,intensity:0,known:false}
 const fraction=discVisibleFraction(horizon,sun.az,sun.el,sun.radius)*Math.max(0,Math.min(1,eclipse))
 return {fraction,intensity:3*fraction,known:true}
}
/** Bilinear height on the actual local scene mesh, including lunar curvature. */
export function meshGroundHeight(positions:Float32Array,grid:number,half:number,x:number,z:number){
 const u=Math.max(0,Math.min(grid,(x/half+1)*grid/2)),v=Math.max(0,Math.min(grid,(z/half+1)*grid/2)),i=Math.min(grid-1,Math.floor(u)),j=Math.min(grid-1,Math.floor(v)),a=u-i,b=v-j,n=grid+1
 const h=(di:number,dj:number)=>positions[((j+dj)*n+i+di)*3+1]
 // Matches the triangle indices used by sceneGround, rather than inventing a smooth support surface.
 return a+b<=1?h(0,0)+(h(1,0)-h(0,0))*a+(h(0,1)-h(0,0))*b:h(1,1)+(h(0,1)-h(1,1))*(1-a)+(h(1,0)-h(1,1))*(1-b)
}
import {frameProject,sampleLevel,type HeightSource} from '../lib/terrain'
import {upVector} from '../lib/geo'
export function sceneTerrainLabel(source:HeightSource,lat:number,lon:number){
 const u=upVector(lat,lon)
 for(const terrain of source.terrains){const xy=frameProject(terrain.frame,...u,terrain.radiusM);if(!xy)continue;for(const level of [...terrain.levels].reverse()){if(Number.isFinite(sampleLevel(level,...xy)))return `Measured elevation spacing: ${level.pixel.toFixed(0)} m at the observer.`}}
 return source.global?'Whole-Moon elevation fallback at this location; no regional elevation sample.':'Elevation unavailable at this location.'
}
