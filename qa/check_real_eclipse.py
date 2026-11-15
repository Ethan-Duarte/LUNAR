"""Real-kernel occultation smoke check; not an independent external event validation."""
from pathlib import Path
import sys,json,numpy as np
root=Path(__file__).resolve().parents[1]/'engine';sys.path.insert(0,str(root))
from lunar.geometry import load_spice
from lunar.mission_analysis import Request,calculate_series
from lunar.terrain import Horizon
s=load_spice(root/'data/kernels')
q=Request(lat=18.56,lon=61.81,start='2025-03-14',days=1,step_hours=.25)
def vectors(dt):
    et=s.str2et(dt.isoformat().replace('+00:00','Z'))
    return {name.lower():np.asarray(s.spkpos(name,et,'MOON_ME','LT+S','MOON')[0]) for name in ['SUN','EARTH']}
try:
    h=Horizon(list(np.arange(0,360,.5)),[0.]*720,1.,'synthetic flat skyline; real SPICE',300)
    j=calculate_series(q,h,0,vectors)
    rows=[r for r in j['samples'] if r['sun_unocculted_fraction']<.999]
    assert rows and min(r['sun_unocculted_fraction'] for r in rows)==0
    assert any(r['sun_terrain_fraction']>.99 and r['sun_fraction']==0 for r in rows)
    report={'kind':'real SPICE + synthetic clear skyline occultation smoke test','date':'2025-03-14','site':[q.lat,q.lon],'first_sample_with_occultation':rows[0]['time'],'last_sample_with_occultation':rows[-1]['time'],'minimum_unocculted_fraction':min(r['sun_unocculted_fraction'] for r in rows),'metrics':j['metrics'],'note':'Demonstrates eclipse can remove sunlight when terrain-only Sun is visible; not an independent timing validation or a measured site study.'}
    (root.parent/'qa/real_eclipse_check.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
finally:s.kclear()
