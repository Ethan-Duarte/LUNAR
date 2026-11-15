"""Visual DEM regression; synthetic raster is a test fixture, NOT lunar evidence."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import base64
import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import CRS, Transformer

from lunar.visual_tiles import export_visual_tiles
from lunar.geometry import MOON_RADIUS_KM


def test_bounded_measured_region():
    # A synthetic 80-m GeoTIFF supports all three display squares.
    lat, lon = -89.4399, 222.8524
    root = Path(__file__).resolve().parents[1]
    crop = root / 'data/dems/LDEM_20M_connecting_ridge_crop.TIF'
    with rasterio.open(crop) as ref:
        crs=ref.crs
    proj=Transformer.from_crs(CRS.from_proj4('+proj=longlat +R=1737400 +no_defs'),crs,always_xy=True)
    x,y=proj.transform(lon,lat)
    with TemporaryDirectory() as tmp:
        path=Path(tmp)/'synthetic_80m.tif';n=3500;res=80
        with rasterio.open(path,'w',driver='GTiff',height=n,width=n,count=1,dtype='float32',
                            crs=crs,transform=from_origin(x-n*res/2,y+n*res/2,res,res)) as f:
            f.write(np.full((n,n),-1700.,dtype='float32'),1)
        import lunar.visual_tiles as vt
        with patch.object(vt,'ensure_source',return_value=path),patch.object(vt,'GRIDS',((6.,61),(24.,73),(72.,97))):
            result=export_visual_tiles(root,lat,lon)
        assert result['visual_lod_version']==2
        assert len(result['visual_levels'])==3
        for extent,l in zip((6,24,72),result['visual_levels']):
            assert l['extent_km']==extent
            a=np.frombuffer(base64.b64decode(l['heights_f32_b64']),dtype='<f4')
            assert a.size==l['n']**2
            assert np.all(np.isfinite(a))
        # Measured source data must take precedence over the synthetic coarse raster.
        assert result['primary_source_pixel_m']==20
        assert all(l['coverage_fraction']>.995 for l in result['visual_levels'])


def test_no_fake_outside_coverage():
    try:export_visual_tiles('.',30,0)
    except ValueError as e:assert 'outside' in str(e)
    else:raise AssertionError('Outside coverage must fail closed')
