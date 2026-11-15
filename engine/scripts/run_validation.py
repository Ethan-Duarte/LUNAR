"""Reproducible real-data validation of LUNAR; failures remain visible.

Run from the project root: python scripts/run_validation.py --stage all
Large NASA input files are obtained separately by scripts/fetch_validation_data.py.
No competitor source code is imported or executed.
"""
from __future__ import annotations
import argparse,csv,hashlib,json,math,sys,time
from datetime import datetime,timedelta,timezone
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lunar.geometry import (load_spice,body_topocentric,surface_basis,observer_position,alt_az_from_vectors)
from lunar.terrain import compute_horizon
from lunar.precision import (RasterWindow,TerrainStack,adaptive_distances,disc_series,direction_series,sampled_metrics)

OUT=ROOT/'reports'/'validation_v091'
SPOTS=[('spot1',-89.4395,222.8066,2.,92.,88.1,4.58),
       ('spot2',-89.4399,222.8524,2.,92.3,87.9,4.62),
       ('spot3',-89.4516,222.7581,10.,95.6,92.5,3.08),
       ('spot4',-89.4544,222.8445,10.,95.66,91.9,3.17)]


def write(name,value):
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/name).write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8')


def filehash(path):
    with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def stats(values):
    v=np.asarray(values,dtype=float)
    return {'n':len(v),'rms':float(np.sqrt(np.mean(v*v))),'mean_signed':float(v.mean()),
            'max_abs':float(np.max(np.abs(v))),'p95_abs':float(np.quantile(np.abs(v),.95))}


def sky_table(start,hours,step_hours=1.):
    """Exact SPICE Moon-centre LT+S vectors at each epoch, no interpolation.

    Surface projection retains the small measured centre-vs-site aberration
    approximation in bulk studies; the separate Horizons test checks both paths.
    """
    key=hashlib.sha256(f'{start}|{hours}|{step_hours}'.encode()).hexdigest()[:16]
    path=ROOT/'data'/'validation_cache'/f'sky_{key}.npz'
    if path.exists():
        with np.load(path) as d:return {k:d[k] for k in d.files}
    spice=load_spice(ROOT/'data'/'kernels')
    et0=spice.str2et(start)
    count=int(round(hours/step_hours))
    utc0=datetime.fromisoformat(start.replace('Z','+00:00'))
    # UTC regular hours, converted explicitly through SPICE. These periods are
    # after the most recent leap second in the loaded LSK.
    epochs=np.asarray([spice.str2et((utc0+timedelta(hours=i*step_hours)).isoformat().replace('+00:00','Z')) for i in range(count)])
    result={}
    for name in ['SUN','EARTH']:
        print(f'SPICE {name}: {count} exact epochs',flush=True)
        result[name.lower()]=np.asarray(spice.spkpos(name,epochs,'MOON_ME','LT+S','MOON')[0])
    path.parent.mkdir(parents=True,exist_ok=True)
    np.savez_compressed(path,**result)
    return result


def terrain(lat,lon,twenty=False,radius=300.,dem=None):
    layers=[]
    if twenty:
        patch=ROOT/'data/dems/LDEM_20M_connecting_ridge_crop.TIF'
        if not patch.exists():raise FileNotFoundError('20 m ridge crop missing: run data fetch first')
        layers.append(RasterWindow(patch,lat,lon,6.))
    layers.append(RasterWindow(dem or ROOT/'data/dems/LDEM_80S_80MPP_ADJ.TIF',lat,lon,min(radius,45.)))
    if radius>40:
        layers.append(RasterWindow(ROOT/'data/dems/LDEM_60S_240MPP_ADJ.TIF',lat,lon,radius))
    return TerrainStack(layers)


def horizon(stack,lat,lon,height,az=.5,radius=300.,legacy=False):
    ground=float(stack(np.asarray([lon]),np.asarray([lat]))[0])
    if not math.isfinite(ground):raise ValueError('Missing observer elevation')
    h=compute_horizon(lat,lon,stack,ground,height,radius,250.,az,
                      distances_km=None if legacy else adaptive_distances(radius))
    if h.coverage_fraction<1 or not np.isfinite(h.alt_deg).all():raise ValueError('Incomplete terrain ray coverage')
    return ground,h


def site_series(table,lat,lon,z,height,h,step=1.):
    out={}
    skyline=np.asarray(h.alt_deg)
    for name,rad in [('sun',695700.),('earth',6371.)]:
        az,el,dist=direction_series(table[name],lat,lon,z,height)
        frac=disc_series(az,el,np.degrees(np.arcsin(rad/dist)),skyline)
        center=el-np.interp(az,np.r_[np.asarray(h.az_deg),360.],np.r_[skyline,skyline[0]])
        out[name]={'any':sampled_metrics(frac>1e-12,step),'half':sampled_metrics(frac>=.5,step),
                   'center':sampled_metrics(center>=0,step),'mean_disc_fraction':float(frac.mean())}
    return out


def jpl_check():
    """Fresh live Horizons: globally distributed sites, exact off-hour epochs."""
    from validate_jpl_auto import build_params,request_horizons,parse_horizons
    spice=load_spice(ROOT/'data/kernels')
    # Fixed before this run; not fitted to the observed residuals.
    sites=[(-89.45,222.7,1953.652,2.),(-85.5,10.,-862.51,2.),
           (.674,23.473,-1930.,2.),(-69.373,32.319,0.,2.),
           (-80.13,1.44,2500.,2.),(-45.457,177.589,-5900.,2.),(88.,300.,0.,2.)]
    times=[datetime.fromisoformat(s.replace('Z','+00:00')) for s in
           ['2025-03-14T06:30:00Z','2026-11-14T17:45:30Z','2027-12-01T03:10:00Z',
            '2029-02-18T21:20:00Z','2030-06-21T12:00:00Z','2031-10-05T08:55:00Z',
            '2033-04-27T15:35:00Z','2034-11-11T23:59:00Z']]
    rows=[];queries=[]
    for lat,lon,z,height in sites:
        for name,target in [('sun','10'),('earth','399')]:
            p=build_params(lat,lon,(z+height)/1000,times,target)
            raw,url=request_horizons(p,OUT/'raw_jpl')
            head,ref=parse_horizons(raw)
            if len(ref)!=len(times):raise ValueError('Horizons epoch count mismatch')
            queries.append({'url':url,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'lat':lat,'lon':lon,'body':name})
            for t,r in zip(times,ref):
                if abs((r['time']-t).total_seconds())>1:raise ValueError('Horizons timestamp mismatch')
                utc=t.isoformat().replace('+00:00','Z')
                pred=body_topocentric(spice,utc,lat,lon,z,height)[name]
                a,b=math.radians(pred['alt_deg']),math.radians(r['el'])
                da=math.radians((pred['az_deg']-r['az']+180)%360-180)
                hav=math.sin((a-b)/2)**2+math.cos(a)*math.cos(b)*math.sin(da/2)**2
                rows.append({'body':name,'utc':utc,'lat':lat,'lon':lon,'altitude_m':z+height,
                             'lunar_az':pred['az_deg'],'lunar_alt':pred['alt_deg'],'jpl_az':r['az'],'jpl_alt':r['el'],
                             'az_error_deg':math.degrees(da),'alt_error_deg':pred['alt_deg']-r['el'],
                             'sky_error_deg':math.degrees(2*math.asin(min(1.,math.sqrt(hav))))})
        print(f'Horizons checked {lat}, {lon}',flush=True)
    summary={body:{key:stats([r[key] for r in rows if r['body']==body]) for key in ['az_error_deg','alt_error_deg','sky_error_deg']} for body in ['sun','earth']}
    passed=all(summary[b]['sky_error_deg']['max_abs']<1e-5 for b in summary)
    result={'status':'PASS' if passed else 'FAIL','summary':summary,'rows':rows,'queries':queries,
            'criterion':'maximum on-sky difference < 0.00001 degrees; seven sites × eight epochs × two bodies',
            'scope':'pointing only; JPL-family ephemerides share underlying information'}
    write('jpl.json',result);return result


def ridge_check():
    table=sky_table('2024-01-01T00:00:00Z',round(19*365.25*24))
    results=[]
    for name,lat,lon,height,pct,mean,dark in SPOTS:
        for twenty in [False,True]:
            stack=terrain(lat,lon,twenty)
            z,h=horizon(stack,lat,lon,height)
            s=site_series(table,lat,lon,z,height,h)
            r={'spot':name,'lat':lat,'lon':lon,'height_m':height,'twenty_m_nearfield':twenty,'elevation_m':z,
               'predicted':s,'published':{'any_sun_percent':pct,'mean_disc_percent':mean,'longest_dark_days':dark},
               'sampling':{'az_deg':.5,'range_km':300,'first_range_m':20,'time_step_hours':1},
               'dems':[layer.metadata for layer in stack.layers]}
            if twenty:
                r['status']='PASS' if (abs(s['sun']['any']['available_fraction']*100-pct)<1. and
                    abs(s['sun']['mean_disc_fraction']*100-mean)<1. and
                    abs(s['sun']['any']['longest_outage_hours']/24-dark)<.5) else 'FAIL'
            else:r['status']='CONTROL'
            results.append(r)
            print('RIDGE',name,twenty,s['sun']['any'],r['status'],flush=True)
            write('ridge.json',{'status':'IN_PROGRESS','cases':results})
    result={'status':'PASS' if all(r['status']=='PASS' for r in results if r['twenty_m_nearfield']) else 'FAIL',
            'cases':results,'reference':'https://meetingorganizer.copernicus.org/EPSC2014/EPSC2014-136-1.pdf',
            'limitations':['Published start epoch is unspecified; 19 years beginning 2024 is an analogous cycle, not exact-period replication.',
                          'Modern NASA adjusted DEM is not the authors original registered DTM.',
                          'Bulk vector corrections are at the Moon centre before site subtraction; separately bounded by Horizons.',
                          'Any-disc and half-disc results are reported separately; no power model or eclipses included.']}
    write('ridge.json',result);return result


def convergence_check():
    table=sky_table('2026-11-14T00:00:00Z',180*24)
    cases=[]
    lat,lon=-89.45,222.7
    for radius,az,legacy in [(40,3,True),(40,3,False),(40,1,False),(40,.5,False),(80,.5,False),(150,.5,False),(300,.5,False),(300,.25,False)]:
        stack=terrain(lat,lon,False,radius)
        z,h=horizon(stack,lat,lon,2.,az,radius,legacy)
        metrics=site_series(table,lat,lon,z,2.,h)
        cases.append({'radius_km':radius,'az_step_deg':az,'legacy_250m_marching':legacy,'metrics':metrics,
                      'horizon_az':h.az_deg,'horizon_alt':h.alt_deg})
        print('CONVERGENCE',radius,az,legacy,metrics['sun']['half'],flush=True)
    reference=cases[-1]
    for r in cases:
        r['difference_to_finest']={body:{'availability_pp':100*(r['metrics'][body][rule]['available_fraction']-reference['metrics'][body][rule]['available_fraction']),
                                       'longest_outage_hours':r['metrics'][body][rule]['longest_outage_hours']-reference['metrics'][body][rule]['longest_outage_hours']}
                                  for body,rule in [('sun','half'),('earth','center')]}
    fine=cases[-2]['difference_to_finest']
    passed=all(abs(v['availability_pp'])<.2 and abs(v['longest_outage_hours'])<=1 for v in fine.values())
    result={'status':'PASS' if passed else 'FAIL','cases':cases,'criterion':'0.5 vs 0.25 degree at 300 km: <0.2 percentage points availability; <=1 h longest outage',
            'scope':'one site and one 180-day interval; not a global convergence guarantee'}
    write('convergence.json',result);return result


def map_check(count=185):
    import rasterio
    from pyproj import CRS,Transformer
    table=sky_table('2024-01-01T00:00:00Z',round(18.6*365.25*24))
    paths=[ROOT/'data/reference'/name for name in ['AVGVISIB_85S_060M_201608.TIF','AVGVISIB_85S_060M_201608_EARTH.TIF','LPSR_85S_060M_201608.TIF']]
    datasets=[rasterio.open(p) for p in paths]
    ds=datasets[0]
    inverse=Transformer.from_crs(ds.crs,CRS.from_proj4('+proj=longlat +R=1737400 +no_defs'),always_xy=True)
    rng=np.random.default_rng(20261115)
    points=[]
    # Fixed-seed uniform-area cap; every coordinate is snapped to a single
    # reference pixel centre BEFORE reading its illumination value. No best-
    # pixel search or outcome-based exclusion is allowed.
    while len(points)<count:
        x,y=rng.uniform(-140000,140000,2)
        if x*x+y*y>140000**2:continue
        row,col=ds.index(x,y)
        if (row,col) not in points:points.append((row,col))
    records=[]
    try:
        for i,(row,col) in enumerate(points):
            x,y=ds.xy(row,col);lon,lat=inverse.transform(x,y)
            refs=[]
            for d in datasets:
                raw=d.read(1,window=((row,row+1),(col,col+1)),masked=True)[0,0]
                refs.append(None if np.ma.is_masked(raw) else float(raw*d.scales[0]+d.offsets[0]))
            if any(v is None for v in refs):raise ValueError('Preselected reference point is no-data; no silent exclusion permitted')
            stack=terrain(lat,lon)
            z,h=horizon(stack,lat,lon,2.)
            values=site_series(table,lat,lon,z,2.,h)
            records.append({'index':i,'pixel':[row,col],'lat':lat,'lon':lon,'elevation_m':z,'reference_sun':refs[0],
                            'reference_earth':refs[1],'reference_psr':refs[2], 'predicted':values})
            if i%10==0:print(f'MAP {i+1}/{count}',flush=True);write('maps_partial.json',{'status':'IN_PROGRESS','points':records})
    finally:
        for d in datasets:d.close()
    summary={}
    for body,key in [('sun','reference_sun'),('earth','reference_earth')]:
        actual=np.asarray([r['predicted'][body]['any']['available_fraction'] for r in records])
        ref=np.asarray([r[key] for r in records])
        summary[body]=stats(actual-ref)
        summary[body]['pearson_r']=float(np.corrcoef(actual,ref)[0,1])
    passed=all(s['rms']<=.03 and abs(s['mean_signed'])<=.01 and s['pearson_r']>=.98 for s in summary.values())
    result={'status':'PASS' if passed else 'FAIL','summary':summary,'points':records,
            'criteria':'both bodies: RMS <= 0.03 fraction, absolute mean bias <= 0.01, correlation >= 0.98',
            'reference':'https://pgda.gsfc.nasa.gov/products/69','period':'2024-01-01 + 18.6*365.25 days; hourly; end excluded',
            'observer_height_m':2,'sun_rule':'any visible disc','earth_rule':'any visible disc, matching NASA map rather than operational Earth-center LOS',
            'limitations':['Reference map start epoch/observer height are not established by the landing-page description.',
                          'Adjusted 80 m terrain differs from the legacy 60 m reference terrain; this is a cross-product check.',
                          'Both sides rely on LOLA; agreement does not independently validate terrain measurements.',
                          'Preselected uniform-area sample is not enriched for narrow crest sites; ridge tests are separate.']}
    write('maps.json',result);return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--stage',choices=['all','jpl','ridge','convergence','maps'],default='all')
    p.add_argument('--map-points',type=int,default=185)
    args=p.parse_args()
    criteria=ROOT/'validation/criteria.json'
    if not criteria.exists():raise FileNotFoundError('Validation criteria must exist before the run')
    stages=['jpl','convergence','ridge','maps'] if args.stage=='all' else [args.stage]
    manifest={'started_utc':datetime.now(timezone.utc).isoformat(),'criteria_sha256':filehash(criteria),
              'source_sha256':{str(f.relative_to(ROOT)):filehash(f) for f in [Path(__file__),ROOT/'lunar/precision.py',ROOT/'lunar/geometry.py',ROOT/'lunar/terrain.py']},
              'stages':stages,'results':{}}
    manifest_name=f'run_manifest_{args.stage}.json'
    write(manifest_name,manifest)
    for name in stages:
        fn={'jpl':jpl_check,'convergence':convergence_check,'ridge':ridge_check,'maps':lambda:map_check(args.map_points)}[name]
        t=time.time()
        try:
            r=fn();manifest['results'][name]={'status':r['status'],'seconds':time.time()-t}
        except Exception as exc:
            import traceback
            traceback.print_exc()
            manifest['results'][name]={'status':'BLOCKED','error':str(exc),'seconds':time.time()-t}
        write(manifest_name,manifest)
    print(json.dumps(manifest['results'],indent=2),flush=True)
    return 0 if all(v['status']=='PASS' for v in manifest['results'].values()) else 1

if __name__=='__main__':raise SystemExit(main())
