"""Deterministic location/height sensitivity on the same measured terrain chain.

These are scenarios, not statistical confidence intervals. No random error
distribution or landing probability is inferred from a ring of sample points.
"""
from pathlib import Path
import math
from datetime import timedelta
import numpy as np
from .geometry import load_spice,surface_basis,MOON_RADIUS_KM
from .precision import load_local_stack,adaptive_distances,direction_series,disc_series,sampled_metrics,mesh_from_stack
from .terrain import compute_horizon
from .mission_analysis import Request,parse_utc,stamp


def surface_export(root,lat,lon,radius_km=300):
    Request(lat,lon,terrain_radius_km=radius_km).validate()
    stack=load_local_stack(root,lat,lon,radius_km)
    return {'terrain_tile':mesh_from_stack(stack,lat,lon,f'Science {abs(lat):.4f}°S / {lon%360:.4f}°E'),
            'source':'Same measured DEM chain as on-demand science; display-only LOD'}


def sensitivity(root,lat,lon,start='2026-11-14',days=30,step_hours=1,footprint_m=50,height_m=2,terrain_radius_km=300,sun_rule='half',earth_clearance_deg=0.):
    req=Request(lat,lon,start=start,days=days,step_hours=step_hours,terrain_radius_km=terrain_radius_km,sun_rule=sun_rule,earth_clearance_deg=earth_clearance_deg)
    req.validate()
    if not 0<=footprint_m<=500:raise ValueError('Footprint radius must be 0..500 m')
    if not 0<=height_m<=100:raise ValueError('Height must be 0..100 m')
    stack=load_local_stack(root,lat,lon,terrain_radius_km)
    u,e,n=surface_basis(lat,lon)
    locations=[('Selected point',lat,lon,0)]
    if footprint_m:
        angle=footprint_m/(MOON_RADIUS_KM*1000)
        for az in range(0,360,45):
            a=math.radians(az);v=math.cos(angle)*u+math.sin(angle)*(math.cos(a)*n+math.sin(a)*e)
            locations.append((f'{az}° / {footprint_m:g} m',math.degrees(math.asin(v[2])),math.degrees(math.atan2(v[1],v[0]))%360,az))
    heights=sorted(set([float(height_m),max(0.,height_m-1),min(100.,height_m+8)]))
    spice=load_spice(Path(root)/'data/kernels')
    try:
        t0=parse_utc(start);count=math.ceil(days*24/step_hours)
        epochs=np.asarray([spice.str2et(stamp(t0+timedelta(hours=i*step_hours))) for i in range(count)])
        vectors={b.lower():np.asarray(spice.spkpos(b,epochs,'MOON_ME','LT+S','MOON')[0]) for b in ['SUN','EARTH']}
        cases=[]
        for label,a,b,bearing in locations:
            ground=float(stack(np.asarray([b]),np.asarray([a]))[0])
            if not math.isfinite(ground):raise ValueError('A footprint point has no measured terrain coverage')
            for height in (heights if bearing==0 and label=='Selected point' else [height_m]):
                h=compute_horizon(a,b,stack,ground,height,terrain_radius_km,20,.5,distances_km=adaptive_distances(terrain_radius_km))
                if h.coverage_fraction<.995:raise ValueError('A sensitivity horizon is incomplete')
                sky=np.asarray(h.alt_deg)
                saz,sel,dist=direction_series(vectors['sun'],a,b,ground,height)
                frac=disc_series(saz,sel,np.degrees(np.arcsin(695700./dist)),sky)
                eaz,eel,_=direction_series(vectors['earth'],a,b,ground,height)
                clear=eel-np.interp(eaz,np.r_[h.az_deg,360],np.r_[sky,sky[0]])
                sun=sampled_metrics((frac>1e-12 if sun_rule=='any' else frac>=.5 if sun_rule=='half' else frac>=1-1e-12),step_hours);earth=sampled_metrics(clear>=earth_clearance_deg,step_hours)
                cases.append({'label':label,'lat':a,'lon':b,'height_m':height,'sun_fraction':sun['available_fraction'],
                              'earth_fraction':earth['available_fraction'],'longest_dark_h':sun['longest_outage_hours'],
                              'longest_earth_outage_h':earth['longest_outage_hours']})
        selected=[r for r in cases if r['height_m']==height_m]
        return {'cases':cases,'footprint_radius_m':footprint_m,'sample_count':count,'start_utc':start,'days':days,
                'height_m':height_m,'sun_rule':sun_rule,'earth_clearance_deg':earth_clearance_deg,'step_hours':step_hours,
                'range':{key:[min(r[key] for r in selected),max(r[key] for r in selected)] for key in ['sun_fraction','earth_fraction','longest_dark_h']},
                'definition':f'Deterministic 8-bearing ring plus centre, not a probability distribution. Sun={sun_rule} disc, Earth=center clearance {earth_clearance_deg} deg.',
                'limits':'Native DEM accuracy unchanged. Hourly samples can miss short events. Moon-centre aberration shortcut is used for bulk sensitivity, separately bounded in validation.'}
    finally:spice.kclear()
