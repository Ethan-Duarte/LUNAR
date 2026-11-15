"""Rebuild the included real-data 180-day examples (needs downloaded DEMs/kernels).
This can take several minutes. It does not overwrite lunar.json or survey.json.
"""
from pathlib import Path
import sys,json
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lunar.mission_analysis import Request,analyze
from lunar.geometry import load_spice
from lunar.trade_study import sensitivity

def main():
    sites=[];tiles=[]
    for name,lat,lon,height in [('Connecting Ridge',-89.4399,222.8524,2),('Connecting Ridge / taller mast',-89.4399,222.8524,10),('Earth-facing control',-85.5,10.,2)]:
        print('Building',name,flush=True)
        result=analyze(Request(lat,lon,days=180,observer_height_m=height),ROOT)
        site=result['site'];site.update(id=f'reference-{lat}-{lon}-{height}',name=name,category='terrain',terrainQualified=True)
        site['reference_sensitivity']=sensitivity(ROOT,lat,lon,start=site['samples'][0]['time'],height_m=height)
        sites.append(site);tile=result['terrain_tile'];tile['name']=name;tiles.append(tile)
    spice=load_spice(ROOT/'data/kernels');ephemeris=[]
    try:
        for sample in sites[0]['samples']:
            et=spice.str2et(sample['time']);row={'time':sample['time']}
            for key,radius in [('sun',695700.),('earth',6371.)]:
                pos=spice.spkpos(key.upper(),et,'MOON_ME','LT+S','MOON')[0]
                row[key]={'position_km':list(pos),'radius_deg':float(np.degrees(np.arcsin(radius/np.linalg.norm(pos))))}
            ephemeris.append(row)
    finally:spice.kclear()
    payload={'sites':sites,'tiles':tiles,'ephemeris':ephemeris,'kind':'NASA SPICE + measured LOLA; three reproducible 180-day examples','source':'scripts/build_experience.py'}
    path=ROOT/'frontend/public/data/experience.json';path.parent.mkdir(exist_ok=True,parents=True)
    path.write_text(json.dumps(payload,separators=(',',':')))
    print('Wrote',path,flush=True)
if __name__=='__main__':main()
