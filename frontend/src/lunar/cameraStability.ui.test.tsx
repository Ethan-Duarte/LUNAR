// @vitest-environment happy-dom
import {it,expect,vi} from 'vitest'
import {render,cleanup} from '@testing-library/react'
const seen=vi.hoisted(()=>({cameras:[] as unknown[]}))
vi.mock('@react-three/fiber',async original=>({...await original<any>(),Canvas:({camera}:any)=>{seen.cameras.push(camera);return null}}))
import {MissionScene} from './MissionScene'
it('keeps camera configuration stable across parent panel-state renders',()=>{
 const context=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({getExtension:()=>null} as any),mission={id:'apollo-11',name:'Apollo 11',agency:'NASA',country:'USA',date_utc:'1969-07-20',lat:0,lon:23,status:'landed' as const,kind:'crewed' as const,summary:'',source_url:'https://www.nasa.gov/'},source={terrains:[],global:null},props={mission,source,dataBase:'/data/',onClose:()=>{}};
 const view=render(<MissionScene {...props}/>),first=seen.cameras.at(-1);view.rerender(<MissionScene {...props}/>);expect(seen.cameras.at(-1)).toBe(first);cleanup();context.mockRestore();
})
