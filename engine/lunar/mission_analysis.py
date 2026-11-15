"""On-demand, bounded LOLA + SPICE visibility analysis for a *single* lunar site.

The output is an engineering *screening* result. Horizon validity, cadence,
transition-bracketing error, input data and assumptions are explicit. No claims
of radio-link reliability, landing safety, or continuous event completeness.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import math
from pathlib import Path
import numpy as np

from .geometry import alt_az_from_vectors, observer_position, load_spice, surface_basis
from .terrain import compute_horizon, load_dem_sampler
from .visibility import disk_fraction, horizon_at

SUN_RADIUS_KM=695700.
EARTH_RADIUS_KM=6371.

@dataclass(frozen=True)
class Request:
    lat:float
    lon:float
    start:str='2026-11-14'
    days:int=30
    step_hours:float=1.
    observer_height_m:float=2.
    terrain_radius_km:float=300.
    az_step_deg:float=.5
    dist_step_m:float=20.
    sun_rule:str='half'
    earth_clearance_deg:float=0.
    refine_minutes:float=1.
    event_scan_minutes:float=5.
    dem:str|None=None
    auto_download:bool=True
    precision_sampling:bool=True

    def validate(self):
        for v in [self.lat,self.lon,self.days,self.step_hours,self.observer_height_m,
                  self.terrain_radius_km,self.az_step_deg,self.dist_step_m,
                  self.earth_clearance_deg,self.refine_minutes,self.event_scan_minutes]:
            if not math.isfinite(float(v)):raise ValueError('All numeric parameters must be finite')
        if not -90<=self.lat<=90: raise ValueError('Latitude must be -90..90 degrees')
        if not 1<=self.days<=186:raise ValueError('Days must be between 1 and 186')
        if not .25<=self.step_hours<=6:raise ValueError('Cadence must be 0.25..6 hours')
        if self.days*24/self.step_hours>5000:raise ValueError('Maximum 5,000 time intervals per request')
        if not 0<=self.observer_height_m<=100:raise ValueError('Observer height must be 0..100 m')
        if not 5<=self.terrain_radius_km<=300:raise ValueError('Horizon radius must be 5..300 km')
        if not .5<=self.az_step_deg<=10:raise ValueError('Azimuth spacing must be 0.5..10 degrees')
        if not 20<=self.dist_step_m<=2000:raise ValueError('Range sampling 20..2000 m')
        if self.sun_rule not in {'any','half','full'}:raise ValueError('Sun rule: any, half, full')
        if not 0<=self.earth_clearance_deg<=15:raise ValueError('Earth minimum elevation clearance must be 0..15 degrees')
        if not 1<=self.refine_minutes<=60:raise ValueError('Transition refinement: 1..60 minutes')
        if not .25<=self.event_scan_minutes<=60:raise ValueError('Event scan must be 0.25..60 minutes')
        return parse_utc(self.start)


def parse_utc(value):
    try:
        dt=datetime.fromisoformat(str(value).replace('Z','+00:00'))
        if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (TypeError,ValueError) as exc:raise ValueError('Start must be an ISO UTC date or datetime') from exc


def stamp(dt):return dt.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')


def classify(sample,rule,earth_clearance_deg):
    sf=sample['sun_fraction']
    sun={'any':sf>1e-12,'half':sf>=.5,'full':sf>=1-1e-12}[rule]
    earth=sample['earth_clearance_deg']>=earth_clearance_deg
    return bool(sun),bool(earth)


def time_windows(start,end,initial,events):
    """Calculate binary duration metrics using interpolated crossing brackets."""
    duration=(end-start).total_seconds()/3600
    transitions=sorted((t,new) for t,new in events if start<t<end)
    prev=start;lit=0.;max_off=0.;run_off=0.;state=initial
    for dt,new in [*transitions,(end,None)]:
        elapsed=(dt-prev).total_seconds()/3600
        if state:lit+=elapsed;max_off=max(max_off,run_off);run_off=0.
        else:run_off+=elapsed
        state=new;prev=dt
    return {'available_fraction':lit/duration,'longest_outage_hours':max(max_off,run_off)}


def calculate_series(request:Request,horizon,elevation_m,body_vectors,progress=None):
    """Body_vectors(dt)-> {'sun': moon-fixed position km, 'earth': ...}.

    Pure injection point for deterministic synthetic tests and independent
    SPICE validation. Never geometrically interpolate between *skyline* samples.
    """
    start=request.validate()
    if any(not math.isfinite(float(x)) for x in horizon.alt_deg) or horizon.coverage_fraction<.995:
        raise ValueError(f'LOLA horizon incomplete: {horizon.coverage_fraction:.1%} sampled range coverage; cannot certify a terrain-based result')
    end=start+timedelta(days=request.days)
    obs=observer_position(request.lat,request.lon,elevation_m,request.observer_height_m)
    sun_boundary={'any':0.,'half':.5,'full':1.}[request.sun_rule]
    def sample(dt):
        ephem=body_vectors(dt)
        row={'time':stamp(dt)}
        if 'earth_north' in ephem and 'earth_prime' in ephem:
            up,east,north=surface_basis(request.lat,request.lon)
            for key in ('earth_north','earth_prime'):
                axis=ephem[key]
                row[key+'_local']=[float(axis@east),float(axis@up),float(-axis@north)]
        for name,radius in [('sun',SUN_RADIUS_KM),('earth',EARTH_RADIUS_KM)]:
            alt,az,dist=alt_az_from_vectors(ephem[name],obs,request.lat,request.lon)
            rad=math.degrees(math.asin(min(.999999999,radius/dist)))
            fraction=disk_fraction(alt,az,rad,horizon)
            row.update({name+'_alt':round(alt,9),name+'_az':round(az,9),name+'_radius':round(rad,9),
                        name+'_fraction':fraction})
            if name=='earth':row['earth_clearance_deg']=round(alt-horizon_at(horizon,az),6)
        from .eclipse import eclipse_from_sample
        row['sun_terrain_fraction']=row['sun_fraction']
        row['sun_unocculted_fraction']=eclipse_from_sample(row)
        row['sun_fraction']*=row['sun_unocculted_fraction']
        return row
    step=timedelta(hours=request.step_hours)
    times=[];t=start
    while t<end:
        times.append(t);t+=step
    times.append(end) # ensure exact requested interval, including a fractional final step
    samples=[]
    for i,dt in enumerate(times):
        samples.append(sample(dt))
        if progress is not None and (i%100==0 or i==len(times)-1):progress(i,len(times)-1)
    flags=[classify(row,request.sun_rule,request.earth_clearance_deg) for row in samples]
    for row,(sunlit,earth_visible) in zip(samples,flags):
        row['sunlit']=sunlit
        row['earth_visible']=earth_visible
    transitions={'sun':[],'earth':[]}
    events=[]
    refine=timedelta(minutes=request.refine_minutes)
    scan=timedelta(minutes=request.event_scan_minutes)
    brackets=[]
    # Inspect interior epochs even when both output samples have the same
    # state. This detects short windows that the previous sign-change-only
    # algorithm could miss. Opposite crossings within one scan step can still
    # be missed; the chosen scan resolution is exported with every result.
    for i in range(len(times)-1):
        left=times[i];previous=flags[i]
        while left<times[i+1]:
            right=min(left+scan,times[i+1])
            following=(flags[i+1] if right==times[i+1] else classify(sample(right),request.sun_rule,request.earth_clearance_deg))
            if previous!=following:brackets.append((left,right,previous,following))
            left=right;previous=following
    for bracket_left,bracket_right,before,after in brackets:
        for j,name in enumerate(('sun','earth')):
            if before[j]==after[j]:continue
            left,right=bracket_left,bracket_right
            initial=before[j]
            # Bisect the actual SPICE + terrain predicate, not interpolated screen geometry.
            while right-left>refine:
                mid=left+(right-left)/2
                if classify(sample(mid),request.sun_rule,request.earth_clearance_deg)[j]==initial:left=mid
                else:right=mid
            crossing=left+(right-left)/2
            transitions[name].append((crossing,after[j]))
            events.append({'body':name,'event':('rise' if after[j] else 'set'),
                           'time_utc':stamp(crossing),
                           'bracket_minutes':round((right-left).total_seconds()/60,4)})
    s=time_windows(start,end,flags[0][0],transitions['sun'])
    e=time_windows(start,end,flags[0][1],transitions['earth'])
    both_events=sorted([(t,'sun',new) for t,new in transitions['sun']]+[(t,'earth',new) for t,new in transitions['earth']])
    states={'sun':flags[0][0],'earth':flags[0][1]}
    combined=[]
    for t,body,new in both_events:
        states[body]=new
        combined.append((t,states['sun'] and states['earth']))
    both=time_windows(start,end,flags[0][0] and flags[0][1],combined)
    return {
      'samples':samples,'events':sorted(events,key=lambda x:x['time_utc']),
      'metrics':{
        'valid':True, 'sun_fraction':s['available_fraction'],
        'earth_fraction':e['available_fraction'],'both_fraction':both['available_fraction'],
        'sun_blackout_h':s['longest_outage_hours'],
        'earth_blackout_h':e['longest_outage_hours'],
        'both_blackout_h':both['longest_outage_hours'],
        'step_h':request.step_hours,'sun_mean_visible_disk_fraction':sum(q['sun_fraction'] for q in samples[:-1])/max(1,len(samples)-1),
        'temporal_bracket_minutes':request.refine_minutes,
        'event_scan_minutes':request.event_scan_minutes,
        'caveat':'Events scanned between output epochs and bracket-refined. Opposite crossings within one event scan step may still be missed. Not continuous certification.'},
      'start_utc':stamp(start),'end_utc':stamp(end),'sample_count':len(samples),
      'sun_boundary_fraction':sun_boundary
    }


def analyze(request:Request, root:Path, progress=None, vectors=None, sampler=None):
    """Run with real SPICE/LOLA (default); optional injected functions for tests.

    Check local SPICE dependencies BEFORE starting a large NASA DEM download, so
    the user never loses time downloading imagery when kernels are absent.
    """
    request.validate()
    from scripts.auto_lola import choose_source,ensure_source,validate_dem,SOUTH_80,SOUTH_60
    spice=None
    if vectors is None:
        spice=load_spice(root/'data'/'kernels')
        # Return apparent site-relative vectors translated back by the same
        # observer that calculate_series subtracts. The injected test interface
        # remains Moon-centred, while the production path corrects at the site.
        site_observer=None
        def vectors(dt):
            et=spice.str2et(stamp(dt))
            if site_observer is None:raise RuntimeError('Surface observer not initialized')
            positions={name.lower():np.asarray(spice.spkcpo(name,et,'MOON_ME','OBSERVER','LT+S',site_observer,'MOON','MOON_ME')[0][:3],dtype=float)+site_observer for name in ['SUN','EARTH']}
            # Static Blue Marble geography follows SPICE's IAU_EARTH axes.
            # Rotation uses emission time; cloud imagery is not time-resolved.
            light_time=np.linalg.norm(positions['earth']-site_observer)/299792.458
            frame=spice.pxform('IAU_EARTH','MOON_ME',et-light_time)
            positions.update(earth_prime=frame[:,0],earth_north=frame[:,2])
            return positions
    try:
        if request.dem:
            dem=validate_dem(Path(request.dem))
        else:
            source=choose_source(request.lat,request.terrain_radius_km,6.)
            if source is None:
                raise ValueError('No automatic NASA LOLA south-pole DEM with complete requested horizon coverage here. Supported automatically only near 60–90°S; provide a georeferenced --dem for other regions.')
            dem=(ensure_source(source,root/'data'/'dems') if request.auto_download else validate_dem(root/'data'/'dems'/source.filename))
        if sampler is not None:
            if spice is not None:
                surface_z=float(np.asarray(sampler(np.asarray([request.lon]),np.asarray([request.lat])))[0])
                site_observer=observer_position(request.lat,request.lon,surface_z,request.observer_height_m)
            return _run_with_sampler(request,dem,sampler,vectors,progress)
        if request.precision_sampling:
            from .precision import load_local_stack
            sampling=load_local_stack(root,request.lat,request.lon,request.terrain_radius_km,request.auto_download,request.dem)
            if spice is not None:
                surface_z=float(sampling(np.asarray([request.lon]),np.asarray([request.lat]))[0])
                site_observer=observer_position(request.lat,request.lon,surface_z,request.observer_height_m)
            return _run_with_sampler(request,dem,sampling,vectors,progress)
        with load_dem_sampler(dem) as sampling:
            if spice is not None:
                surface_z=float(np.asarray(sampling(np.asarray([request.lon]),np.asarray([request.lat])))[0])
                site_observer=observer_position(request.lat,request.lon,surface_z,request.observer_height_m)
            return _run_with_sampler(request,dem,sampling,vectors,progress)
    finally:
        if spice is not None:spice.kclear()


def _run_with_sampler(request,dem,sampling,vectors,progress):
    z=float(np.asarray(sampling(np.asarray([request.lon]),np.asarray([request.lat])),dtype=float)[0])
    if not math.isfinite(z):raise ValueError('LOLA elevation missing at this site')
    from .precision import adaptive_distances
    distances=(adaptive_distances(request.terrain_radius_km,request.dist_step_m) if request.precision_sampling else None)
    horizon=compute_horizon(request.lat,request.lon,sampling,z,request.observer_height_m,
                            request.terrain_radius_km,request.dist_step_m,request.az_step_deg,distances_km=distances)
    series=calculate_series(request,horizon,z,vectors,progress)
    provenance='USER-SUPPLIED GEOREFERENCED DEM — origin not verified' if request.dem else 'NASA GSFC LOLA south-pole DEM'
    name=f'Science {abs(request.lat):.4f}°{"S" if request.lat<0 else "N"} / {(request.lon%360):.4f}°E'
    site={
     'id':'science-'+str(round(request.lat,5))+'-'+str(round(request.lon%360,5)),
     'name':name,'lat':request.lat,'lon':request.lon,'elevation_m':round(z,3),
     'height_m':request.observer_height_m,'samples':series['samples'],'metrics':series['metrics'],
     'events':series['events'],'step_hours':request.step_hours,
     'analysis_group':'survey_terrain','analysis_kind':f'On-demand NASA SPICE + {provenance}; finite-radius horizon',
     'category':'terrain','terrainQualified':True,'sun_rule':request.sun_rule,'source_kind':'user_dem' if request.dem else 'nasa_lola',
     'terrain':{'source':Path(dem).name,'radius_km':request.terrain_radius_km,
                'coverage_fraction':horizon.coverage_fraction,'native_pixel_size_m':None,'provenance':provenance},
     'horizon':{'az_deg':[round(x,5) for x in horizon.az_deg],
                'alt_deg':[round(x,5) for x in horizon.alt_deg],
                'distance_km':horizon.distance_km,
                'radius_km':request.terrain_radius_km,
                'coverage_fraction':horizon.coverage_fraction,'source':provenance},
     'survey_note':'On-demand finite-radius LOLA screening; transition crossings bracketed, unobserved short events possible. Earth visibility is line of sight only. Not validated against NASA illumination atlas.',
     'study':{'start_utc':series['start_utc'],'end_utc':series['end_utc'],
              'sample_count':series['sample_count'],'sun_rule':request.sun_rule,
              'earth_min_clearance_deg':request.earth_clearance_deg,
              'observer_height_m':request.observer_height_m,
              'max_transition_bracket_minutes':request.refine_minutes,
              'event_scan_minutes':request.event_scan_minutes,
              'dem':Path(dem).name,
              'cadence_hours':request.step_hours,
              'independent_validation':'NOT PERFORMED','component_validation':'Benchmarks documented in reports/validation_v091; site-specific validation remains separate','dem_provenance':provenance}
    }
    payload={'site':site,'science_version':'1.0.0','classification':'TERRAIN-MODELED / CONFIGURATION-SPECIFIC VALIDATION REQUIRED'}
    site['study']['eclipse_model']='analytic small-angle circle overlap; product approximation with terrain visibility; no refracted sunlight'
    site['study']['precision_sampling']=request.precision_sampling
    site['study']['azimuth_step_deg']=request.az_step_deg
    site['study']['first_range_sample_m']=request.dist_step_m
    site['study']['disc_model']='analytic area above piecewise-linear angular skyline'
    if hasattr(sampling,'layers'):
        site['terrain']['layers']=[layer.metadata for layer in sampling.layers]
        site['terrain']['native_pixel_size_m']=sampling.layers[0].metadata['pixel_m'][0]
    # The displayed local mesh uses the EXACT same georeferenced LOLA DEM as
    # the physics, but its finite resolution/visual LOD does NOT determine the
    # scientific horizon. Failure to export must not invalidate measured math.
    from scripts.export_lola_tiles import build_tiles
    from scripts.build_regional_terrain import build_region
    try:
        if hasattr(sampling,'layers'):
            from .precision import mesh_from_stack
            payload['terrain_tile']=mesh_from_stack(sampling,request.lat,request.lon,name,request.observer_height_m)
            return payload
        tiles,failed=build_tiles(Path(dem),sites=[(name,request.lat,request.lon)],extent_km=6.,n=129,
                                observer_height_m=request.observer_height_m)
        if tiles:
            try:payload['terrain_tile']=build_region(tiles[0],Path(dem))
            except Exception:payload['terrain_tile']=tiles[0]
        else:
            payload['terrain_visual_warning']=str(failed)
    except Exception as exc:
        payload['terrain_visual_warning']='Measured analysis is valid, but 3D tile export failed: '+str(exc)
    return payload
