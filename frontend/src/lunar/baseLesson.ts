export const BASE_LESSON=[
 {title:'A first electrical design',body:'We will place a habitat and array, evaluate them, deliberately cause a power shortfall, then repair and save the design. Your current design is backed up until you choose to keep this lesson. This two-day lesson starts with a charged battery; it is not a long-term base proposal.',target:'lesson'},
 {title:'Place the habitat',body:'Choose habitat below, then Use selected observer. This fixes the habitat at the marked location. A component is only added by an explicit button or Add component mode.',target:'components'},
 {title:'Add a solar array',body:'Choose power, then Use selected observer. For this electrical lesson the array and habitat may share a point. Real layouts need separate foundations and spatial checks. Array area controls generation; it does not set demand.',target:'components'},
 {title:'Evaluate and read the answer',body:'Click Evaluate design. Read demand, generation, battery charge and the constraint list. Zero unmet demand only means the electrical demand was supplied—it does not prove connectivity, Earth contact or safe terrain.',target:'evaluate'},
 {title:'Make power insufficient',body:'Click Try insufficient power below, then Evaluate design again. Array area and battery capacity become zero. The two-day, 1 kW mission should show 48 kWh unmet demand.',target:'evaluate'},
 {title:'Repair the electrical design',body:'Click Restore lesson power, then Evaluate design. Compare unmet demand with the failed case. A precharged 100 kWh battery alone can cover this short mission; extend duration to study whether the array replenishes it.',target:'evaluate'},
 {title:'Save and continue exploring',body:'Save the complete project below. Outside the lesson, select a component, choose Move component, and click its new position. Evaluate again, then try a bounded search. Keep this design or restore the design you had before the lesson.',target:'save'}
]
export function lessonCanAdvance(step:number,facilities:{role:string}[],report:{power:{unmetKWh:number}}|null){
 if(step===1)return facilities.some(f=>f.role==='habitat')
 if(step===2)return facilities.some(f=>f.role==='power')
 if(step===3)return report!==null
 if(step===4)return report!==null&&report.power.unmetKWh>1e-6
 if(step===5)return report!==null&&report.power.unmetKWh<=1e-6
 return true
}
