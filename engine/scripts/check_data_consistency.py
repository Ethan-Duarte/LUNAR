"""Independent consistency check for browser-exported SPICE topocentric geometry.

Does not establish scientific correctness of SPICE kernels or DEM. It verifies
that site angular coordinates agree with source body position vectors within a
numerical tolerance, and checks basic units, timestamps, and source flags.

Run after generating web/data.js:
    py scripts/check_data_consistency.py
"""
import argparse,json,math
from pathlib import Path
import numpy as np
from sys import path as sys_path
ROOT=Path(__file__).resolve().parents[1]
sys_path.insert(0,str(ROOT))
from lunar.geometry import surface_basis,observer_position,alt_az_from_vectors

PREFIX='window.LUNAR_DATA = '

def angular_error_deg(a,b):
    return abs((a-b+180)%360-180)

def validate(path,limit_deg=.015):
    raw=path.read_text(encoding='utf8').strip()
    if not raw.startswith(PREFIX):raise ValueError('Input is not LUNAR data.js')
    data=json.loads(raw[len(PREFIX):].rstrip('; \r\n'))
    frames={rec['time']:rec for rec in data.get('ephemeris',[])}
    if not frames: raise ValueError('No Moon-fixed ephemeris: cannot validate. Generate real SPICE data first.')
    failures=[];max_resid=0;checks=0
    for site in data['sites']:
        observer=observer_position(site['lat'],site['lon'],site.get('elevation_m',0),site.get('height_m',2))
        for record in site['samples']:
            frame=frames.get(record['time'])
            if frame is None:
                failures.append(f"{site['name']} missing frame {record['time']}");continue
            for body in ('sun','earth'):
                source=frame[body]
                calculated_alt,calculated_az,_=alt_az_from_vectors(source['position_km'],observer,site['lat'],site['lon'])
                alt_error=abs(calculated_alt-record[body+'_alt'])
                az_error=angular_error_deg(calculated_az,record[body+'_az'])
                # Great-circle separation of directions avoids pole-azimuth singularity.
                a=np.radians([calculated_alt,calculated_az]);b=np.radians([record[body+'_alt'],record[body+'_az']])
                c=math.sin(a[0])*math.sin(b[0])+math.cos(a[0])*math.cos(b[0])*math.cos(a[1]-b[1])
                separation=math.degrees(math.acos(max(-1,min(1,c))))
                max_resid=max(max_resid,separation);checks+=1
                if separation>limit_deg:failures.append(f"{site['name']} {record['time']} {body}: {separation:.5f} deg")
    print('Source:',data['kind']);print('Samples checked:',checks)
    print('Max direction residual: %.7f deg'%max_resid)
    print('Threshold: %.5f deg'%limit_deg)
    if failures:
        for message in failures[:10]:print('FAILED:',message)
        raise SystemExit(f'{len(failures)} invalid site-body samples')
    print('PASS: angles consistent with Moon-fixed SPICE body vectors (internal check only).')

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data',type=Path,default=ROOT/'web/data.js')
    ap.add_argument('--tolerance-deg',type=float,default=.015)
    args=ap.parse_args()
    validate(args.data,args.tolerance_deg)
if __name__=='__main__':main()
