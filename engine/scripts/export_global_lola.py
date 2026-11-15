"""Convert a NASA SVS global LOLA TIFF into a compact browser DEM.

It is a 4 px/degree global TIFF, with elevations in km relative to the
1737.4-km mean reference radius, oriented longitude -180°..+180° and
latitude +90°..-90°. The output uses signed little-endian int16 metres.

The globe renderer picks its own geometry tessellation by zoom; it bilinearly
samples the *same global raster* at each LOD. Other products such as LDEM_16
can also be supplied via --input, with the same projection/units.
"""
import argparse,base64,json
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
URL='https://svs.gsfc.nasa.gov/4720/'

def convert(path, output, ppd=2):
    import rasterio
    from rasterio.enums import Resampling
    if ppd not in (1,2,4,8):raise ValueError('Output ppd must be 1, 2, 4, or 8')
    h,w=180*ppd,360*ppd
    with rasterio.open(path) as src:
        if src.width/src.height!=2:raise ValueError('Expected global equirectangular 2:1 TIFF')
        grid=src.read(1,out_shape=(h,w),resampling=Resampling.average).astype('float64')
        print('Source raster:',src.width,'x',src.height,'input dtype:',src.dtypes[0]);print('Export raster:',w,'x',h)
        # NASA SVS ldem_4.tif uses floating km relative to R=1737.4 km.
        if np.issubdtype(np.dtype(src.dtypes[0]),np.integer):
            raise ValueError('Use floating ldem_4.tif, not unsigned ldem_4_uint.tif (different elevation offset).')
        if not np.isfinite(grid).all():raise ValueError('Invalid or missing raster cells; refusing unsupported holes')
        if np.max(np.abs(grid))>30:raise ValueError('Unexpected range; expected elevations in kilometres relative to lunar radius')
        meters=np.rint(grid*1000)
        if np.any(meters < -32768) or np.any(meters>32767): raise ValueError('Elevation outside signed int16 metres')
        payload=meters.astype('<i2').tobytes()
    document={
        'width':w,'height':h,'sample_ppd':ppd,
        'height_reference':'kilometres relative to mean lunar radius 1737.4 km',
        'coordinate_frame':'MOON_ME / planetocentric lat lon (longitude centered at 0)',
        'source':'NASA SVS / LRO LOLA LDEM global elevation',
        'source_url':URL,
        'source_file':Path(path).name,
        'elevation_range_km':[round(float(grid.min()),3),round(float(grid.max()),3)],
        'heights_b64':base64.b64encode(payload).decode('ascii')}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text('window.LUNAR_GLOBAL_DEM = '+json.dumps(document,separators=(',',':'))+';\n',encoding='utf-8')
    print('Created:',output,'(%.2f MB)'%(output.stat().st_size/1e6))
    return document

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', type=Path, default=ROOT/'data/dems/ldem_4.tif')
    p.add_argument('--output', type=Path, default=ROOT/'web/global_moon.js')
    p.add_argument('--ppd',type=int,default=2,choices=[1,2,4,8])
    a=p.parse_args()
    if not a.input.is_file():p.error('Source missing; run scripts/get_global_lola.py')
    convert(a.input,a.output,a.ppd)

if __name__=='__main__':main()
