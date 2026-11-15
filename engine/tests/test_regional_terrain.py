"""Offline validation of measured regional terrain export using synthetic GeoTIFF.

This tests the pipeline and grid alignment, not the accuracy of NASA products.
"""
import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import CRS
from scripts.build_regional_terrain import build_region,terrain_layer,selected_sites
from scripts.export_lola_tiles import build_tiles


def test_regional_levels_from_one_georeferenced_source(tmp_path):
    dem=tmp_path/'synthetic_80MPP.tif'
    crs=CRS.from_proj4('+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs')
    y,x=np.mgrid[0:750,0:750]
    # Artificial low crater plus ridge, the surface is never passed off as NASA.
    h=(800*np.exp(-((x-390)**2+(y-405)**2)/((120.)**2))-
        200*np.exp(-((x-370)**2+(y-420)**2)/((65.)**2))).astype('float32')
    with rasterio.open(dem,'w',driver='GTiff',width=750,height=750,count=1,
            dtype='float32',crs=crs,transform=from_origin(-150000,150000,400,400),nodata=-9999) as ds:
        ds.write(h,1)
    local,errors=build_tiles(dem,sites=[('Site A',-89.5,30)],extent_km=6,n=129)
    assert not errors
    tile=local[0]
    tile['horizon']={'alt_deg':[4.0]} # field remains unchanged after a visual export
    out=build_region(tile,dem)
    assert len(out['regional_levels'])==2
    assert [x['extent_km'] for x in out['regional_levels']]==[24.,72.]
    assert all(level['coverage_fraction']>.99 for level in out['regional_levels'])
    assert out['horizon']==tile['horizon']
    assert out['regional_extent_km']==72.
    for level in out['regional_levels']:
        mid=level['n']//2
        assert abs(level['heights_km'][mid*level['n']+mid])<1e-6


def test_selected_sites_has_no_automatic_geometric_promotion():
    payload={'tiles':[{'name':'A'},{'name':'B'}]}
    assert selected_sites(payload,1)==[{'name':'A'}]
    assert selected_sites({'tiles':[]},0)==[]
