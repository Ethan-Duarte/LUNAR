import {it,expect} from 'vitest'
import {readiness} from './Readiness'
import {DEFAULT_ENGINEERING} from './engineering'
it('forms the joint mask from simultaneous samples rather than multiplying percentages',()=>{
 const result={generation:[2,0,2],power:{unmetKW:[0,1,0],socKWh:[100,80,10,80]},electricalConnected:true,contact:[true,true,false]} as any;
 const r=readiness(result,{...DEFAULT_ENGINEERING,batteryKWh:100,reserveSoc:.2,requireEarth:true});expect(r.joint).toEqual([true,false,false]);expect(r.share).toBeCloseTo(1/3);expect(r.storage).toEqual([true,false,true]);
 const noContact=readiness(result,{...DEFAULT_ENGINEERING,batteryKWh:100,reserveSoc:.2,requireEarth:false});expect(noContact.joint).toEqual([true,false,true]);
 result.electricalConnected=false;expect(readiness(result,DEFAULT_ENGINEERING).joint.some(Boolean)).toBe(false);
})
it('allows battery-supported operation at night while exposing no delivered solar',()=>{
 const r=readiness({generation:[0],power:{unmetKW:[0],socKWh:[100,90]},electricalConnected:true,contact:[true]} as any,{...DEFAULT_ENGINEERING,batteryKWh:100,reserveSoc:.2});expect(r.solar).toEqual([false]);expect(r.joint).toEqual([true]);
})
it('includes DSN only when required and never treats missing DSN evidence as a pass',()=>{
 const result={generation:[1],power:{unmetKW:[0],socKWh:[100,90]},electricalConnected:true,contact:[true],dsnContact:[false]} as any;
 expect(readiness(result,{...DEFAULT_ENGINEERING,requireDsn:true}).joint).toEqual([false]);expect(readiness(result,{...DEFAULT_ENGINEERING,requireDsn:false}).joint).toEqual([true]);delete result.dsnContact;expect(readiness(result,{...DEFAULT_ENGINEERING,requireDsn:true}).joint).toEqual([false]);
})
