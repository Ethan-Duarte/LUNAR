"""Compare LUNAR MOON_ME SPICE topocentric angles with *independent* JPL Horizons data.

No independent values are bundled: supply a CSV manually downloaded from
Horizons using matched Moon-fixed observer position, epoch, frames and
aberration conventions. This tool does NOT assert validation without those data.

CSV fields: utc,lat_deg,lon_e_deg,sun_alt_deg,sun_az_deg,earth_alt_deg,earth_az_deg
Optional 1st line # JPL Horizons query/setup provenance.
Usage: py scripts/compare_jpl_horizons.py --reference my_horizons.csv
"""
from __future__ import annotations
import argparse,csv,json,math,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lunar.geometry import load_spice,body_topocentric

FIELDS=('utc','lat_deg','lon_e_deg','sun_alt_deg','sun_az_deg','earth_alt_deg','earth_az_deg')

def wrap_error(degrees):return (degrees+180)%360-180

def compare(rows,compute):
    errors=[]
    for r in rows:
        o=compute(r['utc'],float(r['lat_deg']),float(r['lon_e_deg']))
        for name in ('sun','earth'):
            for k,reference_field in (('alt_deg',name+'_alt_deg'),('az_deg',name+'_az_deg')):
                got=float(o[name][k]);expected=float(r[reference_field]);diff=(wrap_error(got-expected) if k=='az_deg' else got-expected)
                errors.append({'time':r['utc'],'body':name,'quantity':k,'error_deg':diff})
    if not errors:raise ValueError('No Horizons reference samples provided')
    aggregates={}
    for name in ('sun','earth'):
        for key in ('alt_deg','az_deg'):
            values=np.array([e['error_deg'] for e in errors if e['body']==name and e['quantity']==key])
            aggregates[name+'_'+key]={'rms_deg':round(float(np.sqrt(np.mean(values**2))),8),
                'max_abs_deg':round(float(np.max(np.abs(values))),8),'count':len(values)}
    return {'comparisons':len(rows),'aggregates':aggregates,'errors':errors,
            'caution':'Any Horizons/NAIF observer-frame, time-scale or aberration difference invalidates direct angle comparisons. This is an independent check only when input truly comes from Horizons.'}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--reference',type=Path,required=True,help='Actual independent Horizons CSV, with recorded query provenance')
    p.add_argument('--observer-height-m',type=float,default=2.)
    p.add_argument('--max-altitude-error-deg',type=float,default=.1)
    args=p.parse_args()
    with args.reference.open(encoding='utf-8-sig',newline='') as f:
        rows=list(csv.DictReader(line for line in f if not line.lstrip().startswith('#')))
    if not rows:raise ValueError('Reference CSV has no data')
    if any(not all(key in r for key in FIELDS) for r in rows):raise ValueError('Reference CSV missing required fields: '+', '.join(FIELDS))
    spice=load_spice(ROOT/'data'/'kernels')
    try:
        def compute(utc,lat,lon):return body_topocentric(spice,utc,lat,lon,0.,args.observer_height_m)
        result=compare(rows,compute)
    finally:spice.kclear()
    output=ROOT/'reports'/'jpl_horizons_comparison.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('JPL Horizons comparison:',result['aggregates'])
    print('Saved',output)
    failures=[k for k,v in result['aggregates'].items() if 'alt' in k and v['max_abs_deg']>args.max_altitude_error_deg]
    if failures:raise SystemExit('Discrepancy exceeds requested threshold: '+', '.join(failures))
    print('Altitude deviations within requested limit; provenance must be checked manually.')
if __name__=='__main__':main()
