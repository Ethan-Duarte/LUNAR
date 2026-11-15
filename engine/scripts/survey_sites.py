"""Moon-wide SPICE geometric screening with optional bounded LOLA refinement.

Stage 1: rank candidate coordinates on a smooth sphere. Stage 2 (only if --dem
is explicitly provided): recalculate the shortlisted candidates with measured
terrain horizons and publish a SEPARATE terrain-only ranking. Neither stage
certifies landing safety or science suitability.
"""
from __future__ import annotations
import argparse,csv,json,math,sys
from pathlib import Path
from datetime import datetime,timedelta,timezone
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lunar.geometry import load_spice,alt_az_from_vectors,observer_position
from lunar.survey import SCIENCE_REGIONS,fibonacci_locations,polar_cap_locations,screen_sites,rank_filtered
from lunar.terrain import compute_horizon,load_dem_sampler
from lunar.visibility import disk_fraction,summarize,horizon_at
from scripts.auto_lola import choose_source,ensure_source

SUN_RADIUS=695700.
EARTH_RADIUS=6371.


def save_csv(path,rows):
    path.parent.mkdir(parents=True,exist_ok=True)
    if not rows:
        path.unlink(missing_ok=True)
        return
    # Some rows have terrain diagnostics not present in others.
    fields=list(dict.fromkeys(k for row in rows for k in row))
    with path.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)


def score(m,step_hours,n_epochs):
    """Same subjective weights as first-pass global screening."""
    span=max(step_hours,(n_epochs-1)*step_hours)
    return round(.3*m['sun_fraction']+.3*m['earth_fraction']+.4*m['both_fraction']
                 -.10*(m['sun_blackout_h']+m['earth_blackout_h'])/span,6)


def body_angles(frame,observer,lat,lon):
    out={}
    for body,radius in [('sun',SUN_RADIUS),('earth',EARTH_RADIUS)]:
        alt,az,dist=alt_az_from_vectors(frame[body],observer,lat,lon)
        out[body]=(alt,az,math.degrees(math.asin(radius/dist)))
    return out


def make_screen_details(ranked,all_points,arrays,ephemeris,times,step_hours,observer_height_m):
    """Attach actual epoch-by-epoch geometric analysis for every screened shortlist item.

    These numbers come from the same vectorized screen, not from an unlabelled
    approximation or the three preloaded example sites in web/data.js.
    """
    lookup={p.name:i for i,p in enumerate(all_points)}
    details={}
    for r in ranked:
        j=lookup[r['name']]
        observer=observer_position(r['lat'],r['lon'],0.,observer_height_m)
        samples=[]
        for k,(epoch,t) in enumerate(zip(ephemeris,times)):
            angles=body_angles(epoch,observer,r['lat'],r['lon'])
            samples.append({'time':t.isoformat(timespec='seconds').replace('+00:00','Z'),
                'sun_alt':round(angles['sun'][0],5),'sun_az':round(angles['sun'][1],5),
                'earth_alt':round(angles['earth'][0],5),'earth_az':round(angles['earth'][1],5),
                'sun_radius':round(angles['sun'][2],5),'earth_radius':round(angles['earth'][2],5),
                'sun_fraction':round(float(arrays['sun_fraction'][j,k]),5),
                'earth_fraction':round(float(arrays['earth_fraction'][j,k]),5),
                'sun_distance_km':round(float(np.linalg.norm(epoch['sun'])),4)})
        details[r['name']]={'name':r['name'],'lat':r['lat'],'lon':r['lon'],
            'height_m':observer_height_m,'elevation_m':0.,'samples':samples,
            'metrics':summarize(samples,step_hours),'step_hours':step_hours,
            'survey_origin':'global_screening','analysis_group':'survey_geometry',
            'analysis_kind':'SPICE geometric screen — NO LOLA terrain',
            'terrain':{'source':'SMOOTH SPHERE ONLY','radius_km':0.,'coverage_fraction':0.},
            'survey_note':'Elevation and slope were not modeled; not a landing-site recommendation.'}
    return details


def refinement(rows,ephemeris,times,dem,step_hours,observer_height_m,
               radius_km,az_step,dist_step,limit,min_coverage=.95):
    """Return (CSV diagnostics, valid detailed sites) for top screened candidates.

    A missing/partial DEM must never silently become a successful terrain result.
    """
    output=[];details={}
    with load_dem_sampler(dem) as sampling:
        for r in rows[:limit]:
            lat,lon=r['lat'],r['lon']
            diag={**r,'terrain_valid':False,'dem_source':str(dem),
                  'terrain_radius_km':radius_km,'horizon_coverage':0.}
            z=float(sampling(np.array([lon]),np.array([lat]))[0])
            if not np.isfinite(z):
                diag['reason']='No DEM elevation at selected coordinate'
                output.append(diag);continue
            diag['dem_elevation_m']=round(z,2)
            skyline=compute_horizon(lat,lon,sampling,z,observer_height_m,
                                    radius_km,dist_step,az_step)
            diag['horizon_coverage']=round(skyline.coverage_fraction,5)
            if not all(np.isfinite(skyline.alt_deg)) or skyline.coverage_fraction<min_coverage:
                diag['reason']=f'Incomplete DEM coverage (< {min_coverage:.0%} or missing azimuth horizon)'
                output.append(diag);continue
            observer=observer_position(lat,lon,z,observer_height_m)
            samples=[]
            for frame,t in zip(ephemeris,times):
                angles=body_angles(frame,observer,lat,lon)
                sunalt,sunaz,sunrad=angles['sun']
                earthalt,earthaz,earthrad=angles['earth']
                sf=disk_fraction(sunalt,sunaz,sunrad,skyline)
                ef=disk_fraction(earthalt,earthaz,earthrad,skyline)
                samples.append({'time':t.isoformat(timespec='seconds').replace('+00:00','Z'),
                    'sun_alt':round(sunalt,5),'sun_az':round(sunaz,5),
                    'earth_alt':round(earthalt,5),'earth_az':round(earthaz,5),
                    'sun_radius':round(sunrad,5),'earth_radius':round(earthrad,5),
                    'sun_fraction':round(sf,5) if np.isfinite(sf) else None,
                    'earth_fraction':round(ef,5) if np.isfinite(ef) else None,
                    'sun_distance_km':round(float(np.linalg.norm(frame['sun'])),4)})
            if any(x['sun_fraction'] is None or x['earth_fraction'] is None for x in samples):
                diag['reason']='Incomplete terrain visibility samples';output.append(diag);continue
            m=summarize(samples,step_hours)
            if not m['valid']:
                diag['reason']=m.get('reason','Incomplete terrain analysis');output.append(diag);continue
            terrain_score=score(m,step_hours,len(samples))
            sun_clearance=min(s['sun_alt']-horizon_at(skyline,s['sun_az']) for s in samples)
            earth_clearance=min(s['earth_alt']-horizon_at(skyline,s['earth_az']) for s in samples)
            diag.update(terrain_min_sun_clearance_deg=round(sun_clearance,3),
                terrain_min_earth_clearance_deg=round(earth_clearance,3),terrain_valid=True,terrain_sun_fraction=round(m['sun_fraction'],5),
                terrain_earth_fraction=round(m['earth_fraction'],5),
                terrain_both_fraction=round(m['both_fraction'],5),
                terrain_solar_blackout_h=m['sun_blackout_h'],
                terrain_earth_blackout_h=m['earth_blackout_h'],terrain_score=terrain_score,
                reason='Bounded LOLA horizon; not landing certification')
            output.append(diag)
            details[r['name']]={'name':r['name'],'lat':lat,'lon':lon,
                'height_m':observer_height_m,'elevation_m':round(z,2),
                'samples':samples,'metrics':m,'step_hours':step_hours,
                'survey_origin':'global_screening','analysis_group':'survey_terrain',
                'analysis_kind':'SPICE + LOLA terrain horizon (finite radius)',
                'terrain':{'source':str(dem),'radius_km':radius_km,
                           'coverage_fraction':skyline.coverage_fraction},
                # Publish the exact measured horizon used for the scientific
                # visibility calculation. Never substitute the visual tile.
                'horizon':{'az_deg':[round(float(x),4) for x in skyline.az_deg],
                           'alt_deg':[round(float(x),4) for x in skyline.alt_deg],
                           'radius_km':round(float(skyline.radius_km),2),
                           'coverage_fraction':round(float(skyline.coverage_fraction),5),
                           'source':'NASA LOLA + curvature; finite-distance horizon'},
                'survey_note':f'Terrain measured within {radius_km:g} km; coverage {skyline.coverage_fraction:.1%}; minimum sampled Sun clearance {sun_clearance:.2f}°, Earth clearance {earth_clearance:.2f}°. No slope/safety evaluation.'}
            print(f'  terrain {r["name"]}: both {m["both_fraction"]:.1%} (geometric {r["both_fraction"]:.1%}), coverage {skyline.coverage_fraction:.1%}')
    return output,details



def auto_refine_sites(rows,ephemeris,times,step_hours,observer_height_m,
                      radius_km,az_step,dist_step,limit,min_coverage,
                      ensure=None):
    """Automatically acquire the documented south-polar LOLA DEM required for
    each shortlisted location. Group by source so each cached GeoTIFF is read
    only once per survey. Never claim coverage outside the supported products.

    Returns (diagnostic rows, valid details, site->DEM, diagnostics).
    """
    ensure=ensure or ensure_source
    selected=rows[:limit]
    by_source={}; diagnostics=[]; rows_by_name={}
    path_by_name={}
    for row in selected:
        source=choose_source(float(row['lat']), radius_km)
        if source is None:
            msg='No supported south-polar LOLA DEM with full horizon-radius coverage at this latitude'
            rows_by_name[row['name']]={**row,'terrain_valid':False,'horizon_coverage':0.,
                'reason':msg,'dem_source':'NONE'}
            diagnostics.append(f"{row['name']}: {msg}")
        else:
            by_source.setdefault(source,[]).append(row)
    valid_details={}
    for source, group in by_source.items():
        try:
            path=ensure(source)
            diagnostics.append(f'Using {path.name} ({source.pixel_size_m} m/pixel) for {len(group)} site(s)')
        except Exception as exc:
            msg=f'DEM DOWNLOAD/VALIDATION FAILED for {source.filename}: {exc}'
            print('WARNING:',msg,flush=True)
            diagnostics.append(msg)
            for row in group:
                rows_by_name[row['name']]={**row,'terrain_valid':False,'horizon_coverage':0.,
                    'reason':msg,'dem_source':source.filename}
            continue
        result,detail=refinement(group,ephemeris,times,path,step_hours,observer_height_m,
                                radius_km,az_step,dist_step,len(group),min_coverage)
        for row in result:
            rows_by_name[row['name']]=row
            path_by_name[row['name']]=path
        valid_details.update(detail)
    return ([rows_by_name[r['name']] for r in selected],valid_details,path_by_name,diagnostics)


def export_survey_tiles(rows,path_by_name,extent_km=6.,grid=129):
    """Export visual terrain for the selected shortlist from the same DEMs
    used for terrain horizon analysis. This is a separate file: it never
    replaces preexisting user-imported site tiles in web/terrain_sites.js.
    """
    from scripts.export_lola_tiles import build_tiles
    from collections import defaultdict
    groups=defaultdict(list)
    for r in rows:
        path=path_by_name.get(r['name'])
        if path is not None:
            groups[path].append((r['name'],float(r['lat']),float(r['lon'])))
    tiles=[]; failures=[]
    for path,sites in groups.items():
        built,failed=build_tiles(path,sites=sites,extent_km=extent_km,n=grid)
        tiles.extend(built)
        failures.extend(failed)
    out=ROOT/'web'/'survey_terrain.js'
    payload={'kind':'NASA LOLA survey visual terrain, not independently calibrated',
             'tiles':tiles,'errors':failures,
             'source_url':'https://pgda.gsfc.nasa.gov/products/90'}
    out.write_text('window.LUNAR_SURVEY_TERRAIN = '+json.dumps(payload,separators=(',',':'),allow_nan=False)+';\n',encoding='utf-8')
    return len(tiles),failures

def main():
    p=argparse.ArgumentParser(description='LUNAR SPICE screening and optional real LOLA terrain ranking')
    p.add_argument('--start',default='2026-11-14')
    p.add_argument('--days',type=float,default=14)
    p.add_argument('--step-hours',type=float,default=3)
    p.add_argument('--points',type=int,default=1600)
    p.add_argument('--region',choices=['global','south','north'],default='global')
    p.add_argument('--pole-radius-km',type=float,default=None,help='For south/north only: sample a true uniform-area polar cap of this radius (e.g. 160 km), not the broad 68°–90° region')
    p.add_argument('--min-sun',type=float,default=0.)
    p.add_argument('--min-earth',type=float,default=0.)
    p.add_argument('--max-solar-blackout-h',type=float,default=float('inf'))
    p.add_argument('--max-earth-blackout-h',type=float,default=float('inf'))
    p.add_argument('--observer-height-m',type=float,default=2.)
    p.add_argument('--top',type=int,default=20)
    p.add_argument('--dem',type=Path,default=None,help='Use a specific georeferenced LOLA GeoTIFF rather than automatic NASA source selection')
    p.add_argument('--no-auto-terrain',action='store_true',help='Disable automatic south-polar LOLA DEM acquisition and refinement')
    p.add_argument('--no-visual-tiles',action='store_true',help='Do not export visual terrain grids for shortlisted candidates')
    p.add_argument('--tile-extent-km',type=float,default=6.,help='Half-width of visual terrain tile in km (0.5–35)')
    p.add_argument('--tile-grid',type=int,default=129,help='Visual tile grid width (odd integer 25–301)')
    p.add_argument('--terrain-top',type=int,default=6)
    p.add_argument('--terrain-radius-km',type=float,default=40.)
    p.add_argument('--az-step',type=float,default=6.)
    p.add_argument('--dist-step-m',type=float,default=500.)
    p.add_argument('--min-terrain-coverage',type=float,default=.95)
    args=p.parse_args()
    if not 0<args.days<=120 or not 0<args.step_hours<=24:p.error('Invalid timeframe')
    if args.points<1 or args.points>100000:p.error('points out of range')
    if not 0<=args.min_sun<=1 or not 0<=args.min_earth<=1:p.error('Fractions must be between 0 and 1')
    if args.top<1 or args.top>200:p.error('--top must be 1–200')
    if args.pole_radius_km is not None and (args.region=='global' or not 0<args.pole_radius_km<1737.4*math.pi/2):p.error('--pole-radius-km requires north/south region and a positive radius below a lunar quarter-circumference')
    if args.terrain_top<0:p.error('--terrain-top must be nonnegative')
    if not 0<args.min_terrain_coverage<=1:p.error('--min-terrain-coverage must be in (0,1]')
    if args.dem and not args.dem.is_file():p.error('DEM file not found: '+str(args.dem))
    if not .5<=args.tile_extent_km<=35 or not 25<=args.tile_grid<=301 or args.tile_grid%2!=1: p.error('Invalid visual tile size: extent .5–35 km, odd grid 25–301')
    start=datetime.fromisoformat(args.start.replace('Z','+00:00'))
    if start.tzinfo is None:start=start.replace(tzinfo=timezone.utc)
    times=[start.astimezone(timezone.utc)+timedelta(hours=i*args.step_hours)
          for i in range(round(args.days*24/args.step_hours)+1)]
    spice=load_spice(ROOT/'data'/'kernels')
    try:
        ephemeris=[]
        for dt in times:
            et=spice.str2et(dt.isoformat().replace('+00:00','Z'))
            record={}
            for body in ['sun','earth']:
                pos,_=spice.spkpos(body.upper(),et,'MOON_ME','LT+S','MOON')
                record[body]=np.asarray(pos,dtype=float)
            ephemeris.append(record)
    finally:spice.kclear()
    print('SPICE samples:',len(times),'—',times[0].isoformat(),'through',times[-1].isoformat())
    points=(polar_cap_locations(args.points,args.region,args.pole_radius_km) if args.pole_radius_km else fibonacci_locations(args.points,args.region))
    survey,arrays=screen_sites(points,ephemeris,args.step_hours,args.observer_height_m)
    science,_=screen_sites(list(SCIENCE_REGIONS),ephemeris,args.step_hours,args.observer_height_m)
    ranked=rank_filtered(survey,args.top,args.min_sun,args.min_earth,
                         args.max_solar_blackout_h,args.max_earth_blackout_h)
    folder=ROOT/'reports';folder.mkdir(exist_ok=True)
    save_csv(folder/'global_screening.csv',sorted(survey,key=lambda r:-r['screening_score']))
    save_csv(folder/'science_reference_regions.csv',sorted(science,key=lambda r:-r['screening_score']))
    save_csv(folder/'shortlist_screening.csv',ranked)
    details=make_screen_details(ranked[:20],points,arrays,ephemeris,times,
                                args.step_hours,args.observer_height_m)
    refined=[];valid_details={};terrain_ranked=[];diagnostics=[];paths={}
    if args.terrain_top and args.dem:
        print('Using explicitly supplied LOLA DEM:',args.dem)
        refined,valid_details=refinement(ranked,ephemeris,times,args.dem,args.step_hours,
             args.observer_height_m,args.terrain_radius_km,args.az_step,
             args.dist_step_m,args.terrain_top,args.min_terrain_coverage)
        paths={r['name']:args.dem for r in refined}
    elif args.terrain_top and not args.no_auto_terrain:
        print('Auto LOLA: selecting published regional DEMs for up to',args.terrain_top,'shortlisted candidates')
        refined,valid_details,paths,diagnostics=auto_refine_sites(
            ranked,ephemeris,times,args.step_hours,args.observer_height_m,
            args.terrain_radius_km,args.az_step,args.dist_step_m,
            args.terrain_top,args.min_terrain_coverage)
    else:
        diagnostics.append('Terrain acquisition disabled. All values are smooth-sphere geometric predictions.')
    # Always invalidate the old visual survey grids before writing new ones.
    tile_count=0;tile_errors=[]
    if not args.no_visual_tiles and paths:
        try:
            tile_count,tile_errors=export_survey_tiles(refined,paths,args.tile_extent_km,args.tile_grid)
        except Exception as exc:
            diagnostics.append(f'Visual LOLA tile export FAILED: {exc}')
    if not tile_count:
        (ROOT/'web'/'survey_terrain.js').write_text(
            'window.LUNAR_SURVEY_TERRAIN = {"tiles":[],"errors":[],"kind":"No measured survey visual tiles"};\n',encoding='utf-8')
    diagnostics += [f"Visual tile {x['name']}: {x['error']}" for x in tile_errors]
    save_csv(folder/'terrain_refinement.csv',refined)
    terrain_ranked=sorted((r for r in refined if r['terrain_valid']
                     and r['terrain_sun_fraction']>=args.min_sun
                     and r['terrain_earth_fraction']>=args.min_earth
                     and r['terrain_solar_blackout_h']<=args.max_solar_blackout_h
                     and r['terrain_earth_blackout_h']<=args.max_earth_blackout_h),
                          key=lambda r:(-r['terrain_score'],r['name']))
    save_csv(folder/'terrain_ranked.csv',terrain_ranked)
    details.update(valid_details)
    terrain_lookup={r['name']:r for r in refined}
    rows=[{**r,'terrain_valid':terrain_lookup.get(r['name'],{}).get('terrain_valid',False),
           'terrain_attempted':r['name'] in terrain_lookup,
           'terrain_reason':terrain_lookup.get(r['name'],{}).get('reason','Not refined')}
          for r in ranked]
    report={
      'status':'TERRAIN REFINED FOR SUBSET' if valid_details else 'GEOMETRIC SCREEN ONLY — NO VALID TERRAIN REFINEMENT',
      'reference_frame':'MOON_ME','ephemeris':'NASA JPL SPICE','start':times[0].isoformat(),
      'end':times[-1].isoformat(),'step_hours':args.step_hours,'sample_count':len(survey),
      'selection':{'region':args.region,'pole_radius_km':args.pole_radius_km,'min_sun':args.min_sun,'min_earth':args.min_earth,
          'weights':{'sun':.3,'earth':.3,'both':.4,'normalized_blackout_penalty':.10}},
      'terrain':{'requested':bool(args.dem) or not args.no_auto_terrain,'dem':str(args.dem) if args.dem else 'NASA GSFC auto south-polar COG selection',
                 'radius_km':args.terrain_radius_km if (args.dem or not args.no_auto_terrain) else None,
                 'min_coverage':args.min_terrain_coverage,'attempted':len(refined),
                 'valid':len(valid_details),'ranked':len(terrain_ranked),
                 'visual_tiles':tile_count,'diagnostics':diagnostics},
      'limits':['No landing safety or site slope validation','No science-priority score',
                'No radio link budget','Time samples not continuously refined',
                'Terrain limited by DEM coverage, horizon radius and sampling; refinement subset is NOT whole-Moon terrain optimization',
                '100% is sampled visibility over a finite window, not a year-round or continuous guarantee',
                'Auto LOLA downloads supported for south-polar region only'],
      'top_sites':rows,'terrain_ranked':terrain_ranked,'reference_regions':science}
    (folder/'survey_summary.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    browser={'schema_version':2,
       'classification':report['status'],'region':args.region,'pole_radius_km':args.pole_radius_km,
       'start':times[0].isoformat(),'end':times[-1].isoformat(),
       'step_hours':args.step_hours,'screened':len(survey),
       'terrain':report['terrain'],'top_sites':rows[:20],
       'terrain_ranked':terrain_ranked,
       'science_regions':science,'details':details,
       'ephemeris':[{'time':t.isoformat(timespec='seconds').replace('+00:00','Z'),
           'sun':{'position_km':list(map(float,frame['sun']))},
           'earth':{'position_km':list(map(float,frame['earth']))}}
           for t,frame in zip(times,ephemeris)]}
    (ROOT/'web'/'survey.js').write_text('window.LUNAR_SURVEY = '+json.dumps(browser,separators=(',',':'),allow_nan=False)+';\n',encoding='utf-8')
    specs=';'.join(f"{r['name']}:{r['lat']}:{r['lon']}" for r in ranked[:min(5,len(ranked))])
    (folder/'build_data_sites.txt').write_text('For an independent detailed model of these candidates:\n'
      +f'py scripts/build_data.py --start {args.start} --days {args.days} --step-hours {args.step_hours} --sites "{specs}"'
      +(f' --dem "{args.dem}"' if args.dem else ' --dem "PATH_TO_LOLA_DEM.tif"')+'\n',encoding='utf-8')
    print('\nTop geometric-screening candidates:')
    for r in ranked[:min(10,len(ranked))]:
        print(f"  {r['name']:12} ({r['lat']:+8.3f}°, {r['lon']:+9.3f}°) sun {r['sun_fraction']:.1%}, Earth {r['earth_fraction']:.1%}, both {r['both_fraction']:.1%}")
    print(f'\nTerrain-refined sites with sufficient LOLA coverage: {len(valid_details)} / {len(refined)} attempted')
    print(f'Visual LOLA terrain tiles exported: {tile_count}')
    for warning in diagnostics:print('  LOLA:',warning)
    print('Web survey candidates now include their own calculated timelines, not the three default sites.')
    print('IMPORTANT: Only explicitly terrain-refined candidates used the measured DEM; no landing safety evaluation.')

if __name__=='__main__':main()
