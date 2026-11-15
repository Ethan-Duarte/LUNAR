import math
import numpy as np
from lunar.geometry import surface_basis,observer_position,alt_az_from_vectors,MOON_RADIUS_KM
from lunar.terrain import smooth_horizon,compute_horizon,Horizon
from lunar.visibility import disk_fraction,horizon_at,longest_blackout_hours,summarize,score_metrics

def test_basis_all_latitudes():
 for lat,lon in [(-90,0),(-89,40),(-20,179),(90,30),(0,0)]:
  u,e,n=surface_basis(lat,lon)
  assert np.allclose(np.array([u,e,n])@np.array([u,e,n]).T,np.eye(3),atol=1e-12)

def test_cardinal_sky_geometry():
 u,e,n=surface_basis(-89,0)
 obs=observer_position(-89,0)
 assert abs(alt_az_from_vectors(obs+100000*u,obs,-89,0)[0]-90)<1e-7
 assert abs(alt_az_from_vectors(obs+100000*e,obs,-89,0)[1]-90)<1e-7
 assert abs(alt_az_from_vectors(obs+100000*n,obs,-89,0)[1]-0)<1e-7

def test_flat_spherical_horizon_is_below_horizontal_with_mast():
 h=smooth_horizon(2)
 assert h.alt_deg[0]<0
 assert abs(h.alt_deg[0]+ math.degrees(math.sqrt(4/(MOON_RADIUS_KM*1000))))<0.0001

def test_curvature_in_3d_horizon():
 # A fully known flat sphere, observer at ground; its curvature ensures all
 # outward terrain samples are below 0°; max is closest sample at 0.5km.
 def zero(lons,lats):return np.zeros_like(lons)
 h=compute_horizon(-89.4,20,zero,0,0,radius_km=10,step_m=500,az_step_deg=30)
 assert h.coverage_fraction==1
 assert max(h.alt_deg)<0
 assert min(h.alt_deg)>-0.02

def test_synthetic_terrain_ridge_blocks_ray():
 # A 400m high ridge at arc distance about 5km north should rise ~4.5°.
 lat0,lon0=-89.,0.
 def ridge(lons,lats):
  # synthetic ridge across 5km north of observer: 5km in latitude ~0.1649°
  return np.where(np.abs(np.asarray(lats)-(-88.835))<0.009,400.,0.)
 h=compute_horizon(lat0,lon0,ridge,0,2,radius_km=10,step_m=200,az_step_deg=10)
 assert h.alt_deg[0]>3. and h.alt_deg[0]<8.
 assert h.alt_deg[18]<1.

def test_horizon_wraparound():
 h=Horizon([0,90,180,270],[1,2,3,4],1,'test',10)
 assert abs(horizon_at(h,315)-2.5)<1e-9

def test_disk_fraction_area_not_perimeter():
 h=Horizon([0,90,180,270],[0,0,0,0],1,'test',10)
 assert disk_fraction(3,0,0.5,h)==1
 assert disk_fraction(-3,0,0.5,h)==0
 assert .38<disk_fraction(0,0,1,h,1600)<.62

def test_blackout_sample_boundaries():
 assert longest_blackout_hours([True,False,False,True,False],2)==4

def test_metrics_and_ranking():
 series=[{'sun_fraction':1,'earth_fraction':1},
         {'sun_fraction':0,'earth_fraction':1},
         {'sun_fraction':0,'earth_fraction':0},
         {'sun_fraction':1,'earth_fraction':0}]
 m=summarize(series,1)
 assert m['valid']
 assert m['sun_fraction']==.5 and m['earth_fraction']==.5
 assert m['both_fraction']==.25
 assert m['sun_blackout_h']==2 and m['earth_blackout_h']==2
 assert score_metrics(m,'both')==.25
