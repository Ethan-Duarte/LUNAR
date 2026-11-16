/** LUNAR arrival-window comparison. Scores are stated preferences, not mission safety. */
import {isSunlit,hasComm,DEFAULT_CRITERIA,type Criteria,type Series} from './windows'
export interface WindowStats {
  startMs: number
  days: number

  sunShare: number
  commShare: number

  longestDarkH: number
  longestNoCommH: number

  meanSunElLit: number
  minSunElLit: number
}
export interface Wants {
  sunHigh: boolean
  earthHigh: boolean
}
export interface RankedWindow {
  stats: WindowStats

  score: number
}
export interface RankOptions {

  top?: number

  everyH?: number

  latestStartMs?: number

  earliestStartMs?: number
  criteria?: Criteria
}
export function fitScore(window:WindowStats,preference:Wants):number{
 const sunlight=preference.sunHigh?window.sunShare:1-window.sunShare,communication=preference.earthHigh?window.commShare:1-window.commShare
 return .6*sunlight+.4*communication
}
export function windowStats(series:Series,start:number,days:number,criteria:Criteria=DEFAULT_CRITERIA):WindowStats|null{
 const offset=Math.round((start-series.t0Ms)/series.stepMs),length=Math.round(days*86400000/series.stepMs)
 if(length<=0||offset<0||offset+length>series.count)return null
 let litCount=0,visibleCount=0,totalElevation=0,minimum=Infinity
 const run=[0,0],longest=[0,0]
 for(let sample=offset;sample<offset+length;sample++){
  const lit=isSunlit(series,sample,criteria),contact=hasComm(series,sample,criteria)
  if(lit){litCount++;totalElevation+=series.sunEl[sample];minimum=Math.min(minimum,series.sunEl[sample])}
  visibleCount+=Number(contact)
  const states=[!lit,!contact];states.forEach((state,i)=>{run[i]=state?run[i]+1:0;longest[i]=Math.max(longest[i],run[i])})
 }
 return {startMs:series.t0Ms+offset*series.stepMs,days,sunShare:litCount/length,commShare:visibleCount/length,longestDarkH:longest[0]*series.stepMs/3600000,longestNoCommH:longest[1]*series.stepMs/3600000,meanSunElLit:litCount?totalElevation/litCount:NaN,minSunElLit:litCount?minimum:NaN}
}
export function rankWindows(series:Series,days:number,wants:Wants,options:RankOptions={}):RankedWindow[]{
 const samples=Math.round(days*86400000/series.stepMs);if(samples<=0||samples>series.count)return []
 const criteria=options.criteria??DEFAULT_CRITERIA,integrals=[new Uint32Array(series.count+1),new Uint32Array(series.count+1)]
 for(let i=0;i<series.count;i++){integrals[0][i+1]=integrals[0][i]+Number(isSunlit(series,i,criteria));integrals[1][i+1]=integrals[1][i]+Number(hasComm(series,i,criteria))}
 const stride=Math.max(1,Math.round((options.everyH??6)*3600000/series.stepMs)),choices:{sample:number;score:number}[]=[]
 for(let i=0;i+samples<=series.count;i+=stride){
  const date=series.t0Ms+i*series.stepMs;if(date<(options.earliestStartMs??-Infinity)||date>(options.latestStartMs??Infinity))continue
  const shares=integrals.map(array=>(array[i+samples]-array[i])/samples)
  choices.push({sample:i,score:.6*(wants.sunHigh?shares[0]:1-shares[0])+.4*(wants.earthHigh?shares[1]:1-shares[1])})
 }
 choices.sort((a,b)=>b.score-a.score||a.sample-b.sample)
 const selected:typeof choices=[]
 for(const choice of choices){if(selected.length>=(options.top??5))break;if(selected.every(other=>Math.abs(other.sample-choice.sample)>=samples*.5))selected.push(choice)}
 return selected.map(({sample,score})=>({score,stats:windowStats(series,series.t0Ms+sample*series.stepMs,days,criteria)!}))
}
export function leader(values:number[],higher:boolean,threshold:number):number{
 if(values.length<2||values.some(value=>!Number.isFinite(value)))return -1
 const indices=values.map((_,index)=>index).sort((a,b)=>(higher?1:-1)*(values[b]-values[a]))
 return Math.abs(values[indices[0]]-values[indices[1]])>=threshold?indices[0]:-1
}
