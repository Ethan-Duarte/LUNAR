import numpy as np
from lunar.survey import (Point,fibonacci_locations,visible_disk_fraction,
                          screen_sites,rank_filtered,max_blackout_hours)

def test_disk_area():
    r=np.array([.25,.25,.25])
    values=visible_disk_fraction(np.array([-.5,0,.5]),r)
    assert np.allclose(values,[0,.5,1])
    assert visible_disk_fraction(.25,.25)> .99

def test_uniform_location_distribution():
    pts=fibonacci_locations(1200)
    assert len(pts)==1200
    assert abs(np.mean(np.sin(np.deg2rad([x.lat for x in pts]))))<.001

def test_polar_sample_filter():
    pts=fibonacci_locations(100,'south')
    assert len(pts)==100
    assert all(x.lat<=-68 for x in pts)

def test_nearside_earth_farside_no_earth():
    # Contrived body-fixed constant positions and Sun overhead at near-side point.
    epoch=[{'sun':np.array([149_600_000.,0.,0.]),'earth':np.array([384400.,0.,0.])} for _ in range(5)]
    loc=[Point('near',0,0),Point('far',0,180)]
    stats,_=screen_sites(loc,epoch,2)
    assert stats[0]['earth_fraction']>.99
    assert stats[1]['earth_fraction']<.01
    assert stats[0]['sun_fraction']>.99
    assert stats[1]['sun_fraction']<.01
    assert stats[0]['solar_blackout_h']==0
    assert stats[1]['earth_blackout_h']==10

def test_rank_filters():
    rows=[{'name':'a','sun_fraction':.8,'earth_fraction':.9,'solar_blackout_h':2,'earth_blackout_h':3,'screening_score':.8},
          {'name':'b','sun_fraction':.3,'earth_fraction':.9,'solar_blackout_h':20,'earth_blackout_h':3,'screening_score':.4}]
    assert rank_filtered(rows,1,min_sun=.5)[0]['name']=='a'

def test_outage():
    assert max_blackout_hours(np.array([[1,0,0,1,0],[0,0,0,0,0]]),3).tolist()==[6,15]
