"""Fetch the NASA SVS LROC lunar color mosaic for visual rendering only.
Source: https://svs.gsfc.nasa.gov/4720/ (LROC WAC composite; NASA SVS).
This albedo map is aesthetic, not a scientific elevation or visibility dataset.
"""
from pathlib import Path
from urllib.request import urlretrieve
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'web'/'assets'/'lroc_color_2k.jpg'
URL='https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg'
def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    if OUT.exists() and OUT.stat().st_size>100_000:
        print('Already present:',OUT)
        return
    print('Downloading from NASA:', URL)
    urlretrieve(URL,OUT)
    if OUT.stat().st_size<100_000:
        OUT.unlink(missing_ok=True)
        raise RuntimeError('Incomplete lunar imagery download')
    print('Saved:',OUT,OUT.stat().st_size,'bytes')
if __name__=='__main__': main()
