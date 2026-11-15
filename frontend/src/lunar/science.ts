// LUNAR integration. Scientific results are not recomputed by this UI.
export interface Sample {time:string;sun_alt:number;sun_az:number;earth_alt:number;earth_az:number;sunlit:boolean;earth_visible:boolean;sun_fraction:number}
export interface Event {time_utc:string;body:string;event:string;bracket_minutes:number}
export interface Study {id?:string;name:string;lat:number;lon:number;height_m:number;samples:Sample[];events:Event[];metrics:{sun_fraction:number;earth_fraction:number;both_fraction:number;sun_blackout_h:number;earth_blackout_h:number;temporal_bracket_minutes?:number;event_scan_minutes?:number};study:{start_utc:string;end_utc:string;sun_rule:string;earth_min_clearance_deg:number;cadence_hours:number;independent_validation?:string;dem?:string};horizon?:{az_deg:number[];alt_deg:number[]}}
export function closestSample(study:Study,t:number):Sample|undefined {const a=study.samples;if(!a.length)return;let lo=0,hi=a.length-1;while(lo<hi){const m=(lo+hi)>>1;if(Date.parse(a[m].time)<t)lo=m+1;else hi=m}return lo>0&&Math.abs(Date.parse(a[lo-1].time)-t)<Math.abs(Date.parse(a[lo].time)-t)?a[lo-1]:a[lo]}
export function intervals(study:Study,body:'sun'|'earth') {const start=Date.parse(study.study.start_utc),end=Date.parse(study.study.end_utc);let prev=start,on=body==='sun'?study.samples[0]?.sunlit:study.samples[0]?.earth_visible;const out:{start:number;end:number;on:boolean}[]=[];for(const e of study.events.filter(e=>e.body===body).sort((a,b)=>Date.parse(a.time_utc)-Date.parse(b.time_utc))){const t=Date.parse(e.time_utc);if(t<=start){on=e.event==='rise';continue}if(t>=end)break;out.push({start:prev,end:t,on:!!on});prev=t;on=e.event==='rise'}out.push({start:prev,end,on:!!on});return out}
export function exportFile(name:string,text:string,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function exportCSV(study:Study){const keys=['time','sun_alt','sun_az','earth_alt','earth_az','sun_fraction','sunlit','earth_visible'] as const;return keys.join(',')+'\n'+study.samples.map(r=>keys.map(k=>String(r[k])).join(',')).join('\n')}
export function batteryKWh(study:Study,loadW:number,usable:number){return loadW*study.metrics.sun_blackout_h/1000/usable}
export function studyFromResponse(payload:unknown):Study {
 const p=payload as {site?:Study};const s=p?.site;
 if(!s?.study||!s.metrics||!Array.isArray(s.samples)||!Array.isArray(s.events))throw Error('The Python engine returned an incomplete study; existing results were retained.');
 return s;
}
