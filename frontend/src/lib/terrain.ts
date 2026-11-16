/** LUNAR raster terrain reader and spherical sampling kernel.
 * Public data layouts remain compatible with the existing prepared NASA rasters.
 * Retained raster provenance remains in metadata; these files are not claimed regenerated. */
import {dot,localFrame,upVector,spProject,type Vec3} from './geo'
import {globalHeightAt,type GlobalDem} from './globalDem'
export interface Frame {
  ax: Vec3
  ay: Vec3
  up: Vec3
}
export interface Level {
  size: number
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  pixel: number

  h: Float32Array
}
export interface Terrain {
  radiusM: number

  levels: Level[]
  frame: Frame

  id?: string

  kind?: string

  render?: boolean
}
export interface PatchEntry {
  id: string
  lat: number
  lon: number
  file: string
  sites: string[]
  source: string

  name?: string

  kind?: string
  render?: boolean

  size?: number
  pixel_m?: number
  height_scale_m?: number
  height_offset_m?: number

  outer?: { file: string; size: number; pixel_m: number }
}
export interface PatchIndex {
  radiusM: number
  size: number
  pixelM: number
  patches: PatchEntry[]
}
export interface HeightSource {
  terrains: Terrain[]
  global: GlobalDem | null
}
export const POLAR_FRAME:Frame={ax:[0,1,0],ay:[1,0,0],up:[0,0,-1]}
export async function decodePng(url:string):Promise<ImageData>{
 const response=await fetch(url)
 if(response.ok===false)throw Error('Terrain image download failed')
 const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'})
 try{const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('2D raster decoding unavailable');context.drawImage(bitmap,0,0);return context.getImageData(0,0,bitmap.width,bitmap.height)}finally{bitmap.close?.()}
}
export function decodeHeights(bytes:Uint8ClampedArray,count:number,scale=.5,offset=-10000):Float32Array{
 const elevations=new Float32Array(count)
 for(let pixel=0;pixel<count;pixel++){
  const code=(bytes[pixel*4]<<8)|bytes[pixel*4+1]
  elevations[pixel]=code?code*scale+offset:NaN
 }
 return elevations
}
export function patchFrame(latitude:number,longitude:number):Frame{const axes=localFrame(latitude,longitude);return {ax:axes.e,ay:axes.n,up:axes.u}}
export function frameProject(frame:Frame,x:number,y:number,z:number,radius:number):[number,number]|null{
 const d:Vec3=[x,y,z],normal=dot(d,frame.up)
 return normal<.2?null:[dot(d,frame.ax),dot(d,frame.ay)].map(v=>v*(2*radius)/(1+normal)) as [number,number]
}
export function frameDirection(frame:Frame,x:number,y:number,radius:number):Vec3{
 const diameter=2*radius,denominator=diameter*diameter+x*x+y*y
 const weights=[2*diameter*x/denominator,2*diameter*y/denominator,(diameter*diameter-x*x-y*y)/denominator]
 return [0,1,2].map(i=>frame.ax[i]*weights[0]+frame.ay[i]*weights[1]+frame.up[i]*weights[2]) as Vec3
}
export function sampleLevel(level:Level,x:number,y:number):number{
 const col=(x-level.xMin)/level.pixel-.5,row=(level.yMax-y)/level.pixel-.5
 if(col<0||row<0||col>level.size-1||row>level.size-1)return NaN
 const left=Math.min(level.size-2,Math.floor(col)),top=Math.min(level.size-2,Math.floor(row)),dx=col-left,dy=row-top
 const start=top*level.size+left
 const upper=level.h[start]*(1-dx)+level.h[start+1]*dx,lower=level.h[start+level.size]*(1-dx)+level.h[start+level.size+1]*dx
 return upper*(1-dy)+lower*dy
}
export function sampleXY(terrain:Terrain,x:number,y:number):number{
 for(let i=terrain.levels.length;i--;){const value=sampleLevel(terrain.levels[i],x,y);if(Number.isFinite(value))return value}return NaN
}
export function sampleDir(terrain:Terrain,x:number,y:number,z:number):number{
 const frame=terrain.frame,normal=x*frame.up[0]+y*frame.up[1]+z*frame.up[2]
 if(normal<.2)return NaN
 const scale=2*terrain.radiusM/(1+normal)
 return sampleXY(terrain,scale*(x*frame.ax[0]+y*frame.ax[1]+z*frame.ax[2]),scale*(x*frame.ay[0]+y*frame.ay[1]+z*frame.ay[2]))
}
export function sourceHeight(source:HeightSource,x:number,y:number,z:number):number{
 for(const terrain of source.terrains){const value=sampleDir(terrain,x,y,z);if(Number.isFinite(value))return value}
 return source.global?globalHeightAt(source.global,Math.asin(Math.max(-1,Math.min(1,z)))*180/Math.PI,Math.atan2(y,x)*180/Math.PI):NaN
}
export function heightAt(terrain:Terrain,latitude:number,longitude:number):number{return sampleDir(terrain,...upVector(latitude,longitude))}
export type TerrainTier='fine'|'coarse'|'none'
export function terrainTier(terrain:Terrain,latitude:number,longitude:number):TerrainTier{
 if(latitude>-60)return 'none'
 const xy=spProject(latitude,longitude,terrain.radiusM)
 for(let i=terrain.levels.length;i--;)if(Number.isFinite(sampleLevel(terrain.levels[i],...xy)))return i?'fine':'coarse'
 return 'none'
}
export function slopeAt(terrain:Terrain,latitude:number,longitude:number):number{
 const xy=frameProject(terrain.frame,...upVector(latitude,longitude),terrain.radiusM);if(!xy)return NaN
 for(let i=terrain.levels.length;i--;){
  const level=terrain.levels[i],spacing=level.pixel,[x,y]=xy
  const east=sampleLevel(level,x+spacing,y)-sampleLevel(level,x-spacing,y),north=sampleLevel(level,x,y+spacing)-sampleLevel(level,x,y-spacing)
  if(!Number.isFinite(east+north))continue
  const mapScale=1+(x*x+y*y)/(4*terrain.radiusM*terrain.radiusM)
  return Math.atan2(Math.hypot(east,north)*mapScale,2*spacing)*180/Math.PI
 }return NaN
}
function square(size:number,pixel:number,heights:Float32Array):Level{const half=size*pixel*.5;return {size,pixel,h:heights,xMin:-half,xMax:half,yMin:-half,yMax:half}}
export function patchTerrain(index:PatchIndex,entry:PatchEntry,h:Float32Array,outerH?:Float32Array):Terrain{
 const fine=square(entry.size??index.size,entry.pixel_m??index.pixelM,h),levels=entry.outer&&outerH?[square(entry.outer.size,entry.outer.pixel_m,outerH),fine]:[fine]
 return {radiusM:index.radiusM,levels,frame:patchFrame(entry.lat,entry.lon),id:entry.id,kind:entry.kind,render:entry.render}
}
export function decodePatch(index:PatchIndex,entry:PatchEntry,bytes:Uint8ClampedArray){const size=entry.size??index.size;return decodeHeights(bytes,size*size,entry.height_scale_m??.5,entry.height_offset_m??-10000)}
export function decodePatchOuter(entry:PatchEntry,bytes:Uint8ClampedArray){return decodeHeights(bytes,entry.outer!.size**2,entry.height_scale_m??.5,entry.height_offset_m??-10000)}
export async function loadPatch(base:string,index:PatchIndex,entry:PatchEntry):Promise<Terrain>{
 const urls=[entry.file,...(entry.outer?[entry.outer.file]:[])],images=await Promise.all(urls.map(file=>decodePng(base+'patches/'+file)))
 return patchTerrain(index,entry,decodePatch(index,entry,images[0].data),images[1]?decodePatchOuter(entry,images[1].data):undefined)
}
export async function loadPatchIndex(base:string):Promise<PatchIndex>{
 const response=await fetch(base+'patches/patches.json');if(!response.ok)return {radiusM:1737400,size:0,pixelM:0,patches:[]}
 const meta=await response.json();return {radiusM:meta.radius_m,size:meta.size,pixelM:meta.pixel_m,patches:meta.patches}
}
export async function loadTerrain(base:string):Promise<Terrain>{
 const response=await fetch(base+'terrain/sp_meta.json'),meta=await response.json()
 const levels:Level[]=await Promise.all(meta.levels.map(async (record:{file:string;size:number;x_min_m:number;x_max_m:number;y_min_m:number;y_max_m:number;pixel_m:number})=>{
  const image=await decodePng(base+'terrain/'+record.file)
  return {size:record.size,pixel:record.pixel_m,xMin:record.x_min_m,xMax:record.x_max_m,yMin:record.y_min_m,yMax:record.y_max_m,h:decodeHeights(image.data,record.size**2)}
 }))
 return {radiusM:meta.radius_m,frame:POLAR_FRAME,levels}
}
export function patchesCovering(index:PatchIndex,latitude:number,longitude:number):PatchEntry[]{
 const query=upVector(latitude,longitude),candidates:{entry:PatchEntry;pixel:number;distance:number}[]=[]
 for(const entry of index.patches){
  const pixel=entry.pixel_m??index.pixelM,full=entry.outer?entry.outer.size*entry.outer.pixel_m*.5:(entry.size??index.size)*pixel*.5,usable=full-Math.min(2000,full*.3)
  const frame=patchFrame(entry.lat,entry.lon),xy=frameProject(frame,...query,index.radiusM)
  if(xy&&Math.max(Math.abs(xy[0]),Math.abs(xy[1]))<=usable)candidates.push({entry,pixel,distance:1-dot(query,frame.up)})
 }
 candidates.sort((a,b)=>a.pixel-b.pixel||a.distance-b.distance)
 const used=new Set<number>();return candidates.filter(c=>{if(used.has(c.pixel))return false;used.add(c.pixel);return true}).map(c=>c.entry)
}
export function patchCovering(index:PatchIndex,latitude:number,longitude:number):PatchEntry|null{return patchesCovering(index,latitude,longitude)[0]??null}
