/** LUNAR spherical skyline evaluator. Great-circle samples are precomputed once per
 * calculation, then rotated into each bearing. This module preserves the public
 * data interface and sampling contract used by saved studies and reference fixtures. */
import {localFrame,type Vec3} from './geo'
import {sourceHeight,type HeightSource,type Terrain} from './terrain'
export interface Horizon {lat:number;lon:number;observerHeightM:number;azStepDeg:number;elevDeg:Float32Array;distKm:Float32Array}
export interface HorizonOptions {observerHeightM?:number;azStepDeg?:number;maxRangeKm?:number}
const degrees=180/Math.PI
function distanceGrid(radius:number,maximum:number){
 const distances:number[]=[],cosines:number[]=[],sines:number[]=[]
 for(let metres=20;metres<=maximum;metres+=Math.max(20,metres*.002)){
  distances.push(metres);cosines.push(Math.cos(metres/radius));sines.push(Math.sin(metres/radius))
 }
 return {distances,cosines,sines}
}
export function computeHorizon(input:Terrain|HeightSource,latitude:number,longitude:number,options:HorizonOptions={}):Horizon{
 const source:HeightSource='terrains' in input?input:{terrains:[input],global:null}
 const height=options.observerHeightM??2,step=options.azStepDeg??.5
 if(!(step>0)||!Number.isFinite(step))throw Error('Azimuth step must be positive')
 const basis=localFrame(latitude,longitude),radius=source.terrains[0]?.radiusM??1737400
 const terrainHeight=sourceHeight(source,...basis.u),eyeRadius=radius+(Number.isFinite(terrainHeight)?terrainHeight:0)+height
 const profile:Horizon={lat:latitude,lon:longitude,observerHeightM:height,azStepDeg:step,elevDeg:new Float32Array(Math.round(360/step)),distKm:new Float32Array(Math.round(360/step))}
 const path=distanceGrid(radius,(options.maxRangeKm??300)*1000)
 for(let bearing=0;bearing<profile.elevDeg.length;bearing++){
  const angle=bearing*step/degrees,across=Math.sin(angle),along=Math.cos(angle)
  const tangent:Vec3=[0,1,2].map(axis=>basis.e[axis]*across+basis.n[axis]*along) as Vec3
  let highest=-Infinity,atMetres=0,hasSamples=false
  for(let index=0;index<path.distances.length;index++){
   const c=path.cosines[index],s=path.sines[index]
   const measurement=sourceHeight(source,basis.u[0]*c+tangent[0]*s,basis.u[1]*c+tangent[1]*s,basis.u[2]*c+tangent[2]*s)
   if(!Number.isFinite(measurement)){if(hasSamples)break;continue}
   hasSamples=true
   const radial=radius+measurement,vertical=radial*c-eyeRadius,horizontal=radial*s
   const candidate=Math.atan2(vertical,horizontal)
   if(candidate>highest){highest=candidate;atMetres=path.distances[index]}
  }
  profile.elevDeg[bearing]=degrees*(hasSamples?highest:-Math.acos(Math.min(1,radius/eyeRadius)))
  profile.distKm[bearing]=atMetres*.001
 }
 return profile
}
export function horizonAt(profile:Horizon,azimuth:number):number{
 const wrapped=(azimuth-360*Math.floor(azimuth/360))/profile.azStepDeg
 const index=Math.floor(wrapped),fraction=wrapped-index,n=profile.elevDeg.length
 return profile.elevDeg[index%n]*(1-fraction)+profile.elevDeg[(index+1)%n]*fraction
}
export function discVisibleFraction(profile:Horizon,azimuth:number,elevation:number,radius:number,strips=15):number{
 if(radius<=0)return Number(elevation>=horizonAt(profile,azimuth))
 let illuminated=0,area=0
 const horizontalScale=1/Math.max(1e-6,Math.cos(elevation/degrees))
 // Bound every linear skyline segment intersecting the disc before integrating.
 // This is conservative even when a peak lies away from the disc centre.
 const spread=radius*horizontalScale,n=profile.elevDeg.length
 const begin=Math.floor((azimuth-spread)/profile.azStepDeg),end=Math.ceil((azimuth+spread)/profile.azStepDeg)
 let low=Infinity,high=-Infinity
 for(let j=begin;j<=Math.min(end,begin+n);j++){const value=profile.elevDeg[(j%n+n)%n];low=Math.min(low,value);high=Math.max(high,value)}
 if(elevation-radius>high)return 1
 if(elevation+radius<low)return 0
 for(let strip=0;strip<strips;strip++){
  const offset=radius*((strip+.5)*2/strips-1),chord=2*Math.sqrt(Math.max(0,radius*radius-offset*offset))
  const threshold=horizonAt(profile,azimuth+offset*horizontalScale)
  illuminated+=Math.max(0,Math.min(chord,elevation+chord*.5-threshold));area+=chord
 }
 return illuminated/area
}
