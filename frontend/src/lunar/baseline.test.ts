// LUNAR baseline audit: records differences; does not turn agreement into validation.
import {it,expect} from 'vitest'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {readEphem,readCurrentGlobalDem,readPatch,readPatchIndex,readPolarTerrain} from '../lib/testData'
import {patchesCovering,sourceHeight} from '../lib/terrain'
import {upVector} from '../lib/geo'
import {computeHorizon} from '../lib/horizon'
import {computeSeries,summarise} from '../lib/windows'
import type {Study} from './science'
it('records the supplied Singapore engine against preserved LUNAR scenarios without hiding differences',()=>{
 const ephem=readEphem(),polar=readPolarTerrain(),global=readCurrentGlobalDem(),index=readPatchIndex()!;
 const cases=[];
 for(const id of ['ridge-2m','ridge-10m','earth-control']){
  const s:Study=JSON.parse(readFileSync(new URL(`../../public/lunar/data/sites/${id}.json`,import.meta.url),'utf8'));
  const patches=patchesCovering(index,s.lat,s.lon).map(p=>readPatch(index,p.id));const src={terrains:[...patches,polar],global};
  const hz=computeHorizon(src,s.lat,s.lon,{observerHeightM:s.height_m,azStepDeg:.5,maxRangeKm:300});
  const u=upVector(s.lat,s.lon),hM=sourceHeight(src,u[0],u[1],u[2]);
  const series=computeSeries(ephem,hz,hM,Date.parse(s.study.start_utc),Date.parse(s.study.end_utc)-3600000,3600000);
  const browser=summarise(series,{minSunFrac:.5,earthMaskDeg:0});
  const original={sun:s.samples.slice(0,-1).filter(q=>q.sunlit).length/(s.samples.length-1),earth:s.samples.slice(0,-1).filter(q=>q.earth_visible).length/(s.samples.length-1)};
  cases.push({id,lat:s.lat,lon:s.lon,height_m:s.height_m,start:s.study.start_utc,end:s.study.end_utc,patches:patches.map(p=>p.id),browser,python_hourly:original,delta_pp:{sun:(browser.sunShare-original.sun)*100,earth:(browser.commShare-original.earth)*100},python_refined:s.metrics});
  expect(series.count).toBe(s.samples.length-1);expect(Number.isFinite(browser.sunShare)).toBe(true);
 }
 const path=new URL('../../../qa/',import.meta.url);mkdirSync(path,{recursive:true});writeFileSync(new URL('singapore_baseline.json',path),JSON.stringify({kind:'Cross-engine audit, not independent validation',criteria:'Matched site, height, 180-day dates, half solar disc, zero Earth-centre clearance, hourly left-hand samples, 300km range. Terrain chains and eclipse treatment differ.',caveats:['Browser terrain is derived from supplied upstream PNGs; Python examples use their original native DEM chain.','Browser includes approximate Earth eclipses; retained Python studies are terrain-only.','Refined Python blackout duration is not directly equivalent to an hourly sampled browser duration.'],cases},null,2));
 console.log('Matched hourly differences (percentage points):',cases.map(c=>({id:c.id,...c.delta_pp})));
},30000)
