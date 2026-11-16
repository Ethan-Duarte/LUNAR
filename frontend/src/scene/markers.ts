/** LUNAR pointer arbitration for round screen markers. */
import type {Intersection} from 'three'
export const MARKER={marker:true}
export function insideDisc(hit:{uv?:{x:number;y:number}|null}):boolean{
 if(hit.uv==null)return true
 const horizontal=hit.uv.x-.5,vertical=hit.uv.y-.5
 return horizontal*horizontal+vertical*vertical<=.25
}
export function overMarker(hits:Pick<Intersection,'object'|'uv'>[]):boolean{
 for(const hit of hits){if(!hit.object.visible)continue;if(hit.object.userData.marker===true&&insideDisc(hit))return true}
 return false
}
