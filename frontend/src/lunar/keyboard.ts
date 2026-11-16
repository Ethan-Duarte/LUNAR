// Timeline shortcuts respect native controls and active dialogs.
export function timelineKey(e:KeyboardEvent,actions:{time:number;playing:boolean;bounds:[number,number];onTime:(t:number)=>void;onPlay:(v:boolean)=>void;onHelp:()=>void;onEscape:()=>void}){
 if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return
 const el=e.target as HTMLElement|null
 if(e.key==='Escape'){actions.onEscape();return}
 if(el?.closest('input,textarea,select,button,a,[contenteditable="true"],[role="button"],[role="slider"],[role="dialog"]')||document.querySelector('[role="dialog"]'))return
 if(e.key==='?'&&!e.repeat){e.preventDefault();actions.onHelp();return}
 if(e.code==='Space'||e.key===' '){e.preventDefault();if(!e.repeat)actions.onPlay(!actions.playing);return}
 let next:number|undefined
 if(e.key==='ArrowLeft'||e.key==='ArrowRight')next=actions.time+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?60:10)*60000
 if(e.key==='Home')next=actions.bounds[0]
 if(e.key==='End')next=actions.bounds[1]
 if(next!==undefined){e.preventDefault();actions.onPlay(false);actions.onTime(Math.max(actions.bounds[0],Math.min(actions.bounds[1],next)))}
}
