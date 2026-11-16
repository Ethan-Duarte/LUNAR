/** LUNAR state implementation. Public types remain compatible with existing UI
 * and project files. Mutations are implemented here independently of old store logic. */
import {useMemo} from 'react'
import {create} from 'zustand'
import {DEFAULT_ASSUMPTIONS,type Assumptions} from './lib/assumptions'
import {PRESETS,type FinderCriteria} from './lib/finder'
import type {Criteria} from './lib/windows'
export interface Detail {

  dpr: number

  steps: number
  growth: number

  grid: number
  globe: [number, number]

  halfFine: boolean
}
export interface ShowcaseSky {
  pinId: number
  sun: { az: number; el: number; radius: number; up: boolean }
  earth: { az: number; el: number; radius: number }

  horizon: Float32Array
  azStepDeg: number
}
export interface Pin {
  id: number
  lat: number
  lon: number
  hM: number
  label: string

  slot: number
}
interface State {
  shadowFill: number
  setShadowFill: (v: number) => void

  tMs: number
  playing: boolean

  moving: boolean
  setMoving: (moving: boolean) => void

  compareFigures: boolean
  setCompareFigures: (on: boolean) => void

  rate: number
  layer: LayerMode
  quality: Quality
  setQuality: (q: Quality) => void

  finder: FinderCriteria
  preset: string
  setFinder: (f: Partial<FinderCriteria>) => void
  applyPreset: (id: string) => void

  windowStart: number
  setWindowStart: (t: number) => void
  pins: Pin[]
  activePin: number | null
  view: ViewGoal
  goTo: (v: ViewRequest) => void

  arrivedSeq: number
  setArrived: (seq: number) => void

  timeRange: [number, number] | null
  setTimeRange: (r: [number, number]) => void
  setTime: (t: number) => void
  setPlaying: (p: boolean) => void
  setRate: (r: number) => void
  setLayer: (l: LayerMode) => void
  addPin: (p: Omit<Pin, 'id' | 'label' | 'slot'> & { label?: string }) => void
  removePin: (id: number) => void
  setActivePin: (id: number | null) => void

  sheet: SheetState
  setSheet: (s: SheetState) => void
  tab: PanelTab
  setTab: (t: PanelTab) => void

  fromFinder: Record<number, true>
  markFromFinder: (id: number) => void

  landingFocus: number | null
  focusLanding: (id: number | null) => void

  replaced: Replaced | null
  undoReplace: () => void
  dismissReplace: () => void

  baselines: Record<number, number>
  setBaseline: (pinId: number, tMs: number | null) => void

  showcase: string | null

  showcasePhase: ShowcasePhase | null

  showcaseSeq: number

  showcaseHome: ViewRequest | null

  startShowcase: (missionId: string, phase: 'flight' | 'request') => void
  setShowcase: (p: Partial<Pick<State, 'showcase' | 'showcasePhase' | 'showcaseSeq' | 'showcaseHome'>>) => void

  showcaseUp: boolean

  closeShowcase: () => void

  afterShowcase: (() => void) | null

  whenShowcaseClosed: (go: () => void) => void
  pinMission: Record<number, string>
  linkMission: (pinId: number, missionId: string) => void

  showcaseSky: ShowcaseSky | null
  setShowcaseSky: (s: ShowcaseSky | null) => void

  criteria: Criteria
  observerM: number
  setAssumptions: (a: Partial<Criteria> & { observerM?: number }) => void
  resetAssumptions: () => void

  assumeOpen: boolean
  setAssumeOpen: (open: boolean) => void

  help: boolean

  helpSeq: number
  setHelp: (on: boolean) => void


  welcome: boolean
  setWelcome: (on: boolean) => void
  mode: Mode
  setMode: (mode: Mode) => void
  tour: { guide: string; step: number } | null
  setTour: (tour: { guide: string; step: number } | null) => void
}
export interface Replaced {
  removed: Pin[]

  added: number[]
  at: number
}
export type LayerMode = 'natural' | 'elevation' | 'slope' | 'sunavg' | 'earthavg' | 'psr' | 'finder'
export type Quality = 'low' | 'medium' | 'high'
export interface Detail {

  dpr: number

  steps: number
  growth: number

  grid: number
  globe: [number, number]

  halfFine: boolean
}

export type SheetState = 'peek' | 'half' | 'full'
export type PanelTab = 'find' | 'sites'
export type ViewGoal =
  | { kind: 'pole'; seq: number }
  | { kind: 'globe'; seq: number; lat?: number; lon?: number }
  | { kind: 'site'; seq: number; lat: number; lon: number; hM: number }

  | { kind: 'approach'; seq: number; lat: number; lon: number; hM: number }
export type ViewRequest =
  | { kind: 'pole' }
  | { kind: 'globe'; lat?: number; lon?: number }
  | { kind: 'site'; lat: number; lon: number; hM: number }
  | { kind: 'approach'; lat: number; lon: number; hM: number }
export type ShowcasePhase = 'flight' | 'request' | 'approach' | 'ground' | 'leaving'
export type Mode = 'explore' | 'plan'
export const DETAIL:Record<Quality,Detail>={
 low:{dpr:1,steps:48,growth:1.2,grid:384,globe:[384,192],halfFine:true},
 medium:{dpr:1.5,steps:80,growth:1.125,grid:512,globe:[768,384],halfFine:false},
 high:{dpr:2,steps:120,growth:1.08,grid:768,globe:[1024,512],halfFine:false}}
export const SITE_COLORS=['#b6d4e3','#d9be79','#98c6b1']
export const coarsePointer=()=>typeof matchMedia!=='undefined'&&matchMedia('(pointer: coarse)').matches
export function rememberIntroSeen(){}
export function assumptionsOf(state:{criteria:Criteria;observerM:number}):Assumptions{return {criteria:state.criteria,observerM:state.observerM}}
function quality():Quality{try{const saved=localStorage.getItem('lunar-v1.quality');if(saved==='low'||saved==='medium'||saved==='high')return saved}catch{}return coarsePointer()?'low':'high'}
function persist(key:string,value:string){try{localStorage.setItem(key,value)}catch{}}
let serial=1
export const useStore=create<State>((set,get)=>{
 const field=<K extends keyof State>(key:K,value:State[K])=>set({[key]:value} as Pick<State,K>)
 const limit=(time:number)=>{const range=get().timeRange;return range?Math.max(range[0],Math.min(range[1],time)):time}
 return {
  shadowFill:.0015,setShadowFill:v=>field('shadowFill',v),tMs:Date.now(),playing:false,moving:false,setMoving:v=>field('moving',v),compareFigures:false,setCompareFigures:v=>field('compareFigures',v),rate:21600,layer:'natural',quality:quality(),
  setQuality:v=>{persist('lunar-v1.quality',v);field('quality',v)},finder:{...PRESETS[0].criteria},preset:PRESETS[0].id,
  setFinder:changes=>set({finder:{...get().finder,...changes},preset:'custom'}),applyPreset:id=>{const preset=PRESETS.find(p=>p.id===id);if(preset)set({finder:{...preset.criteria},preset:id})},
  windowStart:Math.floor(Date.now()/3600000)*3600000-172800000,setWindowStart:v=>field('windowStart',v),pins:[],activePin:null,view:{kind:'pole',seq:0},
  goTo:request=>field('view',{...request,seq:get().view.seq+1} as ViewGoal),arrivedSeq:0,setArrived:v=>field('arrivedSeq',v),timeRange:null,
  setTimeRange:range=>set({timeRange:range,tMs:Math.max(range[0],Math.min(range[1],get().tMs))}),setTime:v=>field('tMs',limit(v)),setPlaying:v=>field('playing',v),setRate:v=>field('rate',v),setLayer:v=>field('layer',v),
  addPin:input=>{
   const state=get(),retained=state.pins.slice(-2),used=new Set(retained.map(p=>p.slot)),slot=[0,1,2].find(i=>!used.has(i))??0,id=serial++
   const pin:Pin={...input,id,slot,label:input.label??'Point '+String.fromCharCode(65+slot)},removed=state.pins.filter(p=>!retained.includes(p)),now=Date.now()
   let replaced:Replaced|null=null
   const previous=state.replaced&&now-state.replaced.at<250?state.replaced:null
   if(removed.length||previous){
    const inserted=new Set(previous?.added??[]),evicted=new Set(removed.map(p=>p.id))
    const old=[...(previous?.removed??[]),...removed.filter(p=>!inserted.has(p.id))]
    if(old.length)replaced={removed:old,added:[...(previous?.added??[]).filter(i=>!evicted.has(i)),id],at:now}
   }
   set({pins:[...retained,pin],activePin:id,replaced})
  },
  removePin:id=>{const state=get(),removed=state.pins.find(p=>p.id===id),pins=state.pins.filter(p=>p.id!==id);set({pins,activePin:state.activePin===id?pins.at(-1)?.id??null:state.activePin,replaced:removed&&!state.replaced?.added.includes(id)?{removed:[removed],added:[],at:Date.now()}:null})},
  setActivePin:v=>field('activePin',v),sheet:'peek',setSheet:v=>field('sheet',v),tab:'sites',setTab:v=>field('tab',v),fromFinder:{},markFromFinder:id=>field('fromFinder',{...get().fromFinder,[id]:true}),landingFocus:null,focusLanding:v=>field('landingFocus',v),replaced:null,
  undoReplace:()=>{const state=get(),change=state.replaced;if(!change)return;const exclude=new Set([...change.added,...change.removed.map(p=>p.id)]),pins=[...change.removed,...state.pins.filter(p=>!exclude.has(p.id))].slice(-3);set({pins,activePin:pins.at(-1)?.id??null,replaced:null})},dismissReplace:()=>field('replaced',null),baselines:{},
  setBaseline:(id,time)=>{const values={...get().baselines};if(time===null)delete values[id];else values[id]=time;field('baselines',values)},
  showcase:null,showcasePhase:null,showcaseSeq:0,showcaseHome:null,showcaseUp:false,
  startShowcase:(id,phase)=>set({showcase:id,showcasePhase:phase,showcaseSeq:get().view.seq,tab:'sites'}),
  setShowcase:changes=>set({...changes,...(changes.showcasePhase==='ground'?{showcaseUp:true}:changes.showcasePhase===null?{showcaseUp:false}:{})}),
  closeShowcase:()=>{const phase=get().showcasePhase;if(phase==='ground'||phase==='approach')field('showcasePhase','leaving');else if(phase!=='leaving')set({showcase:null,showcasePhase:null,showcaseUp:false})},
  afterShowcase:null,whenShowcaseClosed:action=>{const state=get(),open=['ground','approach','leaving'].includes(state.showcasePhase??'');if(!open&&!state.afterShowcase){action();return}field('afterShowcase',action);if(open)get().closeShowcase()},
  pinMission:{},linkMission:(id,mission)=>field('pinMission',{...get().pinMission,[id]:mission}),showcaseSky:null,setShowcaseSky:v=>field('showcaseSky',v),criteria:{...DEFAULT_ASSUMPTIONS.criteria},observerM:DEFAULT_ASSUMPTIONS.observerM,
  setAssumptions:changes=>{const {observerM,...criteria}=changes;set({criteria:{...get().criteria,...criteria},observerM:observerM??get().observerM})},resetAssumptions:()=>set({criteria:{...DEFAULT_ASSUMPTIONS.criteria},observerM:DEFAULT_ASSUMPTIONS.observerM}),assumeOpen:false,setAssumeOpen:v=>field('assumeOpen',v),
  help:false,tour:null,welcome:false,setWelcome:v=>field('welcome',v),mode:'explore',setMode:mode=>{persist('lunar-v1.mode',mode);set({mode,layer:mode==='explore'&&['elevation','slope'].includes(get().layer)?'natural':get().layer})},setTour:v=>field('tour',v),helpSeq:0,setHelp:help=>set({help,helpSeq:get().helpSeq+Number(help)})
 }
})
export function useAssumptions():Assumptions{const criteria=useStore(s=>s.criteria),observerM=useStore(s=>s.observerM);return useMemo(()=>({criteria,observerM}),[criteria,observerM])}
