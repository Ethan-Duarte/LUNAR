"""Optional *aesthetic* LROC WAC 4K texture. This does not change terrain accuracy.

NASA source: https://svs.gsfc.nasa.gov/4720/ (2019 poles-enhanced 4K TIFF).
Requires Pillow. Keep existing 2K image as WebGL fallback.
"""
from pathlib import Path
from urllib.request import urlretrieve
import tempfile

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'web'/'assets'/'lroc_color_4k.jpg'
URL='https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif'

def main():
    from PIL import Image
    DEST.parent.mkdir(parents=True,exist_ok=True)
    if DEST.is_file() and DEST.stat().st_size>300_000:
        print('4K texture already installed:',DEST)
        return
    with tempfile.TemporaryDirectory() as tmp:
        src=Path(tmp)/'lroc_4k.tif'
        print('Downloading NASA 4K LROC texture (~12 MB)...')
        urlretrieve(URL,src)
        if src.stat().st_size<1_000_000:raise ValueError('NASA image download appears incomplete')
        with Image.open(src) as img:
            if img.size!=(4096,2048):raise ValueError(f'Unexpected source dimensions: {img.size}')
            img.convert('RGB').save(DEST,format='JPEG',quality=88,optimize=True,subsampling=0)
    print('Saved',DEST, f'({DEST.stat().st_size / 1024**2:.1f} MiB)')
    print('Restart/refresh http://127.0.0.1:8000/index.html (not file://).')
if __name__=='__main__':main()
