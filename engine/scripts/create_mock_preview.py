"""Generate strictly SYNTHETIC but internally consistent Moon-centred sky geometry.

These fabricated coordinates are ONLY for visual tests and may not be used
for any scientific conclusions or the hackathon's NASA-data requirement.
"""
from datetime import datetime,timedelta,timezone
from pathlib import Path
import json,math
ROOT=Path(__file__).resolve().parents[1]
R_MOON=1737.4
SITES=[('Candidate A',-89.55,0.),('Candidate B',-89.25,90.),('Candidate C',-89.70,180.)]


def basis(lat,lon):
    p,l=map(math.radians,(lat,lon))
    return ([math.cos(p)*math.cos(l),math.cos(p)*math.sin(l),math.sin(p)],
            [-math.sin(l),math.cos(l),0.],
            [-math.sin(p)*math.cos(l),-math.sin(p)*math.sin(l),math.cos(p)])


def dot(a,b):return sum(x*y for x,y in zip(a,b))
def sub(a,b):return [x-y for x,y in zip(a,b)]
def unit(v):
    n=math.sqrt(dot(v,v));return [x/n for x in v]


def local_angles(position,lat,lon):
    up,east,north=basis(lat,lon)
    origin=[x*(R_MOON+.002) for x in up]
    d=unit(sub(position,origin))
    return math.degrees(math.asin(max(-1,min(1,dot(d,up))))),math.degrees(math.atan2(dot(d,east),dot(d,north)))%360


def main():
    start=datetime(2026,11,14,tzinfo=timezone.utc)
    frames=[]
    for i in range(169):
        days=i/12
        # Pedagogical placeholders only: simplified solar phase and fake Earth libration.
        sun_phase=2*math.pi*days/29.53059+1.3
        sun_latrad=math.radians(1.54*math.sin(2*math.pi*days/365.25+.35))
        sun=[149600000*math.cos(sun_latrad)*math.cos(sun_phase),
             149600000*math.cos(sun_latrad)*math.sin(sun_phase),149600000*math.sin(sun_latrad)]
        earth_lon=math.radians(5*math.sin(2*math.pi*days/27.32))
        earth_lat=math.radians(-3-3*math.sin(2*math.pi*days/27.32+.8))
        earth=[384400*math.cos(earth_lat)*math.cos(earth_lon),
               384400*math.cos(earth_lat)*math.sin(earth_lon),384400*math.sin(earth_lat)]
        time=(start+timedelta(hours=2*i)).isoformat().replace('+00:00','Z')
        frames.append({'time':time,'sun':{'position_km':[round(x,3) for x in sun],'radius_deg':.266},
                       'earth':{'position_km':[round(x,3) for x in earth],'radius_deg':.95}})
    sites=[]
    for idx,(name,lat,lon) in enumerate(SITES):
        az=[i*5 for i in range(72)]
        horizon=[round(.7+.6*math.sin(math.radians(a*3+idx*70))+1.*math.exp(-((a-(90+idx*45))/19)**2),3) for a in az]
        rows=[]
        for frame in frames:
            sa,saz=local_angles(frame['sun']['position_km'],lat,lon)
            ea,eaz=local_angles(frame['earth']['position_km'],lat,lon)
            def horizon_at(a):
                v=a/5;j=int(v)%72;t=v-math.floor(v)
                return (1-t)*horizon[j]+t*horizon[(j+1)%72]
            sf=1.0 if sa>horizon_at(saz) else 0.0
            ef=1.0 if ea>horizon_at(eaz) else 0.0
            rows.append({'time':frame['time'],'sun_alt':round(sa,3),'sun_az':round(saz,3),
                         'earth_alt':round(ea,3),'earth_az':round(eaz,3),
                         'sun_fraction':sf,'earth_fraction':ef,'sun_radius':.266,'earth_radius':.95})
        def longest(key):
            best=run=0
            for r in rows:
                if r[key]:run=0
                else:run+=1;best=max(best,run)
            return best*2
        stats={'valid':True,'sun_fraction':sum(r['sun_fraction'] for r in rows)/len(rows),
               'earth_fraction':sum(r['earth_fraction'] for r in rows)/len(rows),
               'both_fraction':sum(bool(r['sun_fraction'] and r['earth_fraction']) for r in rows)/len(rows),
               'sun_blackout_h':longest('sun_fraction'),'earth_blackout_h':longest('earth_fraction'),
               'step_h':2.,'caveat':'All geometry and terrain horizons are synthetic.'}
        sites.append({'name':name,'lat':lat,'lon':lon,'elevation_m':0.,'height_m':2.,
                      'terrain':{'source':'SYNTHETIC MOCK HORIZON','radius_km':0,'coverage_fraction':0},
                      'horizon':{'az':az,'alt':horizon},'metrics':stats,'samples':rows})
    data={'project':'LUNAR — Lunar Utility for Navigation, Analysis, & Reconnaissance',
          'kind':'SYNTHETIC DEMONSTRATION','verified':False,
          'generated_at':datetime.now(timezone.utc).isoformat(),
          'start':frames[0]['time'],'end':frames[-1]['time'],'step_hours':2,
          'moon_fixed_frame':'MOON_ME (ILLUSTRATIVE ONLY)',
          'ephemeris':frames,'sources':[],
          'caveats':['No real NASA ephemerides. Synthetic vectors are geometrically consistent across sites but are fabricated.',
                     'Synthetic horizons and availability; not validated for mission design.'],
          'sites':sites}
    (ROOT/'web/data.js').write_text('window.LUNAR_DATA = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
    print('Generated internally consistent but explicitly synthetic preview dataset')
if __name__=='__main__':main()
