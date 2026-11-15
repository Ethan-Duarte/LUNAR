"""Synthetic analytic terrain checks; NOT physical lunar validation."""
import math
import numpy as np
from lunar.geometry import surface_basis, MOON_RADIUS_KM
from lunar.terrain_screen import screen_sampled_footprint

LAT,LON=-89.5,220.
UP,E,N=surface_basis(LAT,LON)
R=MOON_RADIUS_KM*1000

def sampler(a=0,b=0, bump=0, gaps=False):
    def evaluate(lons,lats):
        theta=np.deg2rad(lats);phi=np.deg2rad(lons)
        u=np.stack((np.cos(theta)*np.cos(phi),np.cos(theta)*np.sin(phi),np.sin(theta)),axis=-1)
        x=R*(u@E);y=R*(u@N)
        h=100+a*x+b*y+bump*np.exp(-((x*x+y*y)/(2*25*25)))
        if gaps:h=np.where(x>0,np.nan,h)
        return h
    return evaluate

def test_plane_slope_and_zero_roughness_are_geometry_consistent():
    s=screen_sampled_footprint(sampler(a=.1,b=.2),LAT,LON,200,native_pixel_m=20,max_slope_deg=15,max_roughness_m=.1)
    assert s['status']=='MEETS_MACROSCALE_SCREEN'
    assert s['metrics']['plane_slope_deg']==pytest_approx(math.degrees(math.atan(math.hypot(.1,.2))),abs=.002)
    assert s['metrics']['plane_residual_rms_m']<1e-4
    assert s['coverage_fraction']==1.

def pytest_approx(*args,**kwargs):
    import pytest
    return pytest.approx(*args,**kwargs)

def test_bump_fails_roughness_at_resolved_scale():
    s=screen_sampled_footprint(sampler(bump=20),LAT,LON,200,native_pixel_m=20,max_roughness_m=.25)
    assert s['status']=='FAILS_SCREEN'
    assert s['metrics']['plane_residual_rms_m']>.25

def test_underresolved_is_never_reported_as_pass():
    s=screen_sampled_footprint(sampler(),LAT,LON,100,native_pixel_m=80)
    assert s['status']=='INSUFFICIENT_RESOLUTION'

def test_missing_dem_does_not_silently_interpolate():
    s=screen_sampled_footprint(sampler(gaps=True),LAT,LON,150,native_pixel_m=20)
    assert s['status']=='INCOMPLETE_DATA'
    assert s['coverage_fraction']<.995

def test_parameters_and_pole_are_handled():
    import pytest
    assert screen_sampled_footprint(sampler(),LAT,LON+360,200,native_pixel_m=20)['status']=='MEETS_MACROSCALE_SCREEN'
    with pytest.raises(ValueError):screen_sampled_footprint(sampler(),LAT,LON,100,native_pixel_m=0)
