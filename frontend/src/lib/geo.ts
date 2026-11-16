/** LUNAR spherical-coordinate kernel. Units: kilometres, degrees, east-positive longitude.
 * Equations: spherical Cartesian coordinates, orthonormal ENU rotation, and south-polar
 * stereographic projection. Reimplemented for the existing public interface. */
export type Vec3=[number,number,number]
export const R_KM=1737.4, D2R=Math.PI/180, R2D=180/Math.PI
export const SUN_RADIUS_KM=695700, EARTH_RADIUS_KM=6378.137
export interface LocalFrame {e:Vec3;n:Vec3;u:Vec3}
export interface AzEl {az:number;el:number}
const polar=(angle:number)=>[Math.cos(angle*D2R),Math.sin(angle*D2R)] as const
export function dot(a:Vec3,b:Vec3):number{return a.reduce((sum,x,i)=>sum+x*b[i],0)}
export function norm(v:Vec3):number{return Math.hypot(...v)}
export function unit(v:Vec3):Vec3 {const length=norm(v);return v.map(x=>x/length) as Vec3}
export function upVector(latitude:number,longitude:number):Vec3{
 const [parallel,z]=polar(latitude),[x,y]=polar(longitude)
 return [parallel*x,parallel*y,z]
}
export function sitePosKm(latitude:number,longitude:number,heightMetres:number):Vec3{
 return upVector(latitude,longitude).map(x=>x*(R_KM+heightMetres*.001)) as Vec3
}
export function localFrame(latitude:number,longitude:number):LocalFrame{
 const [c,s]=polar(longitude),up=upVector(latitude,longitude),east:Vec3=[-s,c,0]
 const north:Vec3=[up[1]*east[2]-up[2]*east[1],up[2]*east[0]-up[0]*east[2],up[0]*east[1]-up[1]*east[0]]
 return {e:east,n:north,u:up}
}
export function azEl(direction:Vec3,basis:LocalFrame):AzEl{
 const east=dot(basis.e,direction),north=dot(basis.n,direction)
 const bearing=Math.atan2(east,north)*R2D
 return {az:bearing<0?bearing+360:bearing,el:Math.atan2(dot(basis.u,direction),Math.hypot(east,north))*R2D}
}
export function dirFromAzEl(azimuth:number,elevation:number,basis:LocalFrame):Vec3{
 const [ca,sa]=polar(azimuth),[ce,se]=polar(elevation)
 return [0,1,2].map(i=>ce*(sa*basis.e[i]+ca*basis.n[i])+se*basis.u[i]) as Vec3
}
export function latLonOf(v:Vec3):{lat:number;lon:number}{
 return {lat:Math.atan2(v[2],Math.hypot(v[0],v[1]))*R2D,lon:Math.atan2(v[1],v[0])*R2D}
}
export function spProject(latitude:number,longitude:number,radius:number):[number,number]{
 const [c,s]=polar(longitude),distance=2*radius*Math.tan((latitude+90)*D2R*.5)
 return [distance*s,distance*c]
}
export function spUnproject(x:number,y:number,radius:number):{lat:number;lon:number}{
 return {lat:(2*Math.atan2(Math.hypot(x,y),2*radius))*R2D-90,lon:Math.atan2(x,y)*R2D}
}
export function spDirection(x:number,y:number,radius:number):Vec3{
 // Inverse stereographic projection directly in homogeneous coordinates.
 const diameter=2*radius,denominator=diameter*diameter+x*x+y*y
 return [2*diameter*y/denominator,2*diameter*x/denominator,(x*x+y*y-diameter*diameter)/denominator]
}
