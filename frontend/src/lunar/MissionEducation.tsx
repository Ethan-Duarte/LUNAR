import {useState} from 'react'
import type {Mission} from '../scene/Missions'
import {MISSION_NOTES} from './missionNotes'
import {Help} from './Help'
const photos:Record<string,{caption:string}>={
 'apollo-11':{caption:'Buzz Aldrin on the lunar surface during Apollo 11.'},
 'apollo-15':{caption:'The Lunar Roving Vehicle used during Apollo 15.'},
 'apollo-16':{caption:'Apollo 16’s lunar module and rover in the Descartes region.'}
}
export function MissionEducation({mission,onStudy,onSurface,onScene,timeLabel}:{mission:Mission;onStudy:()=>void;onSurface:()=>void;onScene?:()=>void;timeLabel:string}){
 const [tab,setTab]=useState('story'),note=MISSION_NOTES[mission.id],photo=photos[mission.id]
 return <section className="mission-education" aria-label={'Mission guide: '+mission.name}>
 <p className="v1-eyebrow">LUNAR / FIELD NOTES</p><h2>{mission.name}</h2><p>{mission.agency} · {mission.kind==='crewed'?'Crewed':'Robotic'} · {mission.date_utc}</p>
 <nav className="v1-segment" aria-label="Mission guide tabs">{[['story','Mission'],['landscape','Landscape'],['experiment','Try it'],['sources','Sources']].map(([id,name])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{name}</button>)}</nav>
 {tab==='story'&&<>{photo&&<figure><img src={import.meta.env.BASE_URL+'lunar/history/'+mission.id+'.jpg'} alt={photo.caption} loading="lazy"/><figcaption>{photo.caption} Credit: NASA. <a href="https://www.nasa.gov/specials/apollo50th/missions.html" target="_blank" rel="noreferrer">Original source ↗</a></figcaption></figure>}
 <p>{note?.text??(mission.status==='planned'?'This entry marks an announced or proposed destination. Its coordinates are reference context rather than a certified landing point, and plans may have changed.':mission.status==='crashed'?'This catalog records a landing attempt. The listed coordinate locates the event; our terrain grid cannot establish the vehicle’s condition or reconstruct the cause of the outcome.':'This historical landing is a reference point for exploring how latitude and local terrain affect surface operations. Open the linked source for mission-specific history.')}</p><button onClick={onStudy}>Locate in the observatory ↗</button>{onScene&&<button onClick={onScene}>Open expedition scene ↗</button>}</>}
 {tab==='landscape'&&<><h3>Read the landscape</h3><p>Latitude sets the broad path of the Sun; nearby ridges determine the actual skyline. Earth access also depends on lunar libration and terrain. Compare the marked observer’s horizon with the landscape, rather than judging visibility from a moved camera.</p><p>Site: {mission.lat.toFixed(4)}°, {mission.lon.toFixed(4)}° east. Resolution varies by location. A smooth-looking foreground does not establish metre-scale safety.</p><button onClick={onSurface}>Inspect this surface ↗</button><Help title="What the image cannot prove"><p>The photograph records one historic viewpoint and lighting condition. Our 3D view uses measured elevation at the selected simulation time; it is not a reconstruction of that photograph, spacecraft or touchdown.</p></Help></>}
 {tab==='experiment'&&<><h3>A short field exercise</h3><ol><li>Locate this site and note the current Sun and Earth status.</li><li>Inspect the horizon. Move the camera without moving the observer.</li><li>In Advanced, change mast height and compare the visibility result.</li><li>Compare with a polar site using the same time and assumptions.</li></ol><p>{note?.question??'Which changes come from latitude, and which come from the local skyline? What remains below the resolution of the available terrain?'}</p><button onClick={onStudy}>Begin at this location</button></>}
 {tab==='sources'&&<><p>Mission coordinates and status: <a href={mission.source_url} target="_blank" rel="noreferrer">catalog source ↗</a>.</p>{note&&<p>Historical background: <a href={note.source} target="_blank" rel="noreferrer">NASA history ↗</a>.</p>}<p>Measured terrain: NASA LOLA, with LOLA/Kaguya-derived regional patches where supplied. Ephemerides: JPL DE440. Original LUNAR educational copy; licensed technical foundation credited in the project NOTICE.</p></>}
 <p className="v1-note">Simulation: {timeLabel} UTC. Historical mission date is context. No historical trajectory replay is implied.</p>
 </section>
}
