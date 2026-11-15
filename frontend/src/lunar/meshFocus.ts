// Refine an existing measured mesh in-place. No second height field, blend or shadow surface.
export function meshCoordinate(t:number,lo:number,hi:number,focus?:number,halfWidth=4000){
 if(t<=0)return lo
 if(t>=1)return hi
 if(focus===undefined||!Number.isFinite(focus)||focus<=lo||focus>=hi)return lo+(hi-lo)*t
 const a=focus-Math.min(halfWidth,(focus-lo)*.8),b=focus+Math.min(halfWidth,(hi-focus)*.8)
 if(t<=.15)return lo+(a-lo)*t/.15
 if(t<=.5)return a+(focus-a)*(t-.15)/.35
 if(t<=.85)return focus+(b-focus)*(t-.5)/.35
 return b+(hi-b)*(t-.85)/.15
}
