import {useEffect,useRef,type ReactNode} from 'react'
import type {Mission} from '../scene/Missions'
export function MissionInfoPanel({mission,open,onToggle,onBrowse,onDaylight,children}:{mission:Mission;open:boolean;onToggle:()=>void;onBrowse:()=>void;onDaylight:()=>void;children:ReactNode}){
 const content=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(content.current)content.current.scrollTop=0},[mission.id])
 return <aside className={'mission-info '+(open?'is-open':'is-closed')} aria-label="Mission information"><header><div><small>LUNAR / MISSION FILE</small><h2>{mission.name}</h2></div><button aria-expanded={open} aria-controls="mission-info-content" onClick={onToggle}>{open?'Collapse info':'Open mission info'}</button></header><div hidden={!open} id="mission-info-content" className="mission-info-scroll" ref={content}><div className="v1-actions"><button onClick={onDaylight}>Find daylight at this site</button><button onClick={onBrowse}>Browse missions</button></div>{children}</div></aside>
}
