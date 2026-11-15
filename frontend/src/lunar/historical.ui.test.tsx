// @vitest-environment happy-dom
import {useState} from 'react'
import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {MissionInfoPanel} from './MissionInfoPanel'
import {MissionEducation} from './MissionEducation'
import {MissionScene} from './MissionScene'
const mission={id:'apollo-11',name:'Apollo 11',agency:'NASA',country:'US',date_utc:'1969-07-20',lat:.674,lon:23.473,status:'landed' as const,kind:'crewed' as const,summary:'',source_url:'https://www.nasa.gov/mission/apollo-11/'}
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('keeps mission info independent, collapsible and restores it with explicit navigation actions',()=>{
 const daylight=vi.fn(),browse=vi.fn();function Demo(){const [open,setOpen]=useState(true);return <MissionInfoPanel mission={mission} open={open} onToggle={()=>setOpen(!open)} onBrowse={browse} onDaylight={daylight}><p>Mission details</p></MissionInfoPanel>}
 render(<Demo/>);fireEvent.click(screen.getByText('Find daylight at this site'));expect(daylight).toHaveBeenCalledOnce();fireEvent.click(screen.getByText('Browse missions'));expect(browse).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByText('Collapse info'));expect(document.getElementById('mission-info-content')?.hidden).toBe(true);fireEvent.click(screen.getByText('Open mission info'));expect(screen.getByText('Mission details')).toBeTruthy();
})
it('explains illustrative hardware and exposes source resolution independently of rendering detail',()=>{
 render(<MissionEducation mission={mission} timeLabel="2026-11-15" onStudy={()=>{}} onSurface={()=>{}} terrainLabel="Measured elevation spacing: 80 m at the observer."/>);
 fireEvent.click(screen.getByRole('button',{name:'Hardware',exact:true}));expect(screen.getByText('Understand the hardware')).toBeTruthy();expect(screen.getByText(/not mission-specific engineering drawings/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Landscape',exact:true}));expect(screen.getByText(/Measured elevation spacing: 80 m/)).toBeTruthy();
})
it('defaults to simulation light and makes studio illumination an explicit opt-in',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 render(<MissionScene mission={mission} source={{terrains:[],global:null}} dataBase="/data/" onClose={()=>{}}/>);
 const button=screen.getByRole('button',{name:'Simulation sunlight'});expect(button.getAttribute('aria-pressed')).toBe('false');fireEvent.click(button);expect(screen.getByRole('button',{name:'Studio light · illustrative'}).getAttribute('aria-pressed')).toBe('true');expect(screen.getByText(/Studio illumination · selected UTC unchanged/)).toBeTruthy();
})
it('keeps the education tab when the mission panel is collapsed and reopened',()=>{
 function Demo(){const [open,setOpen]=useState(true);return <MissionInfoPanel mission={mission} open={open} onToggle={()=>setOpen(!open)} onBrowse={()=>{}} onDaylight={()=>{}}><MissionEducation mission={mission} timeLabel="2026-11-15" onStudy={()=>{}} onSurface={()=>{}}/></MissionInfoPanel>}
 render(<Demo/>);fireEvent.click(screen.getByRole('button',{name:'Hardware',exact:true}));fireEvent.click(screen.getByText('Collapse info'));fireEvent.click(screen.getByText('Open mission info'));expect(screen.getByRole('button',{name:'Hardware',exact:true}).getAttribute('aria-pressed')).toBe('true');
})
