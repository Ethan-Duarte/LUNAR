"""Scientific invariants for the new primary-data builders (no network)."""
import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from rasterio.warp import Resampling
from prepare_polar_products import height_codes, remap
from prepare_site_patches import coordinates
import prepare_site_patches


def test_height_encoding_roundtrip_and_missing():
    heights=np.array([[-9999.5,-1.2,0,2000.24,np.nan]])
    encoded=height_codes(heights)
    decoded=(encoded[:,:,0].astype('uint16')*256+encoded[:,:,1])*.5-10000
    assert np.max(abs(decoded[0,:4]-heights[0,:4]))<=.25
    assert (encoded[0,4]==0).all()


def test_reprojection_uses_pixel_centres_and_north_first_rows():
    image=np.array([[100,102],[98,100]],dtype='float32')
    with MemoryFile() as memory:
        with memory.open(driver='GTiff',width=2,height=2,count=1,dtype='float32',
                         crs='+proj=stere +lat_0=-90 +R=1737400',
                         transform=from_origin(-2,2,2,2)) as dataset:
            dataset.write(image,1)
            result=remap(image,dataset,2,2,Resampling.average)
            np.testing.assert_array_equal(result,image)


def test_site_projection_returns_centre_and_correct_compass_directions():
    lat,lon=coordinates(10,30,3,80)
    assert abs(lat[1,1]-10)<1e-10
    assert abs(lon[1,1]-30)<1e-10
    assert lat[0,1]>10>lat[2,1]
    assert lon[1,2]>30>lon[1,0]


def test_projection_crosses_longitude_seam_without_geometric_jump():
    lat,lon=coordinates(0,179.999,3,1000)
    assert lon[1,0]>0 and lon[1,2]<0
    delta=(lon[1,2]-lon[1,0]+180)%360-180
    assert 0<delta<.1


def test_pds_tile_boundary_clamps_only_within_pixel_footprint(monkeypatch):
    source=np.array([[10,20],[30,40]],dtype='<f4')
    monkeypatch.setattr(prepare_site_patches,'ranged',lambda *args:source.tobytes())
    rows=np.array([-.25,1.25,2]);cols=np.array([0,1,1])
    values=prepare_site_patches.raw_sample('unused',rows,cols,(2,2),'<f4',1)
    np.testing.assert_array_equal(values[:2],[10,40])
    assert np.isnan(values[2])
