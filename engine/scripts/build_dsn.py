"""Build bounded DSN geometry from official NAIF kernels, and check Horizons samples.
Run: python engine/scripts/build_dsn.py --kernels /absolute/kernel-directory
"""
import argparse,hashlib,json,math,csv,io
from pathlib import Path
from datetime import datetime,timedelta,timezone
from urllib.request import urlopen
from urllib.parse import urlencode
import numpy as np
import spiceypy as s
ROOT=Path(__file__).resolve().parents[2]
STATIONS=[('DSS-14 Goldstone',35.2443523,243.1104618,6371.993267),('DSS-63 Madrid',40.2413554,355.7519915,6370.051198),('DSS-43 Canberra',-35.2209189,148.9812673,6371.688998)]
def main():
 p=argparse.ArgumentParser();p.add_argument('--kernels',type=Path,required=True);a=p.parse_args()
 names=['naif0012.tls','pck00011.tpc','de440s.bsp','earth_latest_high_prec.bpc','moon_pa_de440_200625.bpc','moon_de440_250416.tf']
 for name in names:s.furnsh(str(a.kernels/name))
 radii=s.bodvrd('EARTH','RADII',3)[1];re=radii[0];flatten=(re-radii[2])/re
 stations=[]
 for name,lat,lon,r in STATIONS:
  la,lo=math.radians(lat),math.radians(lon);pos=np.array([r*math.cos(la)*math.cos(lo),r*math.cos(la)*math.sin(lo),r*math.sin(la)])
  glon,glat,alt=s.recgeo(pos,re,flatten);up=np.array([math.cos(glat)*math.cos(glon),math.cos(glat)*math.sin(glon),math.sin(glat)])
  stations.append({'name':name,'pos':pos,'up':up,'lon':math.degrees(glon),'lat':math.degrees(glat),'alt':alt})
 start=datetime(2026,11,1,tzinfo=timezone.utc);end=datetime(2027,1,1,tzinfo=timezone.utc);step=600;count=int((end-start).total_seconds()/step)+1;out=np.empty((count,3,4),dtype='<f4')
 def elevation(st,et):
  state,_=s.spkcpo('MOON',et,'ITRF93','OBSERVER','LT+S',st['pos'],'EARTH','ITRF93');v=np.array(state[:3]);return math.degrees(math.asin(np.dot(v,st['up'])/np.linalg.norm(v)))
 for i in range(count):
  et=s.str2et((start+timedelta(seconds=i*step)).strftime('%Y-%m-%dT%H:%M:%S'));
  for k,st in enumerate(stations):
   state,_=s.spkcpt(st['pos'],'EARTH','ITRF93',et,'MOON_ME_DE440_ME421','OBSERVER','LT+S','MOON');out[i,k,:3]=state[:3];out[i,k,3]=elevation(st,et)
 target=ROOT/'frontend/public/data/dsn';target.mkdir(exist_ok=True);(target/'stations.bin').write_bytes(out.tobytes())
 meta={'schema':'lunar-dsn-1','start':start.isoformat(),'end':end.isoformat(),'stepSeconds':step,'count':count,'frame':'MOON_ME; Earth orientation ITRF93','stationSource':'https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301M.pdf Table 6','stations':[{k:v for k,v in st.items() if k not in ['pos','up']} for st in stations],'layout':'sample, station, [Moon-to-station apparent xyz km, Moon-centre elevation at Earth station deg]','kernelSHA256':{n:hashlib.sha256((a.kernels/n).read_bytes()).hexdigest() for n in names},'limitations':['10-minute interpolation; Moon-centre Earth-station mask of 10 degrees is a chosen planning assumption, not an antenna operating limit.','No station scheduling, weather, antenna resource allocation or occultation by Earth terrain.','Earth-orientation kernel includes predictions. No extrapolation outside table.']}
 (target/'stations.json').write_text(json.dumps(meta,indent=2))
 # Independently specified dates include table midpoints. AIRLESS Horizons az/el, Moon target.
 checks=[];qa=ROOT/'qa/v17';qa.mkdir(exist_ok=True,parents=True)
 for k,st in enumerate(stations):
  dates=[datetime(2026,11,14,h,5,tzinfo=timezone.utc) for h in [0,6,12,18]];jds=[s.j2000()+s.str2et(t.strftime('%Y-%m-%dT%H:%M:%S'))/86400 for t in dates]
  # Horizons TLIST values here are UTC JD, not TDB.
  jdutc=[t.timestamp()/86400+2440587.5 for t in dates]
  params={'format':'json','COMMAND':'301','EPHEM_TYPE':'OBSERVER','CENTER':'coord@399','COORD_TYPE':'GEODETIC','SITE_COORD':f"{st['lon']},{st['lat']},{st['alt']}",'TLIST':'\n'.join(str(x) for x in jdutc),'QUANTITIES':'4','CSV_FORMAT':'YES','ANG_FORMAT':'DEG','APPARENT':'AIRLESS','EXTRA_PREC':'YES'}
  params={key:"'"+value+"'" for key,value in params.items() if key!='format'}|{'format':'json'}
  response=json.loads(urlopen('https://ssd.jpl.nasa.gov/api/horizons.api?'+urlencode(params),timeout=35).read());raw=response.get('result','');(qa/f'horizons_{k}.txt').write_text(raw)
  if '$$SOE' not in raw:raise RuntimeError(raw[:400])
  lines=list(csv.reader(io.StringIO(raw.split('$$SOE')[1].split('$$EOE')[0].strip())))
  for t,row in zip(dates,lines):
   # CSV: date, marker, marker, azimuth, elevation, trailing separator.
   values=[float(x) for x in row[3:] if x.strip()];reference=values[-1];et=s.str2et(t.strftime('%Y-%m-%dT%H:%M:%S'));pred=elevation(st,et);f=(t-start).total_seconds()/step;i=int(f);w=f-i;interp=float(out[i,k,3]*(1-w)+out[i+1,k,3]*w)
   checks.append({'station':st['name'],'utc':t.isoformat(),'horizonsElevationDeg':reference,'spiceElevationDeg':pred,'tableElevationDeg':interp,'errorDeg':interp-reference,'directErrorDeg':pred-reference})
 report={'checks':checks,'declaredToleranceDeg':.05,'maxErrorDeg':max(abs(x['errorDeg']) for x in checks),'scope':'12 independent Earth-station Moon-elevation samples at ten-minute table midpoints. Not a complete transition-time or lunar-station direction validation.'};report['status']='PASS' if len(checks)==12 and report['maxErrorDeg']<=.05 else 'FAIL';(qa/'dsn_horizons.json').write_text(json.dumps(report,indent=2));print(report,flush=True)
 if report['status']!='PASS':raise RuntimeError('DSN reference check failed; do not ship as validated')
if __name__=='__main__':main()
