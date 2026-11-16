/** LUNAR pointer intersection: bound the ray by a lunar elevation envelope, advance
 * conservatively outside it, then bracket and bisect the first sampled crossing. */
import {Ray,Sphere,Vector3} from 'three'
type V={x:number;y:number;z:number}
export function sphereHit(origin:V,direction:V,radius:number):number|null{
 const start=new Vector3(origin.x,origin.y,origin.z),ray=new Ray(start,new Vector3(direction.x,direction.y,direction.z))
 const hit=ray.intersectSphere(new Sphere(new Vector3(),radius),new Vector3())
 return hit?hit.distanceTo(start):null
}
export function heightfieldHit(origin:V,direction:V,radius:number,height:(x:number,y:number,z:number)=>number):number|null{
 const o=new Vector3(origin.x,origin.y,origin.z),d=new Vector3(direction.x,direction.y,direction.z).normalize(),envelope=radius+12
 const projection=o.dot(d),discriminant=projection*projection-o.lengthSq()+envelope*envelope
 if(discriminant<0)return null
 const end=-projection+Math.sqrt(discriminant);if(end<0)return null
 let distance=Math.max(0,-projection-Math.sqrt(discriminant)),previous=NaN
 const clearance=(t:number)=>{
  const x=o.x+d.x*t,y=o.y+d.y*t,z=o.z+d.z*t,length=Math.hypot(x,y,z),surface=height(x/length,y/length,z/length)
  return length-radius-surface
 }
 for(let samples=0;samples<40000&&distance<=end;samples++){
  const value=clearance(distance)
  if(Number.isFinite(value)&&value<=0){
   if(!Number.isFinite(previous))return distance
   let a=previous,b=distance
   for(let iteration=0;iteration<24;iteration++){const middle=(a+b)*.5;if(clearance(middle)>0)a=middle;else b=middle}
   return b
  }
  previous=Number.isFinite(value)?distance:NaN
  const radial=new Vector3().copy(o).addScaledVector(d,distance).length()
  distance+=Math.max(.1,(radial-envelope)*.5)
 }
 return null
}
