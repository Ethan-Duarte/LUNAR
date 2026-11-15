import math
import numpy as np
import pytest
from scipy.integrate import quad
from lunar.precision import disc_integral,disc_series,adaptive_distances,sampled_metrics


def segment(z):
    z=np.clip(z,-1.,1.)
    return (np.arccos(-z)+z*np.sqrt(1-z*z))/np.pi


def test_exact_disc_against_closed_form_at_481_positions():
    heights=np.zeros(720)
    errors=[abs(disc_integral(359.9,float(z),1.,heights)-segment(z)) for z in np.linspace(-1.2,1.2,481)]
    assert max(errors)<1e-12


def test_piecewise_skyline_against_independent_adaptive_quadrature():
    heights=np.full(720,4.)
    heights[:4]=[.1,-.3,.5,.1]
    heights[-2:]=[.6,-.2]
    for az in [0.,.15,359.8,1.2]:
        radius=.27;el=.15;c=math.cos(math.radians(el))
        def integrand(x):
            xx=(az+x/c)%360
            h=np.interp(xx,np.r_[np.arange(720)*.5,360],np.r_[heights,heights[0]])
            y=math.sqrt(max(0,radius*radius-x*x))
            return np.clip(el+y-h,0,2*y)
        numerical=quad(integrand,-radius,radius,epsabs=1e-11,limit=200,points=[0])[0]/(math.pi*radius*radius)
        assert disc_integral(az,el,radius,heights)==pytest.approx(numerical,abs=2e-7)


def test_adaptive_grid_keeps_nearby_obstacles_and_reaches_requested_range():
    d=adaptive_distances(300)
    assert d[0]==.02 and d[-1]==300
    assert np.max(np.diff(d[d<=10]))<.02000000001
    assert np.all(np.diff(d)>0)


def test_sampled_outage_endpoint_convention():
    r=sampled_metrics([False,False,True,False],.25)
    assert r['available_fraction']==.25
    assert r['longest_outage_hours']==.5


def test_display_origin_uses_same_fine_measured_layer_as_horizon(tmp_path):
    import rasterio
    from rasterio.transform import from_origin
    from lunar.precision import RasterWindow,TerrainStack,mesh_from_stack
    crs='+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs'
    layers=[]
    for name,n,pixel,value in [('near',101,20,110.),('far',1001,200,100.)]:
        path=tmp_path/(name+'.tif')
        with rasterio.open(path,'w',driver='GTiff',width=n,height=n,count=1,dtype='float32',
                           crs=crs,transform=from_origin(-n*pixel/2,n*pixel/2,pixel,pixel),nodata=-9999) as d:
            d.write(np.full((n,n),value,dtype=np.float32),1)
        layers.append(RasterWindow(path,-90,0,100))
    stack=TerrainStack(layers)
    tile=mesh_from_stack(stack,-90,0,'synthetic')
    assert tile['base_elevation_m']==110.
    assert stack(np.asarray([0.]),np.asarray([-90.]))[0]==110.
    assert tile['heights_km'][(129*129)//2]==pytest.approx(0,abs=1e-12)
    assert len(tile['regional_levels'])==2
