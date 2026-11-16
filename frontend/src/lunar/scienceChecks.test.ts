import {it,expect} from 'vitest'
import {simulatePower,minimumBattery,DEFAULT_ENGINEERING} from './engineering'
it('matches the closed-form dark discharge at subhour resolution',()=>{
 // 10 kWh stored × 0.8 efficiency = 8 kWh delivered; ten hours at 1 kW leaves 2 kWh unmet.
 const r=simulatePower(Array(40).fill(0),1,.25,{batteryKWh:10,initialSoc:1,chargeEfficiency:.9,dischargeEfficiency:.8});
 expect(r.finalKWh).toBeCloseTo(0,10);expect(r.unmetKWh).toBeCloseTo(2,10);expect(r.dischargeLossKWh).toBeCloseTo(2,10);
})
it('matches analytic storage sizing and is invariant under constant-load time refinement',()=>{
 // Demand=24 kWh; usable delivered energy per kWh capacity=(1-.2)*.8=.64; capacity=37.5.
 const s={...DEFAULT_ENGINEERING,reserveSoc:.2,initialSoc:1,dischargeEfficiency:.8};
 const hourly=minimumBattery(Array(12).fill(0),2,1,s),quarter=minimumBattery(Array(48).fill(0),2,.25,s);
 expect(hourly).toBeCloseTo(37.5,5);expect(quarter).toBeCloseTo(37.5,5);
})
it('accounts for simultaneous direct supply and exact surplus curtailment with no battery',()=>{
 const r=simulatePower([2,2,2,2],1,.5,{batteryKWh:0,initialSoc:0,chargeEfficiency:1,dischargeEfficiency:1});
 expect(r.generatedKWh).toBe(4);expect(r.loadKWh).toBe(2);expect(r.curtailedKWh).toBe(2);expect(r.unmetKWh).toBe(0);
})
