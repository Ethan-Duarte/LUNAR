"""Convert a NASA LOLA south-polar DEM into exact WebGL mesh data.

The generated file web/terrain_sites.js is standalone browser-loadable JS.
It does NOT alter scientific timelines in web/data.js: those should be built
separately with scripts/build_data.py using SPICE and terrain skyline sampling.

All geometry in kilometers, local axes [East, Up, South]. Lunar mean-radius
reference sphere 1737.4 km. The source DEM is in MOON_ME lunar south-polar
stereographic; north/east tangent directions are derived from the same
Moon-fixed unit vectors used by the renderer.
"""
import argparse,json,math,sys
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
R_KM=1737.4
DEFAULT=[('Candidate A',-89.55,0.0),('Candidate B',-89.25,90.0),('Candidate C',-89.70,180.0)]

def sites_from_data():
    p=ROOT/'web'/'data.js'
    if not p.exists():return DEFAULT
    raw=p.read_text(encoding='utf-8').strip()
    if not raw.startswith('window.LUNAR_DATA = '):return DEFAULT
    try:
        data=json.loads(raw[len('window.LUNAR_DATA = '):].rstrip(' ;\r\n'))
        return [(s['name'],float(s['lat']),float(s['lon'])) for s in data['sites']]
    except (ValueError,KeyError,TypeError):return DEFAULT

def tangent_basis(lat,lon):
    p,l=np.deg2rad([lat,lon]);up=np.array([np.cos(p)*np.cos(l),np.cos(p)*np.sin(l),np.sin(p)])
    east=np.array([-np.sin(l),np.cos(l),0.])
    north=np.array([-np.sin(p)*np.cos(l),-np.sin(p)*np.sin(l),np.cos(p)])
    return up,east,north

def sample_grid(ds,lat,lon,extent_km,n):
    from pyproj import CRS,Transformer
    from rasterio.windows import Window
    if ds.crs is None:raise ValueError('No CRS in GeoTIFF; specify a georeferenced LOLA .TIF file')
    moon_geographic=CRS.from_proj4('+proj=longlat +R=1737400 +no_defs +type=crs')
    transformer=Transformer.from_crs(moon_geographic,ds.crs,always_xy=True)
    up,east,north=tangent_basis(lat,lon)
    xy=np.linspace(-extent_km,extent_km,n)
    X,Z=np.meshgrid(xy,xy)
    p=(R_KM*up+X[...,None]*east-Z[...,None]*north)
    unit=p/np.linalg.norm(p,axis=-1)[...,None]
    lats=np.rad2deg(np.arcsin(np.clip(unit[...,2],-1,1)))
    lons=np.rad2deg(np.arctan2(unit[...,1],unit[...,0]))
    px,py=transformer.transform(lons,lats)
    inv=~ds.transform
    cols,rows=inv*(px,py)
    # Pixel coordinates are at column+0.5, row+0.5 in an affine raster.
    cols=np.asarray(cols)-.5;rows=np.asarray(rows)-.5
    c0=int(np.floor(np.nanmin(cols)))-1;r0=int(np.floor(np.nanmin(rows)))-1
    c1=int(np.ceil(np.nanmax(cols)))+2;r1=int(np.ceil(np.nanmax(rows)))+2
    if (c1-c0)*(r1-r0)>25_000_000:raise ValueError('Unexpected projection / raster window size; refusing large allocation')
    win=Window(c0,r0,c1-c0,r1-r0)
    local=ds.read(1,window=win,boundless=True,masked=True).astype(float).filled(np.nan)
    ci=cols-c0;ri=rows-r0
    ix=np.floor(ci).astype(int);iz=np.floor(ri).astype(int)
    fx=ci-ix;fz=ri-iz
    valid=(ix>=0)&(iz>=0)&(ix+1<local.shape[1])&(iz+1<local.shape[0])
    ix=np.clip(ix,0,local.shape[1]-2);iz=np.clip(iz,0,local.shape[0]-2)
    v00=local[iz,ix];v01=local[iz,ix+1];v10=local[iz+1,ix];v11=local[iz+1,ix+1]
    good=valid & np.isfinite(v00)&np.isfinite(v01)&np.isfinite(v10)&np.isfinite(v11)
    elev=np.where(good,(1-fz)*((1-fx)*v00+fx*v01)+fz*((1-fx)*v10+fx*v11),np.nan)
    middle=n//2
    base=elev[middle,middle]
    if not np.isfinite(base):raise ValueError('DEM does not cover selected site: lat %.6f, lon %.6f'%(lat,lon))
    y=((R_KM+elev/1000)*(unit@up)-(R_KM+base/1000))
    valid_fraction=float(np.isfinite(y).mean())
    return y,valid_fraction,float(base)

def build_tiles(dem,sites=None,extent_km=6.0,n=129,observer_height_m=2.0):
    import rasterio
    if n%2!=1:raise ValueError('Grid size n must be odd to center observer on a pixel')
    if not 0.5<=extent_km<=35:raise ValueError('Extent must be 0.5-35 km')
    if not 25<=n<=301:raise ValueError('Grid points must be 25-301')
    tiles=[];errors=[]
    with rasterio.open(dem) as ds:
        print('NASA DEM:',ds.name,'size:',ds.width,'x',ds.height,'CRS:',ds.crs)
        for name,lat,lon in (sites or sites_from_data()):
            try:
                y,fraction,base=sample_grid(ds,lat,lon,extent_km,n)
                if fraction<.75:raise ValueError('Only %.1f%% of tile is covered'%(fraction*100))
                tile={'name':name,'lat':lat,'lon':lon,'n':n,'extent_km':extent_km,
                  'observer_height_m':observer_height_m,'heights_km':[None if not np.isfinite(v) else round(float(v),6) for v in y.ravel()],
                  'base_elevation_m':round(base,2),'coverage_fraction':round(fraction,4),
                  'source':'NASA LRO LOLA LDEM ('+Path(dem).name+')'}
                tiles.append(tile)
                vals=y[np.isfinite(y)]
                print(name,'ok, coverage %.1f%%, relief %.1f to %.1f m'%(100*fraction,vals.min()*1000,vals.max()*1000))
            except Exception as exc:
                errors.append({'name':name,'lat':lat,'lon':lon,'error':str(exc)})
                print(name,'SKIPPED:',exc)
    return tiles,errors

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dem',type=Path,default=ROOT/'data'/'dems'/'LDEM_80S_80MPP_ADJ.TIF')
    ap.add_argument('--extent-km',type=float,default=6.0)
    ap.add_argument('--grid',type=int,default=129)
    ap.add_argument('--height-m',type=float,default=2.0)
    args=ap.parse_args()
    if not args.dem.is_file():ap.error('DEM missing: '+str(args.dem)+'; run scripts/get_lola_dem.py')
    tiles,errors=build_tiles(args.dem,extent_km=args.extent_km,n=args.grid,observer_height_m=args.height_m)
    if not tiles:raise RuntimeError('No tiles exported. Check geographic coverage and candidate coordinates.')
    result={'kind':'NASA LOLA DEM (locally derived)', 'tiles':tiles,'skipped_sites':errors,
      'source_url':'https://pgda.gsfc.nasa.gov/products/90',
      'paper':'Barker et al. 2023 Planetary Science Journal 4 183 doi:10.3847/PSJ/acf3e1',
      'limitations':'Local 2D DEM patches are finite and do not provide the complete horizon profile; no automatic scientific timeline recalculation.'}
    out=ROOT/'web'/'terrain_sites.js'
    out.write_text('window.LUNAR_TERRAIN = '+json.dumps(result,separators=(',',':'),allow_nan=False)+';\n',encoding='utf-8')
    print('Exported',len(tiles),'tiles to',out,'(%.1f MB)'%(out.stat().st_size/1e6))
    print('Load web/index.html. Status will show the number of LOLA tiles available.')
if __name__=='__main__':main()
