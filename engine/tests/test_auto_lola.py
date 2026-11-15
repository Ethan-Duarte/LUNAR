"""Offline regression tests using artificial lunar elevations, never NASA validation."""
import json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import CRS
from scripts import auto_lola
from scripts import survey_sites as ss


def test_source_selection_respects_polar_coverage_and_horizon():
    assert auto_lola.choose_source(-88).pixel_size_m == 80
    assert auto_lola.choose_source(-75).pixel_size_m == 240
    assert auto_lola.choose_source(-80).pixel_size_m == 240
    assert auto_lola.choose_source(-60) is None
    assert auto_lola.choose_source(70) is None
    assert auto_lola.choose_source(-81, radius_km=80).pixel_size_m == 240


def test_auto_refinement_keeps_unsupported_regions_geometric(monkeypatch,tmp_path):
    rows=[{'name':'South high','lat':-88.,'lon':20.,'both_fraction':1.},
          {'name':'South outer','lat':-74.,'lon':15.,'both_fraction':1.},
          {'name':'North','lat':82.,'lon':0.,'both_fraction':1.}]
    calls=[]
    def ensure(source):
        calls.append(source.filename)
        return tmp_path/source.filename
    def refine(group,ephemeris,times,path,step_hours,height,radius,az_step,dist_step,limit,min_coverage):
        assert limit==len(group)
        return ([{**r,'terrain_valid':True,'reason':'fake terrain'} for r in group],
                {r['name']:{'analysis_group':'survey_terrain'} for r in group})
    monkeypatch.setattr(ss,'refinement',refine)
    result,details,paths,diag=ss.auto_refine_sites(rows,[],[],3.,2.,40.,6.,500.,3,.95,ensure)
    assert len(calls)==2
    assert result[2]['terrain_valid'] is False
    assert 'No supported' in result[2]['reason']
    assert len(details)==2 and len(paths)==2
    assert len(diag)>=3


def test_auto_refinement_download_error_never_masquerades_as_terrain(monkeypatch,tmp_path):
    rows=[{'name':'South','lat':-88.,'lon':20.,'both_fraction':1.}]
    def fail(source):raise ConnectionError('offline')
    result,details,paths,diag=ss.auto_refine_sites(rows,[],[],3.,2.,40.,6.,500.,1,.95,fail)
    assert not result[0]['terrain_valid']
    assert details=={} and paths=={}
    assert 'offline' in diag[0]


def test_visual_tiles_are_real_grids_from_same_geotiff(monkeypatch,tmp_path):
    # Create a real, georeferenced synthetic Moon south-polar GeoTIFF.
    dem=tmp_path/'fake_adjusted.tif'
    n=512
    lat_crs=CRS.from_proj4('+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs')
    transform=from_origin(-64000,64000,250,250)
    heights=np.full((n,n),-1500.,dtype=np.float32)
    heights[160:250,230:275]=500.
    with rasterio.open(dem,'w',driver='GTiff',height=n,width=n,count=1,
                       dtype='float32',crs=lat_crs,transform=transform,nodata=-9999.) as ds:
        ds.write(heights,1)
    monkeypatch.setattr(ss,'ROOT',tmp_path)
    (tmp_path/'web').mkdir()
    rows=[{'name':'Survey 1','lat':-89.7,'lon':0.}, {'name':'Survey 2','lat':-89.8,'lon':60.}]
    ntiles,errors=ss.export_survey_tiles(rows,{r['name']:dem for r in rows},extent_km=3.,grid=33)
    assert ntiles==2,errors
    src=(tmp_path/'web'/'survey_terrain.js').read_text()
    data=json.loads(src.removeprefix('window.LUNAR_SURVEY_TERRAIN = ').rstrip(' ;\n'))
    assert all(t['source'].endswith('(fake_adjusted.tif)') for t in data['tiles'])
    assert all(len(t['heights_km'])==33*33 for t in data['tiles'])
    assert all(t['coverage_fraction']>.95 for t in data['tiles'])


def test_cli_auto_refines_and_exports_3d_from_same_dem(monkeypatch,tmp_path):
    """Full CLI-style pass with a real synthetic GeoTIFF and fake ephemerides."""
    import sys
    from lunar.survey import Point
    dem=tmp_path/'south_synthetic.tif'
    crs=CRS.from_proj4('+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs')
    heights=np.zeros((512,512),dtype=np.float32)
    # Elevation varies across the sample so that 3D grid is genuinely DEM-based.
    heights += np.linspace(-100,100,512,dtype=np.float32)[None,:]
    with rasterio.open(dem,'w',driver='GTiff',height=512,width=512,count=1,
                       dtype='float32',crs=crs,
                       transform=from_origin(-65000,65000,254,254),nodata=-9999.) as ds:
        ds.write(heights,1)
    (tmp_path/'web').mkdir()
    (tmp_path/'data'/'kernels').mkdir(parents=True)
    class FakeSPICE:
        def str2et(self,t):return 0
        def spkpos(self,body,*args):
            return (np.array([149_600_000.,10_000.,2_000_000.]) if body=='SUN'
                    else np.array([300_000.,200_000.,-20_000.])),0
        def kclear(self):pass
    monkeypatch.setattr(ss,'ROOT',tmp_path)
    monkeypatch.setattr(ss,'load_spice',lambda _:FakeSPICE())
    monkeypatch.setattr(ss,'fibonacci_locations',lambda n,region:[Point('S1',-89.5,10.),Point('S2',-89.2,60.)])
    monkeypatch.setattr(ss,'ensure_source',lambda source:dem)
    monkeypatch.setattr(sys,'argv',['survey_sites.py','--region','south',
        '--points','2','--top','2','--days','1','--step-hours','6',
        '--terrain-top','2','--terrain-radius-km','3','--dist-step-m','500',
        '--az-step','15','--tile-extent-km','2','--tile-grid','33'])
    ss.main()
    results=json.loads((tmp_path/'web'/'survey.js').read_text()
        .removeprefix('window.LUNAR_SURVEY = ').rstrip(' ;\n'))
    visual=json.loads((tmp_path/'web'/'survey_terrain.js').read_text()
        .removeprefix('window.LUNAR_SURVEY_TERRAIN = ').rstrip(' ;\n'))
    assert results['terrain']['attempted']==2
    assert results['terrain']['valid']==2
    assert results['terrain']['visual_tiles']==2
    assert len(visual['tiles'])==2
    assert {t['name'] for t in visual['tiles']}=={r['name'] for r in results['terrain_ranked']}
    assert all(t['source'].endswith('(south_synthetic.tif)') for t in visual['tiles'])
