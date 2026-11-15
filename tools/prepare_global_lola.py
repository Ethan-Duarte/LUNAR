"""Prepare a native 16-pixels/degree whole-Moon LOLA map from NASA SVS.
Run from the V1 root. Requires numpy, rasterio and Pillow. Does not modify science archives.
"""
from pathlib import Path
from urllib.request import urlopen
import json,numpy as np,rasterio
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
URL='https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif'
def main():
    cache=ROOT/'engine/data/dems/LOLA_GLOBAL_16PPD_UINT.tif'
    if not cache.exists():
        print('Downloading native global NASA LOLA:',URL,flush=True)
        with urlopen(URL,timeout=120) as r,cache.open('wb') as f:
            while b:=r.read(1024*1024):f.write(b)
    with rasterio.open(cache) as d:
        a=d.read(1).astype(float)
        if d.width!=5760 or d.height!=2880:raise ValueError('Unexpected global DEM dimensions')
    # NASA uint map = half-metres above 1727400 m; our sphere = 1737400 m.
    height=a*.5-10000
    raw=np.clip(np.rint((height+10000)/.5),1,65535).astype('uint16')
    rgba=np.zeros((*raw.shape,3),dtype='uint8');rgba[:,:,0]=raw>>8;rgba[:,:,1]=raw&255
    for base in [ROOT/'frontend/public/data/globe',ROOT/'app/data/globe']:
        if not base.exists():continue
        Image.fromarray(rgba).save(base/'moon_dem_native16.png')
        p=base/'globe.json';j=json.loads(p.read_text());j['dem']={'file':'moon_dem_native16.png','width':5760,'height':2880,'encoding':'h_m = (R*256 + G)*0.5 -10000','quantum_m':.5,'radius_m':1737400.,'source_file':URL,'credit':'NASA SVS / LOLA Science Team','grid_pixels_per_degree':16,'note':'Native published grid, approximately 1.90 km at equator; not uniformly dense laser measurements.'};p.write_text(json.dumps(j,indent=2))
    print('Native 5760×2880 global LOLA encoded without downsampling; 0.5m vertical quantization.')
if __name__=='__main__':main()
