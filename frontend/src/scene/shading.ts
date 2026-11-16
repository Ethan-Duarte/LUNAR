/** LUNAR display-data hooks. NASA image/DEM records retain their source metadata. */
import {useEffect,useState} from 'react'
import * as T from 'three'
import {invalidate} from '@react-three/fiber'
import {loadGlobalDem,type GlobalDem} from '../lib/globalDem'
import type {Frame} from '../lib/terrain'
export interface GlobeMap {tex:T.Texture;lonLeftRad:number}
export interface GlobeRelief {dem:GlobalDem;tex:T.DataTexture}
export interface Cut {frame:Frame;halfKm:number}
export function useGlobeMap(root:string):GlobeMap|null{
 const [result,setResult]=useState<GlobeMap|null>(null)
 useEffect(()=>{
  let active=true,loaded:T.Texture|undefined
  async function open(){
   const response=await fetch(root+'globe/globe.json');if(!response.ok)throw Error('Missing globe manifest')
   const record=await response.json(),texture=await new T.TextureLoader().loadAsync(root+'globe/'+(record.files?.color_4k??record.file))
   loaded=texture
   if(!active){texture.dispose();return}
   texture.colorSpace=T.NoColorSpace;texture.minFilter=texture.magFilter=T.LinearFilter;texture.generateMipmaps=false
   setResult({tex:texture,lonLeftRad:(record.lon_left_deg??-180)*Math.PI/180});invalidate()
  }
  void open().catch(()=>{if(active)setResult(null)})
  return ()=>{active=false;loaded?.dispose()}
 },[root]);return result
}
export function useGlobeRelief(root:string):{relief:GlobeRelief|null;settled:boolean}{
 const [result,setResult]=useState<{relief:GlobeRelief|null;settled:boolean}>({relief:null,settled:false})
 useEffect(()=>{
  let active=true,texture:T.DataTexture|undefined
  void loadGlobalDem(root).then(dem=>{
   if(!active)return
   const rows=new Uint16Array(dem.width*dem.height)
   for(let row=0;row<dem.height;row++)for(let col=0;col<dem.width;col++)rows[row*dem.width+col]=T.DataUtils.toHalfFloat(dem.h[(dem.height-row-1)*dem.width+col]*.001)
   texture=new T.DataTexture(rows,dem.width,dem.height,T.RedFormat,T.HalfFloatType)
   texture.minFilter=texture.magFilter=T.LinearFilter;texture.wrapS=T.RepeatWrapping;texture.needsUpdate=true
   setResult({relief:{dem,tex:texture},settled:true});invalidate()
  }).catch(()=>{if(active)setResult({relief:null,settled:true})})
  return ()=>{active=false;texture?.dispose()}
 },[root]);return result
}
