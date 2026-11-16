// End-to-end execution of the production worker against shipped JPL/LOLA data, without a browser GPU.
import { it, expect, vi } from "vitest";
import {
  readEphem,
  readPolarTerrain,
  readCurrentGlobalDem,
  readPatch,
  readPatchIndex,
} from "../lib/testData";
import { DEFAULT_ENGINEERING } from "./engineering";
import type { PlannerRequest } from "./planner.worker";
import { writeFileSync, mkdirSync } from "node:fs";
async function execute(request: PlannerRequest) {
  let result: any;
  const target: {
    onmessage: ((e: any) => Promise<void>) | null;
    postMessage: (j: unknown) => void;
  } = {
    onmessage: null,
    postMessage: (j) => {
      if ((j as any).done || (j as any).error) result = j;
    },
  };
  vi.stubGlobal("self", target);
  vi.resetModules();
  await import("./planner.worker");
  await target.onmessage!({ data: request });
  vi.unstubAllGlobals();
  return result;
}
it("evaluates a real Connecting Ridge base, records complete provenance and returns finite physical outputs", async () => {
  const index = readPatchIndex()!,
    crest = index.patches.find((p) => p.kind === "crest20")!,
    terrain = readPolarTerrain(),
    patch = readPatch(index, crest.id),
    ephem = readEphem();
  const facilities = [
    {
      id: "hab",
      name: "Habitat",
      role: "habitat" as const,
      lat: -89.4399,
      lon: 222.8524,
      mast: 2,
      fixed: true,
    },
    {
      id: "solar",
      name: "Solar",
      role: "power" as const,
      lat: -89.4399,
      lon: 222.8524,
      mast: 2,
      areaM2: 20,
      fixed: false,
    },
  ];
  const request: PlannerRequest = {
    kind: "evaluate",
    facilities,
    source: { terrains: [patch, terrain], global: readCurrentGlobalDem() },
    ephem,
    start: Date.parse("2026-11-14T00:00:00Z"),
    settings: {
      ...DEFAULT_ENGINEERING,
      days: 2,
      requireEarth: false,
      maxSlopeDeg: 90,
    },
    radiusKm: 0.2,
    earthMaskDeg: 0,
    maxTowerM: 20,
  };
  const result = await execute(request);
  expect(result.error).toBeUndefined();
  expect(result.report.result.power.generatedKWh).toBeGreaterThan(0);
  expect(Number.isFinite(result.report.result.power.unmetKWh)).toBe(true);
  expect(result.report.profiles).toHaveLength(2);
  const r = result.report.result,
    p = r.power;
  expect(p.generatedKWh + p.initialKWh).toBeCloseTo(
    p.loadKWh -
      p.unmetKWh +
      p.finalKWh +
      p.chargeLossKWh +
      p.dischargeLossKWh +
      p.curtailedKWh,
    6,
  );
  mkdirSync("../qa/v11", { recursive: true });
  writeFileSync(
    "../qa/v11/real-base-smoke.json",
    JSON.stringify(
      {
        scenario: { ...request, source: undefined, ephem: undefined },
        result: r,
        arrayScale: result.report.arrayScale,
        profiles: result.report.profiles.map((p: any) => ({
          id: p.id,
          slope: p.slope,
          terrain: p.terrain,
          blocker: p.blocker,
        })),
        limits:
          "Integration smoke, not independent validation. Co-located components intentionally isolate electrical bookkeeping.",
      },
      null,
      2,
    ),
  );
}, 120000);
it("reproduces total solar occultation in a real ephemeris sample without asserting independent contact timing", async () => {
  const ephem = readEphem(),
    source = {
      terrains: [],
      global: { width: 8, height: 4, h: new Float32Array(32) },
    };
  const f = [
    {
      id: "h",
      name: "Habitat",
      role: "habitat" as const,
      lat: 18.562,
      lon: 61.811,
      mast: 2,
      fixed: true,
    },
    {
      id: "p",
      name: "Array",
      role: "power" as const,
      lat: 18.562,
      lon: 61.811,
      mast: 2,
      areaM2: 20,
    },
  ];
  const result = await execute({
    kind: "evaluate",
    facilities: f,
    source,
    ephem,
    start: Date.parse("2025-03-14T00:00:00Z"),
    settings: {
      ...DEFAULT_ENGINEERING,
      days: 1,
      requireEarth: false,
      maxSlopeDeg: 90,
    },
    radiusKm: 1,
    earthMaskDeg: 0,
    maxTowerM: 20,
  });
  expect(result.error).toBeUndefined();
  expect(result.report.result.eclipseEvents.length).toBeGreaterThan(0);
  expect(Math.min(...result.report.profiles[0].eclipse)).toBe(0);
  expect(result.report.result.eclipseLostGenerationKWh).toBeGreaterThan(0);
  writeFileSync(
    "../qa/v11/eclipse-smoke.json",
    JSON.stringify(
      {
        start: result.report.start,
        events: result.report.result.eclipseEvents,
        lostGenerationKWh: result.report.result.eclipseLostGenerationKWh,
        stepMinutes: 10,
        limits:
          "Actual JPL ephemeris, synthetic zero-height terrain. Not an independent event-timing validation.",
      },
      null,
      2,
    ),
  );
}, 120000);
it("runs every member of a nine-position candidate set and rechecks the shortlist", async () => {
  const ephem = readEphem(),
    source = {
      terrains: [],
      global: { width: 8, height: 4, h: new Float32Array(32) },
    };
  const f = [
    {
      id: "h",
      name: "Habitat",
      role: "habitat" as const,
      lat: 0,
      lon: 0,
      mast: 10,
      fixed: true,
    },
    {
      id: "p",
      name: "Array",
      role: "power" as const,
      lat: 0,
      lon: 0,
      mast: 10,
      areaM2: 20,
      fixed: false,
    },
  ];
  const result = await execute({
    kind: "search",
    facilities: f,
    source,
    ephem,
    start: Date.parse("2026-11-14T00:00:00Z"),
    settings: {
      ...DEFAULT_ENGINEERING,
      days: 1,
      requireEarth: false,
      maxSlopeDeg: 90,
    },
    radiusKm: 0.1,
    earthMaskDeg: 0,
    maxTowerM: 20,
  });
  expect(result.error).toBeUndefined();
  expect(result.tested).toBe(9);
  expect(result.alternatives).toHaveLength(3);
  for(const row of result.alternatives){
    expect(row.facilities.find((x:any)=>x.id==='h')).toEqual(f[0]);
    for(const facility of row.facilities){const {distanceKm}=await import('./network');expect(distanceKm(f[0],facility)).toBeLessThanOrEqual(.10000001)}
  }
  const independentlyRechecked=await execute({kind:'evaluate',facilities:result.alternatives[0].facilities,source,ephem,start:Date.parse('2026-11-14T00:00:00Z'),settings:{...DEFAULT_ENGINEERING,days:1,requireEarth:false,maxSlopeDeg:90},radiusKm:.1,earthMaskDeg:0,maxTowerM:20});
  expect(independentlyRechecked.error).toBeUndefined();
  expect(independentlyRechecked.report.result.feasible).toBe(result.alternatives[0].feasible);
  expect(independentlyRechecked.report.result.power.unmetKWh).toBeCloseTo(result.alternatives[0].unmetKWh,8);
  const original=await execute({kind:'evaluate',facilities:f,source,ephem,start:Date.parse('2026-11-14T00:00:00Z'),settings:{...DEFAULT_ENGINEERING,days:1,requireEarth:false,maxSlopeDeg:90},radiusKm:.1,earthMaskDeg:0,maxTowerM:20});
  const before=original.report.result,after=independentlyRechecked.report.result;
  expect(after.power.unmetKWh).toBeLessThanOrEqual(before.power.unmetKWh+1e-6);
  if(before.feasible)expect(after.feasible).toBe(true);
  mkdirSync(new URL('../../../qa/v15/',import.meta.url),{recursive:true});
  writeFileSync(new URL('../../../qa/v15/optimization.json',import.meta.url),JSON.stringify({kind:'One fixed synthetic-terrain search; actual shipped ephemeris',tested:result.tested,fixedAnchor:f[0],radiusKm:.1,start:original.report.start,settings:original.report.settings,before,after,limits:'Independent worker reevaluation, not independent physics implementation or global optimality proof.'},null,2));


  expect(
    result.alternatives.every((r: any) => Number.isFinite(r.unmetKWh)),
  ).toBe(true);
}, 120000);
it("finds a minimum tested relay height on a curvature-limited synthetic corridor", async () => {
  const count = 49,
    data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++)
    data.set([Math.sqrt(0.75), 0.5, 0, 149597870.7, 1, 0, 0, 384400], i * 8);
  const ephem = {
    t0Ms: Date.parse("2026-11-14T00:00:00Z"),
    stepS: 3600,
    count,
    data,
    kernels: ["synthetic analytic fixture"],
  };
  const source = {
    terrains: [],
    global: { width: 8, height: 4, h: new Float32Array(32) },
  };
  const facilities = [
    {
      id: "h",
      name: "Habitat",
      role: "habitat" as const,
      lat: 0,
      lon: 0,
      mast: 2,
      fixed: true,
    },
    {
      id: "p",
      name: "Array",
      role: "power" as const,
      lat: 0,
      lon: 0,
      mast: 2,
      areaM2: 20,
      fixed: true,
    },
    {
      id: "r",
      name: "Tower",
      role: "relay" as const,
      lat: 0,
      lon: 0.2,
      mast: 2,
      fixed: false,
    },
  ];
  const result = await execute({
    kind: "height",
    facilities,
    source,
    ephem,
    start: ephem.t0Ms,
    settings: {
      ...DEFAULT_ENGINEERING,
      days: 1,
      requireEarth: false,
      maxSlopeDeg: 90,
    },
    radiusKm: 1,
    earthMaskDeg: 0,
    maxTowerM: 20,
  });
  expect(result.error).toBeUndefined();
  expect(result.alternatives[0].feasible).toBe(true);
  expect(result.alternatives[0].towerM).toBe(5);
}, 120000);
it('requires actual replenishment in a 30-day low-start-charge lunar power demonstration',async()=>{
 const index=readPatchIndex()!,crest=index.patches.find(p=>p.kind==='crest20')!,terrain=readPolarTerrain(),patch=readPatch(index,crest.id),ephem=readEphem(),source={terrains:[patch,terrain],global:readCurrentGlobalDem()},start=Date.parse('2026-11-14T00:00:00Z');
 const settings={...DEFAULT_ENGINEERING,days:30,stepMinutes:60,batteryKWh:250,initialSoc:.2,reserveSoc:.2,requireEarth:false,maxSlopeDeg:90};
 const facilities=[{id:'hab',name:'Demonstration habitat',role:'habitat' as const,lat:-89.4399,lon:222.8524,mast:2,fixed:true},{id:'solar',name:'Demonstration array',role:'power' as const,lat:-89.4399,lon:222.8524,mast:2,areaM2:0}];
 const rows=[];for(const areaM2 of [0,20,40]){const run=await execute({kind:'evaluate',facilities:facilities.map(f=>f.role==='power'?{...f,areaM2}:f),source,ephem,start,settings,radiusKm:.1,earthMaskDeg:0,maxTowerM:20});expect(run.error).toBeUndefined();const r=run.report.result;rows.push({areaM2,result:r,profiles:run.report.profiles});expect(r.power.loadKWh).toBeCloseTo(720,6)}
 expect(rows[0].result.power.unmetKWh).toBeGreaterThan(600);expect(rows[2].result.power.generatedKWh).toBeGreaterThan(rows[1].result.power.generatedKWh);expect(rows[2].result.power.unmetKWh).toBeLessThan(rows[0].result.power.unmetKWh);
 mkdirSync(new URL('../../../qa/v16/',import.meta.url),{recursive:true});writeFileSync(new URL('../../../qa/v16/month_power.json',import.meta.url),JSON.stringify({site:facilities[0],start,settings,rows,limits:'Actual shipped JPL/LOLA inputs. Co-located electrical lesson, slope/Earth gates relaxed. Finite month, not an operational siting or repeating-cycle validation.'},null,2));
},120000)
it('records a separated-facility case where a taller relay restores modeled connectivity',async()=>{
 const {localFrame,R_KM}=await import('../lib/geo'),{lineOfSight}=await import('./network'),{DEFAULT_ASSUMPTIONS}=await import('../lib/assumptions');
 const index=readPatchIndex()!,crest=index.patches.find(p=>p.kind==='crest20')!,source={terrains:[readPatch(index,crest.id),readPolarTerrain()],global:readCurrentGlobalDem()},ephem=readEphem(),hab={id:'demo-hab',name:'Habitat',role:'habitat' as const,lat:-89.4399,lon:222.8524,mast:2,fixed:true},f=localFrame(hab.lat,hab.lon);
 const offset=(km:number,az:number)=>{const a=km/R_KM,v=f.u.map((u,i)=>u*Math.cos(a)+(f.n[i]*Math.cos(az)+f.e[i]*Math.sin(az))*Math.sin(a));return{lat:Math.asin(v[2])*180/Math.PI,lon:Math.atan2(v[1],v[0])*180/Math.PI}};
 let found:any;for(const km of [.1,.2,.4,.6,1]){for(let i=0;i<16;i++){const az=i*Math.PI/8,array={id:'demo-array',name:'Solar array',role:'power' as const,...offset(km,az),mast:2,areaM2:20,fixed:true},relay={id:'demo-relay',name:'Relay / bus junction',role:'relay' as const,...offset(km/2,az),mast:2,fixed:false};if(lineOfSight(hab,array,source).status!=='blocked')continue;for(const height of [10,20,30,50]){const raised={...relay,mast:height};if(lineOfSight(hab,raised,source).status==='clear'&&lineOfSight(array,raised,source).status==='clear'&&(lineOfSight(hab,relay,source).status!=='clear'||lineOfSight(array,relay,source).status!=='clear')){found={array,relay,height};break}}if(found)break}if(found)break}
 expect(found).toBeTruthy();const start=Date.parse('2026-11-14T00:00:00Z'),settings={...DEFAULT_ENGINEERING,days:30,stepMinutes:60,batteryKWh:250,initialSoc:.2,reserveSoc:.2,requireEarth:false,maxSlopeDeg:90,maxLinkKm:2},before=[hab,found.array,found.relay],after=before.map(x=>x.id==='demo-relay'?{...x,mast:found.height}:x),results=[];
 for(const facilities of [before,after]){const j=await execute({kind:'evaluate',facilities,source,ephem,start,settings,radiusKm:2,earthMaskDeg:0,maxTowerM:50});expect(j.error).toBeUndefined();results.push(j.report.result)}
 expect(results[0].electricalConnected).toBe(false);expect(results[1].electricalConnected).toBe(true);expect(results[1].power.generatedKWh).toBeGreaterThan(0);
 const dir=new URL('../../public/lunar/examples/',import.meta.url);mkdirSync(dir,{recursive:true});for(const [name,facilities] of [['spatial-before',before],['spatial-after',after]] as const)writeFileSync(new URL(name+'.json',dir),JSON.stringify({schema:'lunar-base-2',version:'1.7-preview',facilities,settings,start,criteria:DEFAULT_ASSUMPTIONS,radiusKm:2,maxTowerM:50,report:null,note:'Selected illustrative case over measured terrain. Ideal bus needs clear straight corridors via relay nodes; no cable routing/structural model. Earth and slope gates relaxed. Reevaluate after loading.'},null,2));
 mkdirSync(new URL('../../../qa/v17/',import.meta.url),{recursive:true});writeFileSync(new URL('../../../qa/v17/spatial_demo.json',import.meta.url),JSON.stringify({before,after,results,limits:'Selected explanatory case, not blind validation. Ideal shared bus and terrain-clear corridors, not cable routing. Earth/slope gates relaxed.'},null,2));
},120000)
it('executes the DSN gate on shipped station geometry and refuses uncovered periods',async()=>{
 const {readFileSync}=await import('node:fs');const meta=JSON.parse(readFileSync(new URL('../../public/data/dsn/stations.json',import.meta.url),'utf8')),bin=readFileSync(new URL('../../public/data/dsn/stations.bin',import.meta.url)),data=new Float32Array(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength)),dsn={start:Date.parse(meta.start),stepMs:meta.stepSeconds*1000,count:meta.count,stations:meta.stations,data},ephem=readEphem(),source={terrains:[],global:{width:8,height:4,h:new Float32Array(32)}},facilities=[{id:'h',name:'Habitat',role:'habitat' as const,lat:0,lon:0,mast:2,fixed:true},{id:'a',name:'Array',role:'power' as const,lat:0,lon:0,mast:2,areaM2:20}];
 const q:PlannerRequest={kind:'evaluate',facilities,source,ephem,dsn,start:Date.parse('2026-11-14T00:00:00Z'),settings:{...DEFAULT_ENGINEERING,days:2,stepMinutes:60,requireDsn:true,maxSlopeDeg:90},radiusKm:.1,earthMaskDeg:0,maxTowerM:20};
 const result=await execute(q);expect(result.error).toBeUndefined();expect(result.report.result.dsnContact).toHaveLength(48);expect(result.report.result.dsnShare).toBeGreaterThan(0);expect(result.report.result.dsnShare).toBeLessThanOrEqual(1);
 const bad=await execute({...q,start:Date.parse('2027-06-01T00:00:00Z')});expect(bad.error).toContain('DSN geometry covers');
 mkdirSync(new URL('../../../qa/v17/',import.meta.url),{recursive:true});writeFileSync(new URL('../../../qa/v17/dsn_worker.json',import.meta.url),JSON.stringify({start:q.start,settings:q.settings,result:result.report.result,uncoveredError:bad.error,limits:'Synthetic flat lunar terrain; actual station geometry. Does not validate terrain horizons or station scheduling.'},null,2));
},120000)
