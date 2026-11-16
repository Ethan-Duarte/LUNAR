/** LUNAR sampled visibility and event kernel. The analytic eclipse overlap
 * function is the retained original LUNAR addition; sampling/statistics are replaced. */
import {skyAt,type Ephem,type Sky} from './ephem'
import {discVisibleFraction,horizonAt,type Horizon} from './horizon'
export interface Series {
  t0Ms: number;
  stepMs: number;
  count: number;
  sunEl: Float32Array;
  sunAz: Float32Array;

  sunFrac: Float32Array;
  earthEl: Float32Array;
  earthAz: Float32Array;

  earthFrac: Float32Array;

  earthClear: Float32Array;

  eclipseVisible?: Float32Array;
  terrainSunFrac?: Float32Array;
}
export interface Criteria {

  minSunFrac: number;

  earthMaskDeg: number;
}
export interface Summary {

  sunShare: number;
  commShare: number;
  bothShare: number;
  longestSunH: number;
  longestDarkH: number;
  longestCommH: number;
  longestNoCommH: number;
  maxSunEl: number;
}
export interface NextChange {

  now: boolean;

  inHours: number | null;
}
export function uncoveredDisc(
  sunRadius: number,
  earthRadius: number,
  separation: number,
): number {
  if (
    ![sunRadius, earthRadius, separation].every(Number.isFinite) ||
    sunRadius <= 0 ||
    earthRadius < 0 ||
    separation < 0
  )
    throw Error("Invalid occultation geometry");
  const r = sunRadius,
    R = earthRadius,
    d = separation;
  if (d >= r + R) return 1;
  if (d <= Math.abs(R - r)) return R >= r ? 0 : 1 - (R * R) / (r * r);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const overlap =
    r * r * Math.acos(clamp((d * d + r * r - R * R) / (2 * d * r))) +
    R * R * Math.acos(clamp((d * d + R * R - r * r) / (2 * d * R))) -
    0.5 *
      Math.sqrt(
        Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)),
      );
  return Math.max(0, Math.min(1, 1 - overlap / (Math.PI * r * r)));
}
export function eclipseFactor(sky: Sky): number {
  const r = Math.PI / 180;
  const c =
    Math.sin(sky.sun.el * r) * Math.sin(sky.earth.el * r) +
    Math.cos(sky.sun.el * r) *
      Math.cos(sky.earth.el * r) *
      Math.cos((sky.sun.az - sky.earth.az) * r);
  return uncoveredDisc(
    sky.sun.radius,
    sky.earth.radius,
    Math.acos(Math.max(-1, Math.min(1, c))) / r,
  );
}


export const DEFAULT_CRITERIA:Criteria={minSunFrac:.5,earthMaskDeg:0}
export function isSunlit(series:Series,index:number,criteria:Criteria){return series.sunFrac[index]>=criteria.minSunFrac}
export function hasComm(series:Series,index:number,criteria:Criteria){return series.earthClear[index]>=criteria.earthMaskDeg}
export function computeSeries(ephemeris:Ephem,horizon:Horizon,elevationM:number,start:number,end:number,step:number):Series{
 if(!Number.isFinite(step)||step<=0)throw Error('Time step must be positive')
 const count=Math.max(0,Math.floor((end-start)/step)+1)
 const fields=['sunEl','sunAz','sunFrac','earthEl','earthAz','earthFrac','earthClear','terrainSunFrac','eclipseVisible'] as const
 const series={t0Ms:start,stepMs:step,count,...Object.fromEntries(fields.map(field=>[field,new Float32Array(count)]))} as Series
 for(let sample=0;sample<count;sample++){
  const sky=skyAt(ephemeris,start+sample*step,horizon.lat,horizon.lon,elevationM+horizon.observerHeightM)
  for(const body of ['sun','earth'] as const){
   const position=sky[body],fraction=discVisibleFraction(horizon,position.az,position.el,position.radius)
   series[body==='sun'?'sunEl':'earthEl'][sample]=position.el;series[body==='sun'?'sunAz':'earthAz'][sample]=position.az
   if(body==='earth'){series.earthFrac[sample]=fraction;series.earthClear[sample]=position.el-horizonAt(horizon,position.az)}
   else{series.terrainSunFrac![sample]=fraction;series.eclipseVisible![sample]=eclipseFactor(sky);series.sunFrac[sample]=series.terrainSunFrac![sample]*series.eclipseVisible![sample]}
  }
 }return series
}
export function summarise(series:Series,criteria:Criteria=DEFAULT_CRITERIA):Summary{
 let sun=0,comm=0,both=0,highest=-90
 const runs=[0,0,0,0],longest=[0,0,0,0]
 for(let i=0;i<series.count;i++){
  const lit=isSunlit(series,i,criteria),visible=hasComm(series,i,criteria)
  sun+=Number(lit);comm+=Number(visible);both+=Number(lit&&visible);highest=Math.max(highest,series.sunEl[i])
  const states=[lit,!lit,visible,!visible]
  states.forEach((state,j)=>{runs[j]=state?runs[j]+1:0;longest[j]=Math.max(longest[j],runs[j])})
 }
 const hours=series.stepMs/3600000
 return {sunShare:sun/series.count,commShare:comm/series.count,bothShare:both/series.count,longestSunH:longest[0]*hours,longestDarkH:longest[1]*hours,longestCommH:longest[2]*hours,longestNoCommH:longest[3]*hours,maxSunEl:highest}
}
export function changeAfter(series:Series,utc:number,state:boolean,test:(index:number)=>boolean):NextChange{
 const first=Math.max(0,Math.floor((utc-series.t0Ms)/series.stepMs)+1)
 for(let i=first;i<series.count;i++)if(test(i)!==state)return {now:state,inHours:(series.t0Ms+i*series.stepMs-utc)/3600000}
 return {now:state,inHours:null}
}
export function nextChange(series:Series,utc:number,test:(index:number)=>boolean):NextChange{
 const index=Math.min(series.count-1,Math.max(0,Math.round((utc-series.t0Ms)/series.stepMs))),state=test(index)
 for(let i=index+1;i<series.count;i++)if(test(i)!==state)return {now:state,inHours:(i-index)*series.stepMs/3600000}
 return {now:state,inHours:null}

}
