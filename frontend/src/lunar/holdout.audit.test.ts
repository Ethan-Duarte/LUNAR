// Original LUNAR audit. The archived acceptance limits and all 185 points stay fixed.
import {it,expect} from 'vitest'
import {readFileSync,writeFileSync} from 'node:fs'
import {readCurrentGlobalDem,readGlobalDem,readPolarTerrain,readPatchIndex,readPatch} from '../lib/testData'
import {computeHorizon,discVisibleFraction} from '../lib/horizon'
import {skyAt,type Ephem} from '../lib/ephem'
import {patchesCovering,sourceHeight} from '../lib/terrain'
import {upVector} from '../lib/geo'
it.skipIf(process.env.LUNAR_HOLDOUT!=='1')('reruns both terrain representations on the fixed Earth holdout',()=>{
 const qa=new URL('../../../qa/',import.meta.url),old=JSON.parse(readFileSync(new URL('../engine/reports/validation_v091/maps.json',qa),'utf8'));
 const bin=readFileSync(new URL('holdout_ephem.bin',qa)),values=new Float32Array(bin.buffer,bin.byteOffset,bin.byteLength/4),ephem:Ephem={t0Ms:Date.parse('2024-01-01T00:00:00Z'),stepS:3600,count:values.length/8,data:values,kernels:['DE440s / supplied five kernels']};
 const polar=readPolarTerrain(),index=readPatchIndex()!,patchCache=new Map();
 const results=[];
 for(const [name,global] of [['supplied-reference-browser',readGlobalDem()],['LUNAR-V1-native-global',readCurrentGlobalDem()]] as const){const rows=[];
 for(const point of old.points){const patches=patchesCovering(index,point.lat,point.lon).map(p=>{if(!patchCache.has(p.id))patchCache.set(p.id,readPatch(index,p.id));return patchCache.get(p.id)});const source={terrains:[...patches,polar],global};const h=computeHorizon(source,point.lat,point.lon,{observerHeightM:2,azStepDeg:.5,maxRangeKm:300}),u=upVector(point.lat,point.lon),elevation=sourceHeight(source,...u)+2;let count=0;
 for(let i=0;i<ephem.count;i++){const sky=skyAt(ephem,ephem.t0Ms+i*3600000,point.lat,point.lon,elevation).earth;if(discVisibleFraction(h,sky.az,sky.el,sky.radius)>1e-12)count++}
 const predicted=count/ephem.count;rows.push({index:point.index,lat:point.lat,lon:point.lon,reference:point.reference_earth,predicted,legacy_python:point.predicted.earth.any.available_fraction,error:predicted-point.reference_earth});if(rows.length%20===0)console.log(name,rows.length,'/185');
 }
 const errors=rows.map(r=>r.error),bias=errors.reduce((a,b)=>a+b,0)/errors.length,rms=Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length);results.push({engine:name,rms,bias,status:rms<=.03&&Math.abs(bias)<=.01?'PASS_RMS_AND_BIAS':'FAIL',rows});
 }
 const output={kind:'Fixed Earth-map holdout cross-engine audit',epoch_start:'2024-01-01',hours:ephem.count,observer_m:2,azimuth_spacing_deg:.5,radius_km:300,criterion:'any visible portion of Earth; hourly end excluded',limits:{rms:.03,absolute_bias:.01},results,limitations:['Reference map epoch and observer-height metadata still unresolved.','Reference values are the original saved NASA samples; no pixels or thresholds were changed.','Both browser configurations use supplied nested terrain and Moon-centred LT+S ephemerides with topocentric projection.','This comparison diagnoses agreement, not ground-truth accuracy; an apparent failure is not proof that either model is physically wrong.']};writeFileSync(new URL('earth_holdout_cross_engine.json',qa),JSON.stringify(output,null,2));expect(results.every(r=>r.rows.length===185)).toBe(true);console.log(results.map(({engine,rms,bias,status})=>({engine,rms,bias,status})))
},600000)
