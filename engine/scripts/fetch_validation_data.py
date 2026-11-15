"""Fetch official NASA inputs and a native-resolution 20 m ridge crop.

HTTPS certificates are verified. The range reader uses Python's normal TLS
trust store, avoiding a separate GDAL curl certificate configuration.
"""
from __future__ import annotations
import io,json,hashlib,sys,urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
ROOT=Path(__file__).resolve().parents[1]
BASE='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'
ASSETS={
 'data/kernels/naif0012.tls':BASE+'lsk/naif0012.tls',
 'data/kernels/pck00011.tpc':BASE+'pck/pck00011.tpc',
 'data/kernels/de440s.bsp':BASE+'spk/planets/de440s.bsp',
 'data/kernels/moon_pa_de440_200625.bpc':BASE+'pck/moon_pa_de440_200625.bpc',
 'data/kernels/moon_de440_250416.tf':BASE+'fk/satellites/moon_de440_250416.tf',
 'data/dems/LDEM_80S_80MPP_ADJ.TIF':'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF',
 'data/dems/LDEM_60S_240MPP_ADJ.TIF':'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF',
 'data/reference/AVGVISIB_85S_060M_201608.TIF':'https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF',
 'data/reference/AVGVISIB_85S_060M_201608_EARTH.TIF':'https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608_EARTH.TIF',
 'data/reference/LPSR_85S_060M_201608.TIF':'https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_85S_060M_201608.TIF'}
ASSETS.update({f'data/reference/AVGVISIB_75S_120M_201608{suffix}.TIF':
              f'https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608{suffix}.TIF'
              for suffix in ['', '_EARTH']})


def digest(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def fetch(item):
    relative,url=item
    path=ROOT/relative;path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists():
        temp=path.with_suffix(path.suffix+'.part')
        with urllib.request.urlopen(url+'?lunar_validation_full=1',timeout=90) as r,temp.open('wb') as out:
            if r.status!=200:raise RuntimeError('Expected a complete NASA response')
            while block:=r.read(2**20):out.write(block)
        temp.replace(path)
    if path.suffix.upper()=='.TIF':
        import rasterio
        with rasterio.open(path) as ds:
            if ds.crs is None:raise ValueError('Downloaded raster has no CRS')
    print('READY',relative,flush=True)
    return {'path':relative,'url':url,'bytes':path.stat().st_size,'sha256':digest(path)}


class RangeFile(io.RawIOBase):
    """Read-only seekable HTTPS file; validate server byte ranges and cache blocks."""
    def __init__(self,url,size,block_size=262144):
        super().__init__();self.url=url;self.size=size;self.position=0;self.blocks={};self.block_size=block_size
    def readable(self):return True
    def seekable(self):return True
    def tell(self):return self.position
    def seek(self,offset,whence=0):
        self.position=int(offset if whence==0 else self.position+offset if whence==1 else self.size+offset)
        if self.position<0:raise ValueError('Negative seek')
        return self.position
    def read(self,size=-1):
        if size<0:size=self.size-self.position
        end=min(self.size,self.position+size)
        pieces=[]
        while self.position<end:
            index=self.position//self.block_size
            start=index*self.block_size;stop=min(self.size,start+self.block_size)-1
            if index not in self.blocks:
                # Distinct query keys prevent intermediaries from serving an
                # earlier range for a different request to the same URL.
                url=self.url+f'?lunar_range={start}-{stop}'
                req=urllib.request.Request(url,headers={'Range':f'bytes={start}-{stop}'})
                for attempt in range(3):
                    try:
                        with urllib.request.urlopen(req,timeout=45) as r:
                            if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {start}-{stop}/{self.size}':
                                raise IOError('NASA range response did not match the requested byte interval')
                            data=r.read()
                        if len(data)!=stop-start+1:raise IOError('Incomplete HTTP range')
                        self.blocks[index]=data;break
                    except Exception:
                        if attempt==2:raise
            offset=self.position-start
            count=min(end-self.position,len(self.blocks[index])-offset)
            pieces.append(self.blocks[index][offset:offset+count]);self.position+=count
        return b''.join(pieces)


def crop_twenty():
    import rasterio
    from pyproj import Transformer,CRS
    from rasterio.windows import from_bounds,transform
    out=ROOT/'data/dems/LDEM_20M_connecting_ridge_crop.TIF'
    manifest=ROOT/'reports/ridge_crop_manifest.json'
    if out.exists() and manifest.exists():return json.loads(manifest.read_text())
    url='https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF'
    size=2696082051
    def opener(path,mode='rb'):
        if path!=url:raise FileNotFoundError(path)
        return RangeFile(url,size)
    print('Reading native 20 m ridge window using verified HTTPS ranges',flush=True)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
        with rasterio.open(url,opener=opener) as ds:
            project=Transformer.from_crs(CRS.from_proj4('+proj=longlat +R=1737400 +no_defs'),ds.crs,always_xy=True)
            x,y=project.transform(222.8524,-89.4399)
            w=from_bounds(x-7000,y-7000,x+7000,y+7000,ds.transform).round_offsets().round_lengths()
            a=ds.read(1,window=w)
            profile=ds.profile
            profile.update(width=a.shape[1],height=a.shape[0],transform=transform(w,ds.transform),compress='deflate',tiled=True,BIGTIFF='IF_SAFER')
            out.parent.mkdir(parents=True,exist_ok=True)
            with rasterio.open(out,'w',**profile) as dest:dest.write(a,1)
            record={'source_url':url,'source_file_size':size,'source_full_checksum':'not downloaded; not established',
                    'source_window':[w.col_off,w.row_off,w.width,w.height],
                    'resampling':'none; exact native pixel window','crop_path':str(out.relative_to(ROOT)),
                    'crop_sha256':digest(out),'pixel_m':list(ds.res),'crs':ds.crs.to_wkt()}
    manifest.parent.mkdir(parents=True,exist_ok=True);manifest.write_text(json.dumps(record,indent=2))
    print('READY 20 m crop',flush=True)
    return record


def main():
    import argparse
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--crop-only',action='store_true');args=p.parse_args()
    if not args.crop_only:
        records=[]
        with ThreadPoolExecutor(max_workers=4) as pool:
            for f in as_completed([pool.submit(fetch,item) for item in ASSETS.items()]):records.append(f.result())
        (ROOT/'reports').mkdir(exist_ok=True)
        (ROOT/'reports/data_download_manifest.json').write_text(json.dumps(records,indent=2))
    crop_twenty()

if __name__=='__main__':main()
