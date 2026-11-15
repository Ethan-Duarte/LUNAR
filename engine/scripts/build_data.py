"""Export reproducible real-SPICE site timelines to static web/data.js.

Examples:
 python scripts/download_kernels.py
 python scripts/build_data.py --start 2026-11-14 --days 14 --step-hours 2
 python scripts/build_data.py --dem path/to/LOLA_LDEM.TIF --radius-km 35

NASA source data are necessary for final judging; this script generates SPICE
measurements (real ephemerides), with optional terrain-based local horizons.
"""
import argparse
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import sys
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lunar.geometry import load_spice,body_topocentric
from lunar.terrain import smooth_horizon,compute_horizon,load_dem_sampler
from lunar.visibility import disk_fraction,summarize
from lunar.engineering import integrate_incident_energy

DEFAULT_SITES=[('Candidate A',-89.55,0.0),('Candidate B',-89.25,90.0),
               ('Candidate C',-89.70,180.0)]


def parse_sites(spec):
    if not spec:return DEFAULT_SITES
    out=[]
    for part in spec.split(';'):
        s=part.rsplit(':',2)
        if len(s)!=3:raise ValueError('Sites must be name:latitude:longitude;...')
        name,lat,lon=s
        if not -90<=float(lat)<=90:raise ValueError('Latitude out of range')
        out.append((name.strip(),float(lat),float(lon)))
    return out


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--start',default='2026-11-14',help='ISO 8601 UTC start date or timestamp')
    ap.add_argument('--days',type=float,default=14)
    ap.add_argument('--step-hours',type=float,default=2.)
    ap.add_argument('--sites',help='e.g. "Ridge A:-89.6:0;Ridge B:-89.4:90"')
    ap.add_argument('--dem',type=Path,help='NASA LOLA south pole GeoTIFF')
    ap.add_argument('--radius-km',type=float,default=35.)
    ap.add_argument('--observer-height-m',type=float,default=2.)
    ap.add_argument('--az-step',type=float,default=3.)
    ap.add_argument('--distance-step-m',type=float,default=200.)
    args=ap.parse_args()
    if args.days<=0 or args.days>90 or args.step_hours<=0 or args.step_hours>24:
        ap.error('days must be in (0,90], step-hours in (0,24]')
    start=datetime.fromisoformat(args.start.replace('Z','+00:00'))
    if start.tzinfo is None:start=start.replace(tzinfo=timezone.utc)
    start=start.astimezone(timezone.utc)
    times=[start+timedelta(hours=i*args.step_hours)
           for i in range(int(args.days*24/args.step_hours)+1)]
    names=parse_sites(args.sites)
    spice=load_spice(ROOT/'data/kernels')
    sites=[]
    ephemeris=[]
    try:
        for dt in times:
            utc=dt.isoformat(timespec='seconds').replace('+00:00','Z')
            et=spice.str2et(utc)
            bodies={}
            for name,radius in [('sun',695700.0),('earth',6371.0)]:
                pos,_=spice.spkpos(name.upper(),et,'MOON_ME','LT+S','MOON')
                pos=np.asarray(pos,dtype=float)
                dist=float(np.linalg.norm(pos))
                bodies[name]={'position_km':[round(float(v),3) for v in pos],'distance_km':round(dist,3),'radius_deg':round(float(np.rad2deg(np.arcsin(radius/dist))),6)}
            ephemeris.append({'time':utc,**bodies})
        if args.dem:
            context=load_dem_sampler(args.dem)
            sampler=context.__enter__()
        else: sampler=None
        try:
            for name,lat,lon in names:
                if sampler:
                    base=sampler(np.array([lon]),np.array([lat]))[0]
                    if not np.isfinite(base):
                        raise ValueError('No DEM elevation at '+name+'; choose covered location')
                    h=compute_horizon(lat,lon,sampler,float(base),
                                      args.observer_height_m,args.radius_km,
                                      args.distance_step_m,args.az_step)
                    elev=float(base)
                else:
                    h=smooth_horizon(args.observer_height_m)
                    elev=0.
                series=[]
                for dt in times:
                    utc=dt.isoformat(timespec='seconds').replace('+00:00','Z')
                    bodies=body_topocentric(spice,utc,lat,lon,elev,args.observer_height_m)
                    sun=bodies['sun'];earth=bodies['earth']
                    sf=disk_fraction(sun['alt_deg'],sun['az_deg'],sun['radius_deg'],h)
                    ef=disk_fraction(earth['alt_deg'],earth['az_deg'],earth['radius_deg'],h)
                    series.append({'time':utc,'sun_alt':round(sun['alt_deg'],5),
                         'sun_az':round(sun['az_deg'],5),
                         'earth_alt':round(earth['alt_deg'],5),
                         'earth_az':round(earth['az_deg'],5),
                         'sun_fraction':round(sf,3) if np.isfinite(sf) else None,
                         'earth_fraction':round(ef,3) if np.isfinite(ef) else None,
                         'sun_radius':round(sun['radius_deg'],4),
                         'earth_radius':round(earth['radius_deg'],4)})
                if any(r['sun_fraction'] is None or r['earth_fraction'] is None for r in series):
                    stats={'valid':False,'reason':'No DEM coverage in one or more azimuth sectors'}
                else:stats=summarize(series,args.step_hours)
                # SPICE Earth/Moon-Sun distance varies over time; adjust
                # the 1-AU solar irradiance by the inverse-square law.
                for item,frame in zip(series,ephemeris):
                    item['sun_distance_km']=frame['sun']['distance_km']
                energy=integrate_incident_energy(series) if all(r['sun_fraction'] is not None for r in series) else None
                sites.append({'energy':energy,'name':name,'lat':lat,'lon':lon,'elevation_m':round(elev,2),
                              'height_m':args.observer_height_m,
                              'terrain':{'source':h.source,'radius_km':h.radius_km,
                                         'coverage_fraction':h.coverage_fraction},
                              'horizon':{'az':h.az_deg,'alt':[
                                  round(v,4) if np.isfinite(v) else None for v in h.alt_deg]},
                              'metrics':stats,'samples':series})
                print(f'{name}: {len(series)} samples; metrics=',stats)
        finally:
            if sampler is not None: context.__exit__(None,None,None)
    finally:spice.kclear()
    result={
      'project':'LUNAR — Lunar Utility for Navigation, Analysis, & Reconnaissance',
      'kind':'SPICE + NASA LOLA terrain' if args.dem else 'NASA SPICE — SMOOTH SPHERE (NO TERRAIN)',
      'verified':False,
      'generated_at':datetime.now(timezone.utc).isoformat(),
      'start':times[0].isoformat(), 'end':times[-1].isoformat(),
      'step_hours':args.step_hours,
      'ephemeris':ephemeris,
      'moon_fixed_frame':'MOON_ME',
      'sources':['NASA JPL NAIF DE440s ephemeris','NASA JPL lunar DE440 frame/orientation']+
          (['NASA LRO LOLA DEM: '+args.dem.name] if args.dem else []),
      'caveats':['Not a certified mission planning product.',
                 'Finite DEM radius and quality can omit obstructing distant terrain.' if args.dem
                  else 'Terrain obstruction is NOT modeled; visibility is geometric only.',
                 'Time resolution is discrete; event times are approximate.',
                 'No antenna link budget, eclipses or spacecraft power system modeled.'],
      'sites':sites}
    out=ROOT/'web'/'data.js'
    out.write_text('window.LUNAR_DATA = '+json.dumps(result,separators=(',',':'),allow_nan=False)+';\n',encoding='utf-8')
    print('\nWrote',out,'(',round(out.stat().st_size/1024), 'KiB )')
    print('Open web/index.html in a browser. Inspect the accuracy banner.')
if __name__=='__main__':main()
