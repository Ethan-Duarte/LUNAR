/** LUNAR observation controller: measured geometry, date-window results and
 * instantaneous sky are memoized independently. No display setting changes science. */
import {useMemo} from 'react'
import {useStore,type Pin} from '../store'
import {upVector} from '../lib/geo'
import {skyAt,ephemEndMs,type Ephem,type Sky} from '../lib/ephem'
import {computeHorizon,discVisibleFraction,horizonAt,type Horizon} from '../lib/horizon'
import {sourceHeight,slopeAt,terrainTier,type HeightSource,type Terrain} from '../lib/terrain'
import type {GlobalDem} from '../lib/globalDem'
import {computeSeries,summarise,eclipseFactor,isSunlit,hasComm,type Series,type Summary,type NextChange} from '../lib/windows'
export const DAY=86400000,WINDOW_DAYS=60
export type Tier='crest'|'patch'|'fine'|'coarse'|'global'|'none'
export interface SiteAnalysis {
  pin: Pin

  ephem: Ephem

  hM: number

  slope: number
  tier: Tier
  horizon: Horizon
  series: Series
  summary: Summary

  sky: Sky
  sunFrac: number
  eclipse: number
  earthClear: number
  sunNext: NextChange
  commNext: NextChange
}
export function changeAhead<S extends Pick<Series,'t0Ms'|'stepMs'|'count'>>(series:S,ahead:S|null,time:number,now:boolean,test:(s:S,i:number)=>boolean):NextChange{
 for(const window of [series,ahead]){
  if(!window)continue
  const first=Math.max(0,Math.floor((time-window.t0Ms)/window.stepMs)+1)
  for(let i=first;i<window.count;i++)if(test(window,i)!==now)return {now,inHours:(window.t0Ms+window.stepMs*i-time)/3600000}
 }return {now,inHours:null}
}
export function useSiteAnalysis(pin:Pin|null,ephemeris:Ephem|null,terrain:Terrain|null,patches:Terrain[],global:GlobalDem|null):SiteAnalysis|null{
 const time=useStore(s=>s.tMs),start=useStore(s=>s.windowStart),criteria=useStore(s=>s.criteria),observer=useStore(s=>s.observerM)
 const signature=patches.map(p=>p.id??'?').join('|')
 const source:HeightSource=useMemo(()=>({terrains:[...patches,...(terrain?[terrain]:[])],global}),[terrain,global,signature])
 const fixed=useMemo(()=>{
  if(!pin||!ephemeris||!terrain)return null
  const measured=sourceHeight(source,...upVector(pin.lat,pin.lon)),patch=patches[0],polar=terrainTier(terrain,pin.lat,pin.lon)
  const slope=patch?slopeAt(patch,pin.lat,pin.lon):NaN
  const tier:Tier=patch?.kind==='crest20'?'crest':patch?'patch':polar!=='none'?polar:global?'global':'none'
  return {hM:Number.isFinite(measured)?measured:0,horizon:computeHorizon(source,pin.lat,pin.lon,{observerHeightM:observer}),slope:Number.isFinite(slope)?slope:slopeAt(terrain,pin.lat,pin.lon),tier}
 },[pin?.lat,pin?.lon,ephemeris,terrain,source,observer])
 const windows=useMemo(()=>{
  if(!fixed||!ephemeris)return null
  const end=start+WINDOW_DAYS*DAY,step=1200000
  return {series:computeSeries(ephemeris,fixed.horizon,fixed.hM,start,end,step),ahead:computeSeries(ephemeris,fixed.horizon,fixed.hM,end+step,Math.min(start+2*WINDOW_DAYS*DAY,ephemEndMs(ephemeris)),step)}
 },[fixed,ephemeris,start])
 const summary=useMemo(()=>windows?summarise(windows.series,criteria):null,[windows,criteria])
 if(!pin||!ephemeris||!fixed||!windows||!summary)return null
 const sky=skyAt(ephemeris,time,pin.lat,pin.lon,fixed.hM+observer),eclipse=eclipseFactor(sky),sunFrac=discVisibleFraction(fixed.horizon,sky.sun.az,sky.sun.el,sky.sun.radius)*eclipse,earthClear=sky.earth.el-horizonAt(fixed.horizon,sky.earth.az)
 return {pin,ephem:ephemeris,...fixed,series:windows.series,summary,sky,eclipse,sunFrac,earthClear,
  sunNext:changeAhead(windows.series,windows.ahead,time,sunFrac>=criteria.minSunFrac,(s,i)=>isSunlit(s,i,criteria)),
  commNext:changeAhead(windows.series,windows.ahead,time,earthClear>=criteria.earthMaskDeg,(s,i)=>hasComm(s,i,criteria))}
}
export function runs(count:number,test:(index:number)=>boolean):[number,number][]{
 const result:[number,number][]=[];let cursor=0
 while(cursor<count){if(!test(cursor)){cursor++;continue}const begin=cursor++;while(cursor<count&&test(cursor))cursor++;result.push([begin,cursor])}
 return result
}
