/** LUNAR's demand-driven WebGL host. Graphics failure leaves the science UI usable. */
import {useEffect,useState,type ReactNode} from 'react'
import {Canvas,useThree} from '@react-three/fiber'
import {DETAIL,useStore,type Quality} from '../store'
export const useBusy=()=>useStore(s=>s.moving||s.playing)
function ResizeRefresh(){
 const {size,viewport,invalidate}=useThree()
 useEffect(()=>{invalidate();let second=0;const first=requestAnimationFrame(()=>{invalidate();second=requestAnimationFrame(()=>invalidate())});return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)}},[size.width,size.height,viewport.dpr,invalidate])
 return null
}
export function MoonCanvas({quality,children}:{quality:Quality;children:ReactNode}){
 const busy=useBusy(),[ready]=useState(()=>{try{const context=document.createElement('canvas').getContext('webgl2');if(!context)return false;context.getExtension('WEBGL_lose_context')?.loseContext();return true}catch{return false}})
 if(!ready)return <div className="lunar-gl-fallback" role="status"><h2>3D needs WebGL 2</h2><p>Enable graphics acceleration and reload. Your analysis tools remain available.</p></div>
 return <Canvas frameloop="demand" camera={{position:[260,-180,-2067.4],up:[0,0,-1],near:1,far:30000,fov:40}} dpr={[1,busy?1:DETAIL[quality].dpr]} gl={{antialias:quality!=='low',powerPreference:'high-performance'}}><ResizeRefresh/>{children}</Canvas>
}
