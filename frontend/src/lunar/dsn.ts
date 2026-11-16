import {azEl,localFrame,sitePosKm,type Vec3} from '../lib/geo'
import {horizonAt,type Horizon} from '../lib/horizon'
export interface DsnTable {start:number;stepMs:number;count:number;stations:{name:string}[];data:Float32Array}
export async function loadDsn():Promise<DsnTable>{const base=import.meta.env.BASE_URL+'data/dsn/',r=await fetch(base+'stations.json');if(!r.ok)throw Error('DSN metadata unavailable');const m=await r.json(),b=await fetch(base+'stations.bin');if(!b.ok)throw Error('DSN geometry unavailable');const data=new Float32Array(await b.arrayBuffer());if(data.length!==m.count*m.stations.length*4)throw Error('Invalid DSN geometry size');return {start:Date.parse(m.start),stepMs:m.stepSeconds*1000,count:m.count,stations:m.stations,data}}
export function dsnCovers(t:DsnTable,start:number,end:number){return start>=t.start&&end<=t.start+(t.count-1)*t.stepMs}
export function stationAccess(table:DsnTable,time:number,lat:number,lon:number,elevationM:number,horizon:Horizon,terrainMaskDeg=0){
 if(!dsnCovers(table,time,time))return null
 const x=(time-table.start)/table.stepMs,i=Math.min(table.count-2,Math.floor(x)),w=x-i,frame=localFrame(lat,lon),site=sitePosKm(lat,lon,elevationM),stride=table.stations.length*4
 return table.stations.map((_,k)=>{const get=(c:number)=>table.data[i*stride+k*4+c]*(1-w)+table.data[(i+1)*stride+k*4+c]*w,vector=[get(0)-site[0],get(1)-site[1],get(2)-site[2]] as Vec3,sky=azEl(vector,frame);return get(3)>=10&&sky.el-horizonAt(horizon,sky.az)>=terrainMaskDeg})
}
