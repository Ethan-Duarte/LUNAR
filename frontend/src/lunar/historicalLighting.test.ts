import {it,expect} from 'vitest'
import * as THREE from 'three'
import {localFrame,sitePosKm} from '../lib/geo'
import {bodyToScene,sceneSunDirection,sceneLight,meshGroundHeight,sceneTerrainLabel} from './historicalLighting'
import {buildGeometry} from '../scene/MoonTerrain'
import type {Horizon} from '../lib/horizon'
it('maps lunar body-fixed kilometres to stable east/up/south scene metres and back',()=>{
 for(const [lat,lon] of [[0,0],[.67416,23.47314],[-89.4399,222.8524]]){
 const transform=bodyToScene(lat,lon,100),p=new THREE.Vector3(...sitePosKm(lat,lon,100));expect(p.clone().applyMatrix4(transform).length()).toBeLessThan(1e-7);
 const f=localFrame(lat,lon),east=p.clone().addScaledVector(new THREE.Vector3(...f.e),.001).applyMatrix4(transform);expect(east.x).toBeCloseTo(1,7);expect(east.y).toBeCloseTo(0,7);
 const local=new THREE.Vector3(7,3,-10);expect(local.clone().applyMatrix4(transform.clone().invert()).applyMatrix4(transform).distanceTo(local)).toBeLessThan(1e-7);
 }
})
it('uses the same azimuth convention as the observatory and withholds direct light behind terrain',()=>{
 const sky={az:90,el:0,radius:.266,distKm:149597870},h:Horizon={lat:0,lon:0,observerHeightM:2,azStepDeg:90,elevDeg:new Float32Array(4).fill(10),distKm:new Float32Array(4).fill(1)};
 expect(sceneSunDirection(0,0,sky)[1]).toBeCloseTo(1,9);expect(sceneLight(sky,h,1,false).intensity).toBe(0);
 h.elevDeg.fill(-2);expect(sceneLight(sky,h,1,false).fraction).toBe(1);expect(sceneLight(sky,h,.25,false).fraction).toBe(.25);expect(sceneLight(sky,h,0,false).intensity).toBe(0);
 expect(sceneLight(sky,undefined,1,false).known).toBe(false);expect(sceneLight(sky,h,0,true).intensity).toBe(3);
})
it('places support on the actual scene triangles, including an asymmetric diagonal',()=>{
 const positions=new Float32Array([0,0,0,1,2,0,0,3,1,1,9,1]);
 expect(meshGroundHeight(positions,1,1,-1,-1)).toBe(0);expect(meshGroundHeight(positions,1,1,0,0)).toBeCloseTo(2.5);expect(meshGroundHeight(positions,1,1,1,1)).toBe(9);
})
it('localizes shared terrain geometry before converting it to float precision',()=>{
 const f=localFrame(.67416,23.47314),terrain={radiusM:1737400,frame:{ax:f.e,ay:f.n,up:f.u},levels:[{size:41,xMin:-20500,xMax:20500,yMin:-20500,yMax:20500,pixel:1000,h:new Float32Array(41*41).fill(100)}]};
 const mesh=buildGeometry(terrain,null,4,[64,32],{lat:.67416,lon:23.47314},bodyToScene(.67416,23.47314,100));
 const p=new THREE.Vector3().fromBufferAttribute(mesh.getAttribute('position'),12);expect(p.length()).toBeLessThan(1e-6);expect(mesh.getAttribute('aXY').getX(12)).toBeCloseTo(0);mesh.dispose();
 expect(sceneTerrainLabel({terrains:[terrain],global:null},.67416,23.47314)).toContain('1000 m');expect(sceneTerrainLabel({terrains:[],global:null},0,0)).toContain('unavailable');
})
