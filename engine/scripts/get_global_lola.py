"""Download NASA SVS global LOLA elevation TIFF (4 px/degree, ~4 MB).

Source: NASA Scientific Visualization Studio CGI Moon Kit, visualization 4720.
https://svs.gsfc.nasa.gov/4720/
This is *not* the high-resolution south-pole DEM.
"""
import argparse
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
URL='https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif'

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--url', default=URL, help='Official NASA download URL')
    p.add_argument('--output', type=Path, default=ROOT/'data/dems/ldem_4.tif')
    args=p.parse_args()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    if args.output.is_file() and args.output.stat().st_size>1_000_000:
        print('Using existing global LOLA:',args.output);return
    temp=args.output.with_suffix('.tif.part')
    try:
        with urlopen(Request(args.url,headers={'User-Agent':'LUNAR-SpaceApps/2026 educational research'}),timeout=90) as response,open(temp,'wb') as out:
            while True:
                data=response.read(1024*512)
                if not data: break
                out.write(data)
        if temp.stat().st_size<1_000_000: raise RuntimeError('The downloaded file is too small to be a global TIFF')
        temp.replace(args.output)
        print('Saved NASA global LOLA TIFF:',args.output,round(args.output.stat().st_size/1e6,2),'MB')
    finally:
        if temp.exists():temp.unlink()

if __name__=='__main__':main()
