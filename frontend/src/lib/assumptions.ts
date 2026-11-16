/** LUNAR screening conventions. These thresholds express user choices, not link budgets. */
import {DEFAULT_CRITERIA,type Criteria} from './windows'
export interface Assumptions {criteria:Criteria;observerM:number}
export type SunRule='any'|'half'|'all'
export const DEFAULT_OBSERVER_M=2
export const DEFAULT_ASSUMPTIONS:Assumptions={criteria:DEFAULT_CRITERIA,observerM:DEFAULT_OBSERVER_M}
export const SUN_RULES:readonly {id:SunRule;minSunFrac:number;label:string;text:string}[]=[
 {id:'any',minSunFrac:.001,label:'Solar edge',text:"any part of the Sun's disc is above the terrain"},
 {id:'half',minSunFrac:.5,label:'Solar centre',text:"at least half the Sun's disc is above the terrain"},
 {id:'all',minSunFrac:.999,label:'Full disc',text:"all of the Sun's disc is above the terrain"}]
export const EARTH_MASKS:readonly number[]=[0,2,5,10],OBSERVER_HEIGHTS:readonly number[]=[2,5,10]
export function sunRuleOf(criteria:Criteria):SunRule{
 let selected=0;for(let i=1;i<SUN_RULES.length;i++)if(Math.abs(SUN_RULES[i].minSunFrac-criteria.minSunFrac)<Math.abs(SUN_RULES[selected].minSunFrac-criteria.minSunFrac))selected=i
 return SUN_RULES[selected].id
}
export function sunRuleText(criteria:Criteria):string{return SUN_RULES.find(rule=>rule.id===sunRuleOf(criteria))!.text}
export function earthRuleText(criteria:Criteria,degree='°'):string{return criteria.earthMaskDeg>0?`Earth's centre is at least ${criteria.earthMaskDeg}${degree} above the terrain`:"Earth's centre is above the terrain"}
export function assumptionsText(settings:Assumptions,degree='°'):string{return `Sunlit means ${sunRuleText(settings.criteria)}; Earth in view means ${earthRuleText(settings.criteria,degree)}; panel and antenna ${settings.observerM} m above the ground.`}
export function isDefaultAssumptions(settings:Assumptions):boolean{return settings.observerM===DEFAULT_OBSERVER_M&&Object.entries(DEFAULT_CRITERIA).every(([key,value])=>settings.criteria[key as keyof Criteria]===value)}
export function horizonKey(lat:number,lon:number,patch:string,global:boolean,height:number):string{return [lat,lon,patch||'-',Number(global),height].join(',')}
