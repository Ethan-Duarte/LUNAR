"""Synthetic numerical regression tests, not independent NASA validation."""
from dataclasses import replace
from datetime import datetime,timedelta,timezone
import math
import numpy as np
import pytest
from lunar.mission_analysis import Request,calculate_series,classify,time_windows,parse_utc
from lunar.terrain import Horizon
from lunar.geometry import surface_basis,observer_position


def flat_horizon(value=0,coverage=1):
    az=list(np.arange(0,360,3,dtype=float))
    return Horizon(az,[value]*len(az),coverage,'synthetic',40)


def bodies(request,sun_angle):
    """Return moving synthetic body positions, preserving true Moon-fixed geometry."""
    u,e,n=surface_basis(request.lat,request.lon)
    def ephem(dt):
        h=(dt-parse_utc(request.start)).total_seconds()/3600
        angle=math.radians(sun_angle(h))
        direction=math.sin(angle)*u+math.cos(angle)*n
        earth_dir=math.sin(math.radians(25))*u+math.cos(math.radians(25))*e
        obs=observer_position(request.lat,request.lon)
        return {'sun':obs+149_600_000*direction,'earth':obs+384_400*earth_dir}
    return ephem


def test_midpoint_transition_brackets_actual_crossing():
    r=Request(-89,20,days=1,step_hours=3,refine_minutes=2)
    # At 12h Sun crosses an angular threshold near 0.0 deg; ground horizon flat.
    result=calculate_series(r,flat_horizon(),0,bodies(r,lambda h:(h-12)*.5))
    sun=[v for v in result['events'] if v['body']=='sun']
    assert len(sun)==1 and sun[0]['event']=='rise'
    assert abs((parse_utc(sun[0]['time_utc'])-parse_utc('2026-11-14T12:00:00Z')).total_seconds())<120
    assert sun[0]['bracket_minutes']<=2
    assert .4<result['metrics']['sun_fraction']<.6
    assert result['metrics']['earth_fraction']==1
    assert result['metrics']['sun_blackout_h']==pytest.approx(12,abs=.04)
    assert result['metrics']['both_fraction']==pytest.approx(result['metrics']['sun_fraction'])


def test_180_day_support_and_no_synthetic_extrapolation():
    r=Request(-87,0,days=180,step_hours=1)
    result=calculate_series(r,flat_horizon(),0,bodies(r,lambda h:30))
    assert result['sample_count']==4321
    assert result['metrics']['sun_fraction']==1
    assert result['metrics']['earth_fraction']==1
    assert result['metrics']['sun_blackout_h']==0
    assert result['end_utc']=='2027-05-13T00:00:00Z'


def test_timeline_fraction_respects_event_duration_and_cutoffs():
    start=parse_utc('2026-11-14')
    end=start+timedelta(hours=10)
    events=[(start+timedelta(hours=3),True),(start+timedelta(hours=7),False)]
    value=time_windows(start,end,False,events)
    assert value['available_fraction']==pytest.approx(.4)
    assert value['longest_outage_hours']==pytest.approx(3)


def test_missing_measured_terrain_fails_closed():
    r=Request(-88,0)
    with pytest.raises(ValueError,match='incomplete'):
        calculate_series(r,flat_horizon(0,.91),0,bodies(r,lambda h:40))


def test_invalid_parameters_are_rejected():
    for opts in [{'days':187},{'step_hours':.01},{'lat':-100},
                 {'observer_height_m':-1},{'sun_rule':'whenever'},
                 {'earth_clearance_deg':20},{'days':180,'step_hours':.25}]:
        with pytest.raises(ValueError):replace(Request(-85,12),**opts).validate()


def test_sun_and_earth_use_explicit_different_rules():
    row={'sun_fraction':.37,'earth_clearance_deg':5.}
    assert classify(row,'any',4)==(True,True)
    assert classify(row,'half',4)==(False,True)
    assert classify(row,'full',6)==(False,False)


def test_invalid_datetime_rejected():
    with pytest.raises(ValueError,match='ISO UTC'):Request(-85,0,start='banana').validate()

def test_real_georeferenced_tif_pipeline_with_synthetic_heights(tmp_path):
    """End-to-end integration using fake topography, NOT a NASA measurement."""
    import rasterio
    from rasterio.transform import from_origin
    from lunar.mission_analysis import analyze
    crs='+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs +type=crs'
    dem=tmp_path/'test_moon.tif'
    heights=np.zeros((410,410),dtype=np.float32)
    # smooth synthetic ridge near centre; do not claim independent validation
    yy,xx=np.mgrid[-205:205,-205:205]
    heights+=800*np.exp(-((xx-12)**2+(yy-12)**2)/(2*8**2))
    with rasterio.open(dem,'w',driver='GTiff',height=410,width=410,count=1,
                       dtype='float32',crs=crs,transform=from_origin(-205000,205000,1000,1000),nodata=-32767) as dst:
        dst.write(heights,1)
    req=Request(lat=-89.2,lon=33.,days=1,step_hours=3,dem=str(dem),
                terrain_radius_km=20,dist_step_m=1000,az_step_deg=10.)
    result=analyze(req,tmp_path,vectors=bodies(req,lambda h:15))
    site=result['site']
    assert site['analysis_group']=='survey_terrain'
    assert site['horizon']['coverage_fraction']==1
    assert len(site['samples'])==9
    assert result['terrain_tile']['n']==129
    assert result['terrain_tile']['regional_levels']
    assert site['metrics']['valid']
    assert site['study']['independent_validation']=='NOT PERFORMED'

def test_horizons_comparison_math_and_wrap():
    from scripts.compare_jpl_horizons import compare
    row={'utc':'2026-11-14T00:00:00Z','lat_deg':'-88','lon_e_deg':'12',
         'sun_alt_deg':'20','sun_az_deg':'359.99','earth_alt_deg':'5','earth_az_deg':'0.01'}
    def calculator(*args):
        return {'sun':{'alt_deg':20,'az_deg':0.01},'earth':{'alt_deg':5,'az_deg':359.99}}
    r=compare([row],calculator)
    assert abs(r['aggregates']['sun_az_deg']['max_abs_deg']-.02)<.00001
    assert r['aggregates']['sun_alt_deg']['rms_deg']==0


def test_short_solar_window_between_same_state_output_epochs_is_found():
    r=Request(-89,20,days=1,step_hours=3,event_scan_minutes=5)
    # Both 0 h and 3 h are dark, but a short pulse near 1.5 h must be found.
    result=calculate_series(r,flat_horizon(),0,bodies(r,lambda h:2*max(0,1-abs(h-1.5)/.125)-1))
    events=[e for e in result['events'] if e['body']=='sun']
    assert [e['event'] for e in events]==['rise','set']
    assert 0<result['metrics']['sun_fraction']<.02
    assert all(e['bracket_minutes']<=1 for e in events)
