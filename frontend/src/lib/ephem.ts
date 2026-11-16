/** LUNAR sky-table evaluator. Newly implemented interpolation and ENU projection.
 * The existing binary ephemeris dataset is retained and is NOT claimed as regenerated.
 * NASA SPICE: https://naif.jpl.nasa.gov/naif/documentation.html */
import {localFrame,sitePosKm,azEl,norm,R2D,SUN_RADIUS_KM,EARTH_RADIUS_KM,type Vec3} from './geo'
export interface Ephem {t0Ms:number;stepS:number;count:number;data:Float32Array;kernels:string[]}
export interface BodyVectors {sun:Vec3;earth:Vec3}
export interface BodySky {az:number;el:number;radius:number;distKm:number}
export interface Sky {sun:BodySky;earth:BodySky}
export function ephemStartMs(table:Ephem){return table.t0Ms}
export function ephemEndMs(table:Ephem){return table.t0Ms+1000*table.stepS*(table.count-1)}
export function clockRange(table:Ephem):[number,number]{return [table.t0Ms+259200000,ephemEndMs(table)-5270400000]}
export async function loadEphem(root:string):Promise<Ephem>{
 const responses=await Promise.all(['json','bin'].map(extension=>fetch(root+'ephem/ephem.'+extension)))
 if(responses.some(response=>response.ok===false))throw Error('Ephemeris download failed')
 const metadata=await responses[0].json(),buffer=await responses[1].arrayBuffer()
 const table:Ephem={t0Ms:Date.parse(metadata.t0_utc),stepS:metadata.step_s,count:metadata.count,data:new Float32Array(buffer),kernels:metadata.kernels??[]}
 if(!Number.isFinite(table.t0Ms)||!(table.stepS>0)||!(table.count>=2)||table.data.length!==8*table.count)throw Error('Invalid ephemeris metadata or binary length')
 return table
}
export function bodyVectors(table:Ephem,utc:number):BodyVectors{
 const sample=Math.max(0,Math.min(table.count-1,(utc-table.t0Ms)/(table.stepS*1000)))
 const left=Math.min(table.count-2,Math.floor(sample)),fraction=sample-left
 const record=Array.from({length:8},(_,channel)=>table.data[left*8+channel]*(1-fraction)+table.data[(left+1)*8+channel]*fraction)
 const reconstruct=(offset:number):Vec3=>{
  const direction=record.slice(offset,offset+3),scale=record[offset+3]/Math.hypot(...direction)
  return direction.map(component=>component*scale) as Vec3
 }
 return {sun:reconstruct(0),earth:reconstruct(4)}
}
export function skyAt(table:Ephem,utc:number,latitude:number,longitude:number,heightMetres:number):Sky{
 const centres=bodyVectors(table,utc),observer=sitePosKm(latitude,longitude,heightMetres),rotation=localFrame(latitude,longitude)
 const project=(centre:Vec3,physicalRadius:number):BodySky=>{
  const relative=centre.map((coordinate,i)=>coordinate-observer[i]) as Vec3,distance=norm(relative)
  return {...azEl(relative,rotation),distKm:distance,radius:R2D*Math.asin(physicalRadius/distance)}
 }
 return {sun:project(centres.sun,SUN_RADIUS_KM),earth:project(centres.earth,EARTH_RADIUS_KM)}
}
