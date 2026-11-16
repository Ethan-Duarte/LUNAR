/** LUNAR surface experiment. A sampled spherical mesh and two-resolution GPU
 * height field. Ray/height clearance supplies terrain shadows; no baked lighting. */
import {useMemo,useEffect} from 'react'
import * as T from 'three'
import {invalidate,type ThreeEvent} from '@react-three/fiber'
import {frameDirection,frameProject,sampleXY,sampleDir,type Terrain,type Level} from '../lib/terrain'
import {globalHeightAt,type GlobalDem} from '../lib/globalDem'
import {upVector,latLonOf,type Vec3} from '../lib/geo'
import type {Cut,GlobeMap,GlobeRelief} from './shading'
import {overMarker} from './markers'
import {heightfieldHit} from './pickRay'
import {meshCoordinate} from '../lunar/meshFocus'
import {useStore,type Detail,type LayerMode} from '../store'

export interface SurfaceProps {
 terrain:Terrain;sunDir:Vec3;sunRad:number;layer:LayerMode;score?:{tex:T.Texture;min:number;max:number}|null;
 dataBase:string;map:GlobeMap|null;relief:GlobeRelief|null;overlays:boolean;focus?:{lat:number;lon:number};
 cameraToBody?:T.Matrix4;renderTransform?:T.Matrix4;solarFactor?:number;interactive?:boolean;
 detail:Detail;cuts?:Cut[];onPick:(lat:number,lon:number)=>void;
}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x))
function worldHeight(d:Vec3,global:GlobalDem|null){const c=latLonOf(d);return global?globalHeightAt(global,c.lat,c.lon):0}
export function globeMeshHeight(global:GlobalDem,d:Vec3,_segments:[number,number]){return worldHeight(d,global)}
function blendAt(x:number,y:number,level:Level){
 const extent=Math.max(Math.abs(level.xMin),Math.abs(level.xMax),Math.abs(level.yMin),Math.abs(level.yMax))*.001
 return T.MathUtils.smoothstep(Math.hypot(x,y),Math.max(0,extent-Math.max(4,extent*.165)),Math.max(1,extent-2))
}
export function buildGeometry(terrain:Terrain,global:GlobalDem|null,subdivisions:number,_globe:[number,number],focus?:{lat:number;lon:number},transform?:T.Matrix4){
 const outer=terrain.levels[0],n=subdivisions+1,vertices:number[]=[],coordinates:number[]=[],indices:number[]=[],valid:boolean[]=[]
 const centre=focus?frameProject(terrain.frame,...upVector(focus.lat,focus.lon),terrain.radiusM):null
 const anchor=centre&&centre[0]>outer.xMin&&centre[0]<outer.xMax&&centre[1]>outer.yMin&&centre[1]<outer.yMax?centre:null
 const point=new T.Vector3()
 function append(direction:Vec3,radius:number,x:number,y:number){
  point.set(...direction).multiplyScalar(radius);if(transform)point.applyMatrix4(transform)
  vertices.push(point.x,point.y,point.z);coordinates.push(x,y)
 }
 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const x=meshCoordinate(col/subdivisions,outer.xMin,outer.xMax,anchor?.[0]),y=meshCoordinate(1-row/subdivisions,outer.yMin,outer.yMax,anchor?.[1])
  const direction=frameDirection(terrain.frame,x,y,terrain.radiusM)
  const local=sampleXY(terrain,clamp(x,outer.xMin+outer.pixel,outer.xMax-outer.pixel),clamp(y,outer.yMin+outer.pixel,outer.yMax-outer.pixel))
  const coarse=worldHeight(direction,global),weight=blendAt(x*.001,y*.001,outer)
  valid.push(Number.isFinite(local)||!!global)
  const height=Number.isFinite(local)?local*(1-weight)+coarse*weight:coarse
  append(direction,(terrain.radiusM+height)*.001,x*.001,y*.001)
 }
 for(let row=0;row<subdivisions;row++)for(let col=0;col<subdivisions;col++){
  const a=row*n+col,b=a+1,c=a+n,d=c+1
  if([a,b,c,d].every(i=>valid[i]))indices.push(a,c,b,b,c,d)
 }
 // Close the mesh perimeter with radial skirts. Skirts are visual geometry only.
 const border:number[]=[]
 for(let i=0;i<subdivisions;i++)border.push(i)
 for(let i=0;i<subdivisions;i++)border.push(i*n+subdivisions)
 for(let i=subdivisions;i>0;i--)border.push(subdivisions*n+i)
 for(let i=subdivisions;i>0;i--)border.push(i*n)
 const offset=vertices.length/3
 border.forEach(index=>{
  const x=coordinates[index*2],y=coordinates[index*2+1],d=frameDirection(terrain.frame,x*1000,y*1000,terrain.radiusM)
  const h=sampleXY(terrain,clamp(x*1000,outer.xMin+outer.pixel,outer.xMax-outer.pixel),clamp(y*1000,outer.yMin+outer.pixel,outer.yMax-outer.pixel))
  const z=Number.isFinite(h)?h:worldHeight(d,global)
  append(d,(terrain.radiusM+z)*.001-6,x,y)
 })
 border.forEach((a,i)=>{const j=(i+1)%border.length,b=border[j];if(valid[a]&&valid[b])indices.push(a,offset+i,b,b,offset+i,offset+j)})
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('aXY',new T.Float32BufferAttribute(coordinates,2));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry
}
const vertex=`attribute vec2 aXY; varying vec2 location; void main(){location=aXY;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`
const fragment=`
precision highp float;
varying vec2 location;
uniform sampler2D coarseHeight,fineHeight,photo,overlay,scoreMap;
uniform vec4 coarseExtent,fineExtent;
uniform vec2 dimensions,scoreRange;
uniform vec3 east,north,vertical,sun;
uniform float radius,photoOrigin,hasPhoto,solarRadius,solarScale,exposure,shadowFill,traceGrowth,traceLimit,traceCount;
uniform int mode,cutCount;
uniform vec3 cutX[5],cutY[5],cutZ[5];uniform float cutSize[5];
vec2 uv(vec2 p,vec4 box){return vec2((p.x-box.x)/(box.z-box.x),(box.w-p.y)/(box.w-box.y));}
bool contained(vec2 q){return min(q.x,q.y)>=0.0&&max(q.x,q.y)<=1.0;}
float bilinear(sampler2D source,vec2 q,float size){
 vec2 t=clamp(q*size-0.5,vec2(0.),vec2(size-1.)),base=floor(t),f=fract(t);
 vec2 a=(base+0.5)/size,b=min((base+1.5)/size,vec2(1.-0.5/size));
 return mix(mix(texture2D(source,a).r,texture2D(source,vec2(b.x,a.y)).r,f.x),mix(texture2D(source,vec2(a.x,b.y)).r,texture2D(source,b).r,f.x),f.y);
}
float altitude(vec2 p){vec2 fine=uv(p,fineExtent);if(contained(fine))return bilinear(fineHeight,fine,dimensions.y);return bilinear(coarseHeight,uv(p,coarseExtent),dimensions.x);}
vec3 radial(vec2 p){vec2 a=p/(2.*radius);float q=dot(a,a);return (2.*a.x*east+2.*a.y*north+(1.-q)*vertical)/(1.+q);}
vec2 project(vec3 d){return 2.*radius*vec2(dot(d,east),dot(d,north))/(1.+dot(d,vertical));}
vec3 positionAt(vec2 p){return radial(p)*(radius+altitude(p));}
vec3 response(vec3 albedo,float light){return vec3(1.)-exp(-albedo*(light+shadowFill)*exposure);}
vec3 palette(float value,vec3 low,vec3 high){return mix(low,high,clamp(value,0.,1.));}
void main(){
 vec2 chart=uv(location,coarseExtent);if(!contained(chart))discard;
 vec3 p=positionAt(location),up=normalize(p);
 for(int c=0;c<5;c++){
  if(c>=cutCount)break;float z=dot(up,cutZ[c]);vec2 q=2.*radius*vec2(dot(up,cutX[c]),dot(up,cutY[c]))/(1.+z);
  if(z>0.5&&max(abs(q.x),abs(q.y))<cutSize[c])discard;
 }
 vec4 box=contained(uv(location,fineExtent))?fineExtent:coarseExtent;
 float width=contained(uv(location,fineExtent))?dimensions.y:dimensions.x;
 float spacing=(box.z-box.x)/width;
 vec3 dx=positionAt(location+vec2(spacing,0.))-positionAt(location-vec2(spacing,0.));
 vec3 dy=positionAt(location+vec2(0.,spacing))-positionAt(location-vec2(0.,spacing));
 vec3 normal=normalize(cross(dx,dy));if(dot(normal,up)<0.)normal=-normal;
 float visibility=1.,distance=max(spacing,0.025),minimum=1.;
 vec3 origin=p+up*0.003;
 for(int step=0;step<160;step++){
  if(float(step)>=traceCount||distance>traceLimit)break;
  vec3 ray=origin+distance*sun;float lengthRay=length(ray);vec2 q=project(ray/lengthRay);
  if(!contained(uv(q,coarseExtent)))break;
  minimum=min(minimum,(lengthRay-radius-altitude(q))/distance);
  if(minimum < -solarRadius)break;
  distance=distance*traceGrowth+0.001;
 }
 visibility=smoothstep(-solarRadius,solarRadius,minimum);
 float direct=max(dot(normal,sun),0.)*visibility*solarScale;
 vec2 photoUV=vec2(fract((atan(up.y,up.x)-photoOrigin)/6.28318530718),asin(clamp(up.z,-1.,1.))/3.14159265359+0.5);
 vec3 albedo=mix(vec3(0.4),pow(texture2D(photo,photoUV).rgb,vec3(2.2)),hasPhoto),colour=response(albedo,direct);
 float value=texture2D(overlay,chart).r,relief=0.45+0.55*(1.-exp(-direct*6.));
 if(mode==1)colour=palette((altitude(location)+4.5)/9.,vec3(.05,.12,.24),vec3(.9,.78,.5))*relief;
 if(mode==2)colour=palette(degrees(acos(clamp(dot(normal,up),-1.,1.)))/25.,vec3(.12,.6,.35),vec3(.85,.16,.08))*relief;
 if(mode==3)colour=palette(value*255./250.,vec3(.12,.03,.2),vec3(1.,.9,.5))*relief;
 if(mode==4)colour=palette(value*255./250.,vec3(.03,.08,.16),vec3(.7,.92,1.))*relief;
 if(mode==5&&value>.5)colour=mix(colour,vec3(.16,.55,.7),.7);
 if(mode==6){float fit=texture2D(scoreMap,chart).r*255.;colour=fit<.5?vec3(.12)*relief:palette(((fit-1.)/254.-scoreRange.x)/max(.02,scoreRange.y-scoreRange.x),vec3(.03,.3,.34),vec3(.86,.95,.5))*relief;}
 gl_FragColor=vec4(pow(max(colour,vec3(0.)),vec3(1./2.2)),1.);
}`
function textureFor(terrain:Terrain,level:Level,global:GlobalDem|null){
 const values=new Float32Array(level.h.length)
 for(let i=0;i<values.length;i++){
  let height=level.h[i]
  if(!Number.isFinite(height)){const d=frameDirection(terrain.frame,level.xMin+(i%level.size+.5)*level.pixel,level.yMax-(Math.floor(i/level.size)+.5)*level.pixel,terrain.radiusM);height=worldHeight(d,global)}
  values[i]=height*.001
 }
 const texture=new T.DataTexture(values,level.size,level.size,T.RedFormat,T.FloatType);texture.minFilter=texture.magFilter=T.NearestFilter;texture.needsUpdate=true;return texture
}
const images=new Map<string,T.Texture>()
const files:Partial<Record<LayerMode,string>>={sunavg:'sun_avg.png',earthavg:'earth_avg.png',psr:'psr.png'}
function image(url:string){if(!images.has(url)){const tex=new T.TextureLoader().load(url,()=>invalidate());tex.flipY=false;tex.generateMipmaps=false;tex.minFilter=tex.magFilter=T.LinearFilter;images.set(url,tex)}return images.get(url)!}
export function preloadOverlays(base:string){Object.values(files).forEach(file=>image(base+'layers/'+file))}
const empty=new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);empty.needsUpdate=true
const extent=(l:Level)=>new T.Vector4(l.xMin*.001,l.yMin*.001,l.xMax*.001,l.yMax*.001)
export function LunarSurface(props:SurfaceProps){
 const {terrain,detail,relief}=props,global=relief?.dem??null
 const geometry=useMemo(()=>buildGeometry(terrain,global,props.overlays||props.focus?detail.grid:Math.min(detail.grid,384),detail.globe,props.focus,props.renderTransform),[terrain,global,detail.grid,props.overlays,props.focus?.lat,props.focus?.lon,props.renderTransform])
 const resources=useMemo(()=>{
  const outer=terrain.levels[0],inner=terrain.levels[terrain.levels.length-1]
  const coarse=textureFor(terrain,outer,global),fine=textureFor(terrain,inner,global)
  const uniforms={coarseHeight:{value:coarse},fineHeight:{value:fine},photo:{value:empty},overlay:{value:empty},scoreMap:{value:empty},
   coarseExtent:{value:extent(outer)},fineExtent:{value:extent(inner)},dimensions:{value:new T.Vector2(outer.size,inner.size)},scoreRange:{value:new T.Vector2(0,1)},
   east:{value:new T.Vector3(...terrain.frame.ax)},north:{value:new T.Vector3(...terrain.frame.ay)},vertical:{value:new T.Vector3(...terrain.frame.up)},sun:{value:new T.Vector3()},
   radius:{value:terrain.radiusM*.001},photoOrigin:{value:-Math.PI},hasPhoto:{value:0},solarRadius:{value:.00465},solarScale:{value:1},exposure:{value:1.32},shadowFill:{value:.0015},traceGrowth:{value:detail.growth},traceLimit:{value:1000},traceCount:{value:detail.steps},mode:{value:0},cutCount:{value:0},
   cutX:{value:Array.from({length:5},()=>new T.Vector3())},cutY:{value:Array.from({length:5},()=>new T.Vector3())},cutZ:{value:Array.from({length:5},()=>new T.Vector3())},cutSize:{value:Array(5).fill(0)}}
  return {coarse,fine,material:new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,side:T.DoubleSide})}
 },[terrain,global,detail.steps,detail.growth])
 useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>{resources.material.dispose();resources.coarse.dispose();resources.fine.dispose()},[resources])
 const {material}=resources,u=material.uniforms
 u.sun.value.set(...props.sunDir);u.solarRadius.value=Math.max(1e-6,props.sunRad);u.solarScale.value=props.solarFactor??1
 u.photo.value=props.map?.tex??empty;u.photoOrigin.value=props.map?.lonLeftRad??-Math.PI;u.hasPhoto.value=Number(!!props.map)
 const modes:LayerMode[]=['natural','elevation','slope','sunavg','earthavg','psr','finder']
 u.mode.value=modes.indexOf(props.overlays||['elevation','slope'].includes(props.layer)?props.layer:'natural')
 u.overlay.value=props.overlays&&files[props.layer]?image(props.dataBase+'layers/'+files[props.layer]):empty
 u.scoreMap.value=props.score?.tex??empty;u.scoreRange.value.set(props.score?.min??0,props.score?.max??1)
 const cuts=(props.cuts??[]).slice(0,5);u.cutCount.value=cuts.length;cuts.forEach((c,i)=>{u.cutX.value[i].set(...c.frame.ax);u.cutY.value[i].set(...c.frame.ay);u.cutZ.value[i].set(...c.frame.up);u.cutSize.value[i]=Math.max(0,c.halfKm-1.5)})
 const pick=useMemo(()=>function(this:T.Mesh,raycaster:T.Raycaster,hits:T.Intersection[]){
  if(props.interactive===false)return
  const bodyRay=raycaster.ray.clone();if(props.renderTransform)bodyRay.applyMatrix4(props.renderTransform.clone().invert())
  const distance=heightfieldHit(bodyRay.origin,bodyRay.direction,terrain.radiusM*.001,(x,y,z)=>sampleDir(terrain,x,y,z)*.001)
  if(distance===null)return
  const point=bodyRay.at(distance,new T.Vector3());if(props.renderTransform)point.applyMatrix4(props.renderTransform)
  const actual=point.distanceTo(raycaster.ray.origin);if(actual>=raycaster.near&&actual<=raycaster.far)hits.push({object:this,point,distance:actual})
 },[terrain,props.renderTransform,props.interactive])
 function select(e:ThreeEvent<MouseEvent>){if(props.interactive===false||e.delta>4||overMarker(e.intersections))return;e.stopPropagation();const point=e.point.clone();if(props.renderTransform)point.applyMatrix4(props.renderTransform.clone().invert());const ll=latLonOf([point.x,point.y,point.z]);props.onPick(ll.lat,ll.lon)}
 return <mesh geometry={geometry} material={material} raycast={pick} onClick={select} onBeforeRender={(_r,_s,camera)=>{
  const p=props.cameraToBody?camera.position.clone().applyMatrix4(props.cameraToBody):camera.position
  const altitude=Math.max(1,p.length()-terrain.radiusM*.001),incidence=p.clone().normalize().dot(u.sun.value)
  const near=Math.min(8.25,1.32/Math.max(.001,incidence)),blend=T.MathUtils.smoothstep(Math.log(altitude),Math.log(700),Math.log(3500))
  u.exposure.value=Math.exp((1-blend)*Math.log(near)+blend*Math.log(1.32));u.shadowFill.value=useStore.getState().shadowFill
  const busy=useStore.getState().moving||useStore.getState().playing;u.traceCount.value=busy?Math.min(48,detail.steps):detail.steps;u.traceGrowth.value=busy?Math.max(1.2,detail.growth):detail.growth
 }}/>
}
