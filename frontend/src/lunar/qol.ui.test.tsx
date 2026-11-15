// @vitest-environment happy-dom
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react'
import {ProjectFileInput} from './ProjectFileInput'
import {InterfaceBoundary} from './InterfaceBoundary'
import {MissionEducation} from './MissionEducation'
afterEach(cleanup)
it('cancellation and empty selection never begin an import; the same file can be retried',async()=>{
 const open=vi.fn();render(<ProjectFileInput label="Open project" onOpen={open}/>);
 const input=screen.getByLabelText('Open project') as HTMLInputElement;
 fireEvent(input,new Event('cancel',{bubbles:true}));fireEvent.change(input,{target:{files:[]}});
 expect(open).not.toHaveBeenCalled();const file=new File(['{}'],'design.json');
 fireEvent.change(input,{target:{files:[file]}});await waitFor(()=>expect(open).toHaveBeenCalledTimes(1));
 fireEvent.change(input,{target:{files:[file]}});await waitFor(()=>expect(open).toHaveBeenCalledTimes(2));
})
it('shows rejected imports without losing other controls',async()=>{
 render(<><button>Other control</button><ProjectFileInput label="Open" onOpen={()=>{throw Error('Invalid design')}}/></>);
 fireEvent.change(screen.getByLabelText('Open'),{target:{files:[new File(['bad'],'bad.json')]}});
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Invalid design'));
 expect(screen.getByText('Other control')).toBeTruthy();
})
it('contains a render failure within its view',()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 function Broken(){throw Error('Graphics unavailable');return null}
 render(<><button>Analysis remains</button><InterfaceBoundary label="3D view"><Broken/></InterfaceBoundary></>);
 expect(screen.getByRole('alert').textContent).toContain('Graphics unavailable');expect(screen.getByText('Analysis remains')).toBeTruthy();log.mockRestore();
})
it('educational tabs change content without moving the site or simulation',()=>{
 const study=vi.fn(),surface=vi.fn();render(<MissionEducation mission={{id:'apollo-11',name:'Apollo 11',agency:'NASA',country:'US',date_utc:'1969-07-20',lat:0.67,lon:23.47,status:'landed',kind:'crewed',summary:'',source_url:'https://www.nasa.gov/'}} onStudy={study} onSurface={surface} timeLabel="2026-11-14"/>);
 fireEvent.click(screen.getByRole('button',{name:'Landscape'}));expect(screen.getByText('Read the landscape')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Try it'}));expect(screen.getByText('A short field exercise')).toBeTruthy();expect(study).not.toHaveBeenCalled();expect(surface).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Begin at this location'));expect(study).toHaveBeenCalledOnce();
})
