/** Disk adapters for LUNAR tests. Prepared raster and reference-vector provenance
 * is retained in the data manifests and NOTICE; fixtures are not new observations. */
import {readFileSync,existsSync} from 'node:fs'
import {PNG} from 'pngjs'
import {decodeHeights,decodePatch,decodePatchOuter,patchTerrain,POLAR_FRAME,type Terrain,type PatchIndex} from './terrain'
import type {Ephem} from './ephem'
import type {GlobalDem} from './globalDem'
const root=new URL('../../public/data/',import.meta.url)
export function readJson<T>(path:string):T|null{const url=new URL(path,root);return existsSync(url)?JSON.parse(readFileSync(url,'utf8')) as T:null}
function raster(path:string){const image=PNG.sync.read(readFileSync(new URL(path,root)));return {...image,rgba:new Uint8ClampedArray(image.data)}}
function dem(path:string):GlobalDem{const image=raster(path);return {width:image.width,height:image.height,h:decodeHeights(image.rgba,image.width*image.height)}}
export function readGlobalDem():GlobalDem{return dem('globe/moon_dem_4k.png')}
export function readCurrentGlobalDem():GlobalDem{const meta=readJson<{dem:{file:string}}>('globe/globe.json')!;return dem('globe/'+meta.dem.file)}
export function readEphem():Ephem{
 const meta=readJson<{t0_utc:string;step_s:number;count:number;kernels:string[]}>('ephem/ephem.json')!,bytes=readFileSync(new URL('ephem/ephem.bin',root))
 const copy=new Uint8Array(bytes.byteLength);copy.set(bytes)
 return {t0Ms:Date.parse(meta.t0_utc),stepS:meta.step_s,count:meta.count,kernels:meta.kernels,data:new Float32Array(copy.buffer)}
}
export function readPolarTerrain():Terrain{
 const metadata=readJson<{radius_m:number;levels:{file:string;size:number;x_min_m:number;x_max_m:number;y_min_m:number;y_max_m:number;pixel_m:number}[]}>('terrain/sp_meta.json')!
 return {radiusM:metadata.radius_m,frame:POLAR_FRAME,levels:metadata.levels.map(level=>({size:level.size,xMin:level.x_min_m,xMax:level.x_max_m,yMin:level.y_min_m,yMax:level.y_max_m,pixel:level.pixel_m,h:dem('terrain/'+level.file).h}))}
}
export function readPatchIndex():PatchIndex|null{
 const meta=readJson<{radius_m:number;size:number;pixel_m:number;patches:PatchIndex['patches']}>('patches/patches.json')
 return meta?{radiusM:meta.radius_m,size:meta.size,pixelM:meta.pixel_m,patches:meta.patches}:null
}
export function readPatch(index:PatchIndex,id:string):Terrain{
 const patch=index.patches.find(entry=>entry.id===id);if(!patch)throw Error('Unknown terrain patch '+id)
 return patchTerrain(index,patch,decodePatch(index,patch,raster('patches/'+patch.file).rgba),patch.outer?decodePatchOuter(patch,raster('patches/'+patch.outer.file).rgba):undefined)
}
export interface HorizonVector {name:string;lat:number;lon:number;observer_height_m:number;az_step_deg:number;elev_deg:number[];patch?:string|null}
export function readVectors(path:string):HorizonVector[]|null{return readJson<HorizonVector[]>(path)}
