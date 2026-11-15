"""Retrieve a public NASA/GSFC LOLA south-pole COG for local terrain processing.

Source: Barker et al. (2023), https://pgda.gsfc.nasa.gov/products/90
At 80 meters/pixel, the file is approximately 181 MB. This script never
silently substitutes sample terrain on download failure.
"""
import argparse
from pathlib import Path
import urllib.request
import urllib.error

URL='https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF'
OUT=Path(__file__).resolve().parents[1]/'data'/'dems'/'LDEM_80S_80MPP_ADJ.TIF'

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',type=Path,default=OUT)
    ap.add_argument('--url',default=URL)
    args=ap.parse_args()
    dest=args.output;dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists():
        print('Already exists:',dest,'(',dest.stat().st_size,'bytes)')
        return
    temp=dest.with_suffix(dest.suffix+'.part')
    try:
        req=urllib.request.Request(args.url,headers={'User-Agent':'LUNAR research-prototype (educational; public NASA data)'})
        with urllib.request.urlopen(req,timeout=45) as response,open(temp,'wb') as out:
            length=int(response.headers.get('Content-Length') or 0)
            total=0;next_tick=0
            while True:
                chunk=response.read(2*1024*1024)
                if not chunk:break
                out.write(chunk);total+=len(chunk)
                if total>=next_tick:
                    print('Downloaded %.1f MB%s'%(total/1e6,(' / %.1f MB'%(length/1e6)) if length else ''))
                    next_tick+=25_000_000
            if total<1_000_000: raise RuntimeError('Suspiciously small response; refusing non-DEM download')
        temp.replace(dest)
        print('Saved',dest,'(',total,'bytes)')
    except Exception:
        print('Download unsuccessful. For a manual download use:')
        print(args.url)
        print('Put the .TIF in data/dems/ and rerun export_lola_tiles.py')
        if temp.exists():temp.unlink()
        raise
if __name__=='__main__':main()
