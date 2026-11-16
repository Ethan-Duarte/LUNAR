/** LUNAR regional suitability search. Screen hard limits, rank eligible
 * neighbourhoods, then suppress nearby repeats. NASA long-term maps are not date-specific forecasts. */
import {spUnproject} from './geo'
import {decodePng} from './terrain'
export type Prefer='high'|'low'|'none'
export const SEARCH_RADIUS_KM=160
export interface FinderGrid {
  size: number
  pixelM: number
  xMin: number
  yMax: number
  radiusM: number

  slope: Float32Array

  sun: Float32Array

  earth: Float32Array

  psr: Uint8Array

  psrKm: Float32Array
}
export interface FinderCriteria {

  maxSlopeDeg: number

  sunMin: number
  sunMax: number

  sunPrefer: Prefer

  earthMin: number
  earthMax: number
  earthPrefer: Prefer

  psr: 'any' | 'inside' | 'outside'

  maxPsrKm: number | null

  weights?: FinderWeights
}
export interface FinderWeights {
  slope?: number
  sun?: number
  earth?: number

  psr?: number
}
export interface Preset {
  id: string
  label: string

  short: string
  blurb: string
  criteria: FinderCriteria
}
export interface Candidate {
  rank: number
  lat: number
  lon: number

  score: number
  slopeDeg: number
  sun: number
  earth: number
  psrKm: number
  inPsr: boolean
}
export interface FinderResult {

  score: Uint8Array
  eligibleKm2: number

  minPref: number
  maxPref: number

  passAlone: { slope: number; sun: number; earth: number; psr: number }
  candidates: Candidate[]
}
interface LevelMeta {
  size: number
  x_min_m: number
  y_max_m: number
  pixel_m: number
}
const bound=(x:number)=>Math.max(0,Math.min(1,x))
const defaults:FinderCriteria={maxSlopeDeg:10,sunMin:.35,sunMax:1,sunPrefer:'high',earthMin:.5,earthMax:1,earthPrefer:'high',psr:'outside',maxPsrKm:null}
export const PRESETS:Preset[]=[
 {id:'solar',label:'Power survey',short:'Power',blurb:'Screen gentle terrain for useful sunlight and Earth access.',criteria:{...defaults}},
 {id:'ice',label:'Cold-trap investigation',short:'Cold trap',blurb:'Find low-illumination terrain while retaining Earth access. Shadow alone does not establish ice.',criteria:{...defaults,sunMin:0,sunMax:.05,sunPrefer:'low',psr:'any'}},
 {id:'base',label:'Outpost near shadow',short:'Outpost',blurb:'Search illuminated ground near a permanently shadowed region, then study the connected layout in Base.',criteria:{...defaults,maxSlopeDeg:8,maxPsrKm:5}}
]
export function distanceToMask(mask:Uint8Array,size:number):Float32Array{
 const distance=Float32Array.from(mask,value=>value?0:1e9)
 for(const direction of [1,-1]){
  const offsets=direction===1?[[-1,0],[0,-1],[-1,-1],[1,-1]]:[[1,0],[0,1],[1,1],[-1,1]]
  for(let scan=0;scan<distance.length;scan++){
   const index=direction===1?scan:distance.length-1-scan,row=Math.floor(index/size),col=index%size
   for(const [dx,dy] of offsets){const x=col+dx,y=row+dy;if(x>=0&&x<size&&y>=0&&y<size)distance[index]=Math.min(distance[index],distance[y*size+x]+Math.hypot(dx,dy))}
  }
 }return distance
}
function preference(grid:FinderGrid,criteria:FinderCriteria,index:number){
 const terms:[number,number|undefined][]=[[1-bound(grid.slope[index]/Math.max(1e-6,criteria.maxSlopeDeg)),criteria.weights?.slope]]
 for(const field of ['sun','earth'] as const){
  const preference=criteria[field+'Prefer' as 'sunPrefer'|'earthPrefer'],minimum=criteria[field+'Min' as 'sunMin'|'earthMin'],maximum=criteria[field+'Max' as 'sunMax'|'earthMax']
  if(preference==='none')continue
  const value=maximum>minimum?bound((grid[field][index]-minimum)/(maximum-minimum)):1
  terms.push([preference==='high'?value:1-value,criteria.weights?.[field]])
 }
 if(criteria.maxPsrKm!==null&&criteria.psr!=='inside')terms.push([1-bound(grid.psrKm[index]/Math.max(1e-6,criteria.maxPsrKm)),criteria.weights?.psr])
 let value=0,total=0
 for(const [term,supplied] of terms){const weight=supplied===undefined||!Number.isFinite(supplied)||supplied<0?1:supplied;total+=weight;value+=term*weight}
 return total?value/total:1
}
export function runFinder(grid:FinderGrid,criteria:FinderCriteria,options:{maxCandidates?:number;minSeparationKm?:number}={}):FinderResult{
 const count=grid.size**2,score=new Uint8Array(count),preferenceMap=new Float32Array(count),pass={slope:0,sun:0,earth:0,psr:0},candidates:Candidate[]=[]
 let known=0,area=0,minimum=1,maximum=0
 for(let i=0;i<count;i++){
  if(![grid.sun[i],grid.earth[i],grid.slope[i]].every(Number.isFinite))continue
  known++
  const checks={slope:grid.slope[i]<=criteria.maxSlopeDeg,sun:grid.sun[i]>=criteria.sunMin&&grid.sun[i]<=criteria.sunMax,earth:grid.earth[i]>=criteria.earthMin&&grid.earth[i]<=criteria.earthMax,psr:(criteria.psr==='any'||Number(criteria.psr==='inside')===grid.psr[i])&&(criteria.maxPsrKm===null||grid.psrKm[i]<=criteria.maxPsrKm)}
  for(const field of ['slope','sun','earth','psr'] as const)pass[field]+=Number(checks[field])
  if(!Object.values(checks).every(Boolean))continue
  const fit=preference(grid,criteria,i);preferenceMap[i]=fit;score[i]=1+Math.round(254*fit);minimum=Math.min(minimum,fit);maximum=Math.max(maximum,fit)
  const x=grid.xMin+(i%grid.size+.5)*grid.pixelM,y=grid.yMax-(Math.floor(i/grid.size)+.5)*grid.pixelM
  area+=grid.pixelM**2/(1+(x*x+y*y)/(4*grid.radiusM**2))**2
 }
 const neighbourhood=new Float32Array(count)
 for(let row=1;row<grid.size-1;row++)for(let col=1;col<grid.size-1;col++){
  const i=row*grid.size+col;if(!score[i])continue
  let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=preferenceMap[i+dy*grid.size+dx]
  neighbourhood[i]=sum/9+.001
 }
 const separation=Math.max(1,Math.round((options.minSeparationKm??8)*1000/grid.pixelM))
 for(let rank=1;rank<=(options.maxCandidates??8);rank++){
  let best=-1,value=0;for(let i=0;i<count;i++)if(neighbourhood[i]>value){best=i;value=neighbourhood[i]}
  if(best<0)break
  const row=Math.floor(best/grid.size),col=best%grid.size,coordinate=spUnproject(grid.xMin+(col+.5)*grid.pixelM,grid.yMax-(row+.5)*grid.pixelM,grid.radiusM)
  candidates.push({rank,...coordinate,score:Math.min(1,value),slopeDeg:grid.slope[best],sun:grid.sun[best],earth:grid.earth[best],psrKm:grid.psrKm[best],inPsr:!!grid.psr[best]})
  for(let dy=-separation;dy<=separation;dy++)for(let dx=-separation;dx<=separation;dx++)if(dx*dx+dy*dy<=separation*separation&&row+dy>=0&&row+dy<grid.size&&col+dx>=0&&col+dx<grid.size)neighbourhood[(row+dy)*grid.size+col+dx]=0
 }
 for(const field of ['slope','sun','earth','psr'] as const)pass[field]=known?pass[field]/known:0
 return {score,eligibleKm2:area/1e6,minPref:Math.min(minimum,maximum),maxPref:maximum,passAlone:pass,candidates}
}
export function mergeSlope(coarse:Float32Array,size0:number,x0:number,y0:number,pixel0:number,fine:Float32Array,size1:number,x1:number,y1:number,pixel1:number):Float32Array{
 const result=coarse.slice(),visited=new Uint8Array(result.length)
 for(let i=0;i<fine.length;i++){
  if(!Number.isFinite(fine[i]))continue
  const col=Math.floor((x1+(i%size1+.5)*pixel1-x0)/pixel0),row=Math.floor((y0-y1+(Math.floor(i/size1)+.5)*pixel1)/pixel0)
  if(row<0||col<0||row>=size0||col>=size0)continue
  const target=row*size0+col;result[target]=visited[target]?Math.max(result[target],fine[i]):fine[i];visited[target]=1
 }return result
}
export function buildGrid(radiusM:number,outer:LevelMeta,inner:LevelMeta,coarseSlope:Uint8ClampedArray,fineSlope:Uint8ClampedArray,sunBytes:Uint8ClampedArray,earthBytes:Uint8ClampedArray,shadowBytes:Uint8ClampedArray,searchRadiusKm=SEARCH_RADIUS_KM):FinderGrid{
 const channel=(bytes:Uint8ClampedArray,length:number,convert:(value:number)=>number)=>Float32Array.from({length},(_,i)=>convert(bytes[i*4]))
 const count=outer.size**2,psr=Uint8Array.from({length:count},(_,i)=>Number(shadowBytes[i*4]>127)),distance=distanceToMask(psr,outer.size)
 const slope=mergeSlope(channel(coarseSlope,count,x=>x*.25),outer.size,outer.x_min_m,outer.y_max_m,outer.pixel_m,channel(fineSlope,inner.size**2,x=>x*.25),inner.size,inner.x_min_m,inner.y_max_m,inner.pixel_m)
 for(let i=0;i<count;i++){const x=outer.x_min_m+(i%outer.size+.5)*outer.pixel_m,y=outer.y_max_m-(Math.floor(i/outer.size)+.5)*outer.pixel_m;if(Math.hypot(x,y)>searchRadiusKm*1000)slope[i]=NaN;distance[i]*=outer.pixel_m*.001}
 const fraction=(code:number)=>code>250?NaN:code/250
 return {size:outer.size,pixelM:outer.pixel_m,xMin:outer.x_min_m,yMax:outer.y_max_m,radiusM,slope,sun:channel(sunBytes,count,fraction),earth:channel(earthBytes,count,fraction),psr,psrKm:distance}
}
export async function loadFinderGrid(root:string):Promise<FinderGrid>{
 const manifest=await (await fetch(root+'terrain/sp_meta.json')).json(),files=['terrain/sp_slope_L0.png','terrain/sp_slope_L1.png','layers/sun_avg.png','layers/earth_avg.png','layers/psr.png']
 const images=await Promise.all(files.map(file=>decodePng(root+file)))
 return buildGrid(manifest.radius_m,manifest.levels[0],manifest.levels[1],images[0].data,images[1].data,images[2].data,images[3].data,images[4].data)
}
