import {it,expect} from 'vitest'
import {readEphem} from '../lib/testData'
import {bodyVectors,skyAt} from '../lib/ephem'
import {eclipseFactor} from '../lib/windows'
import {writeFileSync,mkdirSync} from 'node:fs'
it('checks a lunar eclipse against an independent NASA event prediction with a declared five-minute window',()=>{
 const e=readEphem(),reference=Date.parse('2025-03-14T06:58:41.700Z');let best={time:0,angle:Infinity};
 for(let t=Math.floor((reference-20*60000)/60000)*60000;t<=reference+20*60000;t+=60000){const v=bodyVectors(e,t),cos=v.sun.reduce((s,x,i)=>s+x*v.earth[i],0)/(Math.hypot(...v.sun)*Math.hypot(...v.earth)),angle=Math.acos(Math.max(-1,Math.min(1,cos)));if(angle<best.angle)best={time:t,angle}}
 const checks=['2025-03-14T03:00:00Z','2025-03-14T06:45:00Z','2025-03-14T07:15:00Z','2025-03-14T11:00:00Z'].map(utc=>({utc,unocculted:eclipseFactor(skyAt(e,Date.parse(utc),0,0,0))}));
 const output={reference:'https://eclipse.gsfc.nasa.gov/LEplot/LEplot2001/LE2025Mar14T.pdf',referenceGreatestUT:'2025-03-14T06:58:41.7',predictedMoonCentreMinimumSeparationUTC:new Date(best.time).toISOString(),differenceMinutes:(best.time-reference)/60000,declaredToleranceMinutes:5,sampleMinutes:1,site:[0,0],checks,limits:'Moon-centre alignment and safely interior/exterior event classification. Global eclipse contacts are not local surface contacts. UT versus UTC difference below one second is neglected. No contact-timing, atmosphere or terrain-mask certification.'};
 mkdirSync(new URL('../../../qa/v16/',import.meta.url),{recursive:true});writeFileSync(new URL('../../../qa/v16/eclipse_reference.json',import.meta.url),JSON.stringify(output,null,2));
 expect(Math.abs(best.time-reference)).toBeLessThanOrEqual(5*60000);expect(checks[0].unocculted).toBeGreaterThan(.999);expect(checks[1].unocculted).toBeLessThan(1e-8);expect(checks[2].unocculted).toBeLessThan(1e-8);expect(checks[3].unocculted).toBeGreaterThan(.999);
})
