"""Regenerate site-centred browser terrain from primary LOLA / SLDEM2015 data.

The existing patch index supplies requested locations/resolutions, never heights.
PDS raw image windows are fetched with checked byte ranges; GeoTIFF windows use
the LUNAR range reader. Partial source transfers have per-window hashes, not an
invented checksum for the entire remote source. Requires scipy and pyproj too.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen

import numpy as np
import rasterio
from rasterio.windows import Window
from scipy.ndimage import map_coordinates
from pyproj import CRS, Transformer

from prepare_polar_products import ROOT, height_codes, sha
sys.path.insert(0, str(ROOT / 'engine'))
from scripts.fetch_validation_data import RangeFile

RADIUS = 1737400.
CACHE = ROOT / 'engine/data/direct_sources'
PDS = 'https://imbrium.mit.edu/DATA/'
SOURCES = {}
WINDOWS = {}


def coordinates(lat, lon, size, pixel):
    lat, lon = np.radians([lat, lon])
    up = np.array([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)])
    east = np.array([-np.sin(lon), np.cos(lon), 0])
    north = np.cross(up, east)
    x, y = np.meshgrid((np.arange(size)+.5-size/2)*pixel,
                       (size/2-np.arange(size)-.5)*pixel)
    denominator = (2*RADIUS)**2 + x*x+y*y
    xyz = ((4*RADIUS*x)[..., None]*east + (4*RADIUS*y)[..., None]*north +
           ((2*RADIUS)**2-x*x-y*y)[..., None]*up) / denominator[..., None]
    return np.degrees(np.arcsin(xyz[..., 2])), np.degrees(np.arctan2(xyz[..., 1], xyz[..., 0]))


def label(url):
    path = CACHE / url.rsplit('/', 1)[1]
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(urlopen(url, timeout=45).read())
    text = path.read_text()
    def number(key):
        match = re.search(r'^\s*'+key+r'\s*=\s*([-+\d.eE]+)', text, re.M)
        if not match:
            raise ValueError('Missing PDS label field '+key)
        return float(match.group(1))
    SOURCES[url] = dict(url=url, sha256=sha(path))
    return number, text


def ranged(url, begin, end, total):
    key = hashlib.sha256(f'{url}:{begin}:{end}'.encode()).hexdigest()
    path = CACHE / 'ranges' / key
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        request = Request(url+f'?lunar_patch_bytes={begin}-{end}', headers={'Range':f'bytes={begin}-{end}'})
        for attempt in range(3):
            try:
                with urlopen(request, timeout=60) as response:
                    if response.status != 206 or response.headers.get('Content-Range') != f'bytes {begin}-{end}/{total}':
                        raise IOError('Incorrect source byte range')
                    data = response.read()
                if len(data) != end-begin+1:
                    raise IOError('Incomplete source byte range')
                temporary=path.with_suffix('.part');temporary.write_bytes(data);temporary.replace(path)
                break
            except Exception:
                if attempt == 2:
                    raise
    WINDOWS[key] = dict(url=url, first_byte=begin, last_byte=end, source_bytes=total, sha256=sha(path))
    return path.read_bytes()


def raw_sample(url, rows, cols, shape, dtype, factor):
    height, width = shape
    top=max(0,int(np.floor(rows.min()))-1);bottom=min(height,int(np.ceil(rows.max()))+2)
    left=max(0,int(np.floor(cols.min()))-1);right=min(width,int(np.ceil(cols.max()))+2)
    if bottom<=top or right<=left:
        return np.full(rows.shape,np.nan)
    item=np.dtype(dtype).itemsize; stride=width*item; total=height*stride
    starts=list(range(top,bottom,64))
    def block(row):
        stop=min(bottom,row+64)
        data=ranged(url,row*stride,stop*stride-1,total)
        return np.frombuffer(data,dtype=dtype).reshape(stop-row,width)[:,left:right].copy()
    with ThreadPoolExecutor(max_workers=6) as pool:
        crop=np.concatenate(list(pool.map(block,starts)))
    valid=np.isfinite(crop)&(crop>-1e20)&(crop>-32768 if dtype=='<i2' else True)
    crop=crop.astype('float32')*factor;crop[~valid]=np.nan
    sampled=map_coordinates(crop,[rows-top,cols-left],order=1,mode='nearest',prefilter=False)
    inside=(rows>=-.5)&(rows<height-.5)&(cols>=-.5)&(cols<width-.5)
    return np.where(inside,sampled,np.nan)


def sldem(latitudes, longitudes, nearest=False):
    result=np.full(latitudes.shape,np.nan,dtype='float32')
    seams=np.zeros(latitudes.shape,dtype=bool)
    longitude=longitudes%360
    # Tile ownership follows the source image edges, not the site centre.
    lat_band=np.floor(latitudes/30).astype(int)*30
    lon_band=np.floor(longitude/45).astype(int)*45
    for south,west in sorted(set(zip(lat_band.ravel(),lon_band.ravel()))):
        if south < -60 or south >=60:
            continue
        north=south+30;east=west+45
        def latitude_name(value): return f'{abs(value):02d}'+('N' if value>=0 else 'S')
        name=f'SLDEM2015_512_{latitude_name(south)}_{latitude_name(north)}_{west:03d}_{east:03d}_FLOAT'
        # The published southern tile bordering the equator uses 00S.
        if south<0 and north==0:
            name=name.replace('_00N_', '_00S_')
        stem=PDS+'SLDEM2015/TILES/FLOAT_IMG/'+name
        get,text=label(stem+'.LBL')
        if 'PC_REAL' not in text or get('SAMPLE_BITS')!=32:
            raise ValueError('Unexpected SLDEM sample representation')
        height,width=int(get('LINES')),int(get('LINE_SAMPLES'))
        mask=(lat_band==south)&(lon_band==west)
        rows=(north-latitudes[mask])*512-.5;cols=(longitude[mask]-west)*512-.5
        if nearest:
            rows=np.rint(rows);cols=np.rint(cols)
        else:
            seams[mask]=(rows<0)|(rows>height-1)|(cols<0)|(cols>width-1)
        result[mask]=raw_sample(stem+'.IMG',rows,cols,(height,width),'<f4',1000)
    # A bilinear stencil may straddle two source tiles. Fetch its four actual
    # pixel centres from their owning tiles instead of clamping at that seam.
    if not nearest and seams.any():
        rr=(60-latitudes[seams])*512-.5;cc=longitude[seams]*512-.5
        r0=np.floor(rr);c0=np.floor(cc);dy=rr-r0;dx=cc-c0
        blended=np.zeros(rr.shape,dtype='float64')
        for oy,ox,weight in [(0,0,(1-dy)*(1-dx)),(0,1,(1-dy)*dx),(1,0,dy*(1-dx)),(1,1,dy*dx)]:
            centre_lat=60-(r0+oy+.5)/512
            centre_lon=((c0+ox+.5)/512)%360
            blended+=sldem(centre_lat,centre_lon,nearest=True)*weight
        result[seams]=blended
    return result


def polar_raw(latitudes,longitudes):
    stem=PDS+'LOLA_GDR/POLAR/IMG/LDEM_60S_60M'
    get,text=label(stem+'.LBL')
    if 'LSB_INTEGER' not in text or get('SAMPLE_BITS')!=16:
        raise ValueError('Unexpected LOLA sample representation')
    phi=np.radians(latitudes);lam=np.radians(longitudes)
    rho=2*RADIUS*np.tan(np.pi/4+phi/2)
    x=rho*np.sin(lam);y=rho*np.cos(lam)
    rows=get('LINE_PROJECTION_OFFSET')-y/get('MAP_SCALE')
    cols=get('SAMPLE_PROJECTION_OFFSET')+x/get('MAP_SCALE')
    return raw_sample(stem+'.IMG',rows,cols,(int(get('LINES')),int(get('LINE_SAMPLES'))),'<i2',get('SCALING_FACTOR'))


def tiff_sample(dataset,latitudes,longitudes):
    transform=Transformer.from_crs(CRS.from_proj4('+proj=longlat +R=1737400 +no_defs'),dataset.crs,always_xy=True)
    x,y=transform.transform(longitudes,latitudes)
    inverse=~dataset.transform
    cols=inverse.a*x+inverse.b*y+inverse.c-.5
    rows=inverse.d*x+inverse.e*y+inverse.f-.5
    top=max(0,int(np.floor(rows.min()))-1);left=max(0,int(np.floor(cols.min()))-1)
    bottom=min(dataset.height,int(np.ceil(rows.max()))+2);right=min(dataset.width,int(np.ceil(cols.max()))+2)
    if bottom<=top or right<=left:
        return np.full(rows.shape,np.nan)
    crop=dataset.read(1,window=Window(left,top,right-left,bottom-top),masked=True).astype('float32').filled(np.nan)
    return map_coordinates(crop,[rows-top,cols-left],order=1,mode='constant',cval=np.nan,prefilter=False)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only',nargs='*',help='Build selected patch ids; default all')
    options=parser.parse_args()
    folder=ROOT/'frontend/public/data/patches';index_path=folder/'patches.json'
    index=json.loads(index_path.read_text())
    report_path=ROOT/'qa/v110/site_patch_build.json'
    report=json.loads(report_path.read_text()) if report_path.exists() else {'patches':{}}
    fine_url='https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF'
    blocks={}
    def opener(path,mode='rb'):
        if path!=fine_url:
            raise FileNotFoundError(path)
        stream=RangeFile(fine_url,2696082051)
        stream.blocks=blocks
        return stream
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'), rasterio.open(fine_url,opener=opener) as fine:
        with rasterio.open(CACHE/'LDEM_80S_80MPP_ADJ.TIF') as polar:
            for entry in index['patches']:
                if options.only and entry['id'] not in options.only:
                    continue
                outputs=[]
                for outer in [False,True] if entry.get('outer') else [False]:
                    spec=entry['outer'] if outer else entry
                    size=spec.get('size',index['size']);pixel=spec.get('pixel_m',index['pixel_m'])
                    lat,lon=coordinates(entry['lat'],entry['lon'],size,pixel)
                    if pixel==20:
                        values=tiff_sample(fine,lat,lon);source=fine_url
                    elif entry['lat'] < -60:
                        values=polar_raw(lat,lon);source=PDS+'LOLA_GDR/POLAR/IMG/LDEM_60S_60M.IMG'
                        high=tiff_sample(polar,lat,lon)
                        values=np.where(np.isfinite(high),high,values)
                        source+='; https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF'
                    else:
                        values=sldem(lat,lon);source='NASA/PDS SLDEM2015; source labels and byte windows in qa/v110/site_patch_build.json'
                    if not np.isfinite(values).any():
                        raise ValueError('No primary-source coverage for '+entry['id'])
                    # The 20 m browser format uses a per-patch offset to retain
                    # finer vertical quantization than the broad-area format.
                    scale=.1 if pixel==20 else .5
                    offset=math.floor(float(np.nanmin(values)))-1 if pixel==20 else -10000
                    codes=np.zeros(values.shape,dtype='uint16');valid=np.isfinite(values)
                    number=np.rint((values[valid]-offset)/scale)
                    if np.any((number<1)|(number>65535)):
                        raise ValueError('Patch height range is not encodable')
                    codes[valid]=number.astype('uint16')
                    rgb=np.stack((codes>>8,codes&255,np.zeros_like(codes)),axis=-1).astype('uint8')
                    from PIL import Image
                    path=folder/spec['file'];Image.fromarray(rgb).save(path)
                    spec['source']=source;spec['nodata_fraction']=float(1-valid.mean())
                    if not outer:
                        entry['height_scale_m']=scale;entry['height_offset_m']=offset
                    outputs.append(dict(file=spec['file'],sha256=sha(path),pixel_m=pixel,
                                        valid_fraction=float(valid.mean()),source=source))
                entry['generator']='tools/prepare_site_patches.py'
                report['patches'][entry['id']]=outputs
                labels={v['url']:v for v in report.get('source_labels',[])};labels.update(SOURCES)
                windows={v['sha256']:v for v in report.get('source_windows',[])}
                windows.update({v['sha256']:v for v in WINDOWS.values()})
                fetched={v['block']:v for v in report.get('fine_tiff',{}).get('fetched_blocks',[])}
                fetched.update({k:dict(block=k,sha256=hashlib.sha256(v).hexdigest()) for k,v in blocks.items()})
                report.update(generator='tools/prepare_site_patches.py',source_labels=list(labels.values()),
                              source_windows=list(windows.values()),
                              fine_tiff=dict(url=fine_url,size_bytes=2696082051,
                               fetched_blocks=list(fetched.values()),
                               note='Only selected byte ranges fetched; full-source checksum not established'))
                report_path.write_text(json.dumps(report,indent=2)+'\n')
                index_path.write_text(json.dumps(index,indent=2)+'\n')
                print('PATCH',entry['id'],flush=True)


if __name__=='__main__':
    main()
