/** LUNAR global raster reader. Grid metadata: north-first, -180-degree first edge,
 * pixel-centre sampling. NASA LOLA inputs remain credited in the manifest. */
import {decodePng,decodeHeights} from './terrain'
export interface GlobalDem {width:number;height:number;h:Float32Array}
export async function loadGlobalDem(root:string):Promise<GlobalDem>{
 const metadata=await (await fetch(root+'globe/globe.json')).json()
 if(!metadata.dem?.file)throw Error('Global elevation file is not specified')
 const image=await decodePng(root+'globe/'+metadata.dem.file)
 return {width:image.width,height:image.height,h:decodeHeights(image.data,image.width*image.height)}
}
export function globalHeightAt(map:GlobalDem,latitude:number,longitude:number):number{
 const column=(longitude/360+.5-Math.floor(longitude/360+.5))*map.width-.5
 const row=Math.max(0,Math.min(map.height-1,(.5-latitude/180)*map.height-.5))
 const left=Math.floor(column),top=Math.min(map.height-2,Math.floor(row)),dx=column-left,dy=row-top
 const wrap=(col:number)=>(col%map.width+map.width)%map.width
 const upper=map.h[top*map.width+wrap(left)]*(1-dx)+map.h[top*map.width+wrap(left+1)]*dx
 const lower=map.h[(top+1)*map.width+wrap(left)]*(1-dx)+map.h[(top+1)*map.width+wrap(left+1)]*dx
 return upper*(1-dy)+lower*dy
}
