"""Build display textures from primary NASA imagery, without inherited edits."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
from pathlib import Path
from urllib.request import urlopen
from PIL import Image
from prepare_polar_products import ROOT,sha

SOURCES={
 'moon':'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif',
 'earth':'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.png',
}


def main():
    cache=ROOT/'engine/data/direct_sources';cache.mkdir(parents=True,exist_ok=True)
    target=ROOT/'frontend/public/data/globe'
    records=[]
    for name,url in SOURCES.items():
        source=cache/url.rsplit('/',1)[1]
        if not source.exists():
            with urlopen(url+'?lunar_imagery=1',timeout=60) as response:
                data=response.read()
            with Image.open(BytesIO(data)) as image:image.verify()
            source.write_bytes(data)
        with Image.open(source) as image:
            for width in ([4096,2048] if name=='moon' else [2048]):
                output=target/(f'moon_color_{width//1024}k.jpg' if name=='moon' else 'earth_2k.jpg')
                image.convert('RGB').resize((width,width//2),Image.Resampling.LANCZOS).save(output,quality=94,subsampling=0)
                records.append(dict(file=output.name,source_url=url,source_sha256=sha(source),
                                    output_sha256=sha(output),processing='RGB, Lanczos resize, JPEG quality 94, no chroma subsampling; no synthetic clouds'))
    metadata=json.loads((target/'globe.json').read_text())
    metadata['earth'].update(source_url=SOURCES['earth'],note='NASA Blue Marble surface image; no added cloud layer.')
    metadata['generator']='tools/prepare_globe_images.py'
    (target/'globe.json').write_text(json.dumps(metadata,indent=2)+'\n')
    (ROOT/'qa/v110/globe_images.json').write_text(json.dumps(records,indent=2)+'\n')
    print('Rebuilt',len(records),'NASA image textures',flush=True)


if __name__=='__main__':main()
