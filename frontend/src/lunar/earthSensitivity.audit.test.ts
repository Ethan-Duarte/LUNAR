import {it,expect} from 'vitest'
import {readFileSync,writeFileSync} from 'node:fs'
import {readPolarTerrain,readCurrentGlobalDem,readPatchIndex,readPatch} from '../lib/testData'
import {computeHorizon,discVisibleFraction} from '../lib/horizon'
import {skyAt,type Ephem} from '../lib/ephem'
import {patchesCovering,sourceHeight} from '../lib/terrain'
import {upVector} from '../lib/geo'
it.skipIf(process.env.LUNAR_SENSITIVITY!=='1')('diagnoses the two fixed outliers without replacing the acceptance run',()=>{
 const qa=new URL('../../../qa/',import.meta.url),old=JSON.parse(readFileSync(new URL('../engine/reports/validation_v091/maps.json',qa),'utf8')),bin=readFileSync(new URL('holdout_ephem.bin',qa)),data=new Float32Array(bin.buffer,bin.byteOffset,bin.byteLength/4),ephem:Ephem={t0Ms:Date.parse('2024-01-01T00:00:00Z'),stepS:3600,count:data.length/8,data,kernels:['fixed archived SPICE table']};
 const polar=readPolarTerrain(),global=readCurrentGlobalDem(),index=readPatchIndex()!,rows=[];
 for(const id of [10,147]){const p=old.points.find((v:any)=>v.index===id),patches=patchesCovering(index,p.lat,p.lon).map(v=>readPatch(index,v.id)),source={terrains:[...patches,polar],global},ground=sourceHeight(source,...upVector(p.lat,p.lon));
 for(const height of [0,2]){const h=computeHorizon(source,p.lat,p.lon,{observerHeightM:height,azStepDeg:.5,maxRangeKm:300});let count=0;for(let i=0;i<ephem.count;i++){const sky=skyAt(ephem,ephem.t0Ms+i*3600000,p.lat,p.lon,ground+height).earth;if(discVisibleFraction(h,sky.az,sky.el,sky.radius)>1e-12)count++}rows.push({index:id,height_m:height,reference:p.reference_earth,predicted:count/ephem.count,error:count/ephem.count-p.reference_earth,patches:patches.map(t=>t.id),horizonMin:Math.min(...h.elevDeg),horizonMax:Math.max(...h.elevDeg)})}}
 writeFileSync(new URL('v15/earth_height_sensitivity.json',qa),JSON.stringify({kind:'Diagnostic only; fixed holdout remains 2 m and all 185 points',rows,limits:['Surface-height sensitivity is not a validated reference observer height.','Do not choose a height to fit the reference; obtain original calculation metadata.']},null,2));expect(rows).toHaveLength(4)
},180000)
