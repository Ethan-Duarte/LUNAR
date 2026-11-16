import {useRef,useEffect} from 'react'
import {useFrame} from '@react-three/fiber'
import {useStore} from '../store'
/** Debounce camera motion so idle frames restore display detail. */
export function MovingDetail(){
 const previous=useRef<number[]>([]),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
 useEffect(()=>()=>clearTimeout(timer.current),[])
 useFrame(({camera})=>{
  const current=camera.matrixWorld.elements
  const changed=current.some((v,i)=>Math.abs(v-(previous.current[i]??Infinity))>Math.max(1,Math.abs(v))*1e-7)
  if(!changed)return
  previous.current=Array.from(current);if(!useStore.getState().moving)useStore.getState().setMoving(true)
  clearTimeout(timer.current);timer.current=setTimeout(()=>useStore.getState().setMoving(false),160)
 });return null
}
