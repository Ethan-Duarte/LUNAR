import {clockRange,skyAt,type Ephem} from '../lib/ephem'
import {horizonAt,type Horizon} from '../lib/horizon'
import {eclipseFactor} from '../lib/windows'
/** First hourly sample with the complete solar disc above measured terrain and no material eclipse. Not a window boundary solver. */
export function findDaylight(ephem:Ephem,horizon:Horizon,hM:number,time:number):number|null{
 const [lo,hi]=clockRange(ephem),start=Math.max(lo,Math.min(time,hi)),end=Math.min(hi,start+60*86400000)
 for(let t=start;t<=end;t+=3600000){const sky=skyAt(ephem,t,horizon.lat,horizon.lon,hM+horizon.observerHeightM);if(sky.sun.el-horizonAt(horizon,sky.sun.az)>sky.sun.radius&&eclipseFactor(sky)>.999)return t}
 return null
}
