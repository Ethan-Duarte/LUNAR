"""Checks for provenance and explanatory terrain metadata, not field validation."""
import numpy as np
import pytest
from lunar.terrain import compute_horizon
from lunar.mission_analysis import Request,calculate_series
from lunar.geometry import surface_basis,observer_position
from tests.test_mission_analysis import flat_horizon,bodies


def test_horizon_records_range_of_controlling_ridge():
    def ridge(lon,lat):
        return np.array([0.,300.,0.])
    h=compute_horizon(-89,12,ridge,0,2,radius_km=3,
                      az_step_deg=90,distances_km=np.array([1.,2.,3.]))
    assert h.distance_km==[2.]*4
    # A 300 m ridge 2 km away should subtend roughly atan(298/2000).
    assert h.alt_deg==pytest.approx([8.44]*4,abs=.1)


def test_optional_earth_axes_use_same_local_coordinates_as_renderer():
    request=Request(-89,12,days=1,step_hours=3)
    original=bodies(request,lambda h:30)
    up,east,north=surface_basis(request.lat,request.lon)
    def ephem(dt):
        return {**original(dt),'earth_north':up,'earth_prime':east}
    result=calculate_series(request,flat_horizon(),0,ephem)
    row=result['samples'][0]
    assert row['earth_north_local']==pytest.approx([0,1,0],abs=1e-12)
    assert row['earth_prime_local']==pytest.approx([1,0,0],abs=1e-12)
