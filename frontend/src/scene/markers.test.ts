import {it,expect} from 'vitest'
import {Object3D,Vector2} from 'three'
import {insideDisc,overMarker} from './markers'
it('excludes the square corners but includes the round boundary',()=>{
 expect(insideDisc({uv:new Vector2(0,0)})).toBe(false)
 expect(insideDisc({uv:new Vector2(1,.5)})).toBe(true)
 expect(insideDisc({})).toBe(true)
})
it('gives visible marked objects priority while leaving hidden markers inactive',()=>{
 const object=new Object3D();object.userData.marker=true
 const hit={object,uv:new Vector2(.5,.5)}
 expect(overMarker([hit])).toBe(true)
 object.visible=false;expect(overMarker([hit])).toBe(false)
})
