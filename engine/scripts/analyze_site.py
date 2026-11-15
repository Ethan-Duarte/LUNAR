"""LUNAR advanced: measured terrain, 1–186 day single-site SPICE study.

Examples:
  py scripts/analyze_site.py --lat -89.45 --lon 222.7 --days 180
  py scripts/analyze_site.py --lat -85.5 --lon 10 --days 30 --step-hours .5 --sun-rule any

Output: reports/advanced_site.json and reports/advanced_events.csv.
"""
from __future__ import annotations
import argparse,csv,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lunar.mission_analysis import Request,analyze

def run(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--lat',type=float,required=True);ap.add_argument('--lon',type=float,required=True)
    ap.add_argument('--start',default='2026-11-14');ap.add_argument('--days',type=int,default=30)
    ap.add_argument('--step-hours',type=float,default=1.);ap.add_argument('--observer-height-m',type=float,default=2.)
    ap.add_argument('--sun-rule',choices=['any','half','full'],default='half')
    ap.add_argument('--earth-clearance-deg',type=float,default=0.)
    ap.add_argument('--terrain-radius-km',type=float,default=300.)
    ap.add_argument('--az-step-deg',type=float,default=.5);ap.add_argument('--dist-step-m',type=float,default=20.)
    ap.add_argument('--refine-minutes',type=float,default=1.)
    ap.add_argument('--event-scan-minutes',type=float,default=5.)
    ap.add_argument('--dem',type=str,default=None)
    ap.add_argument('--no-download',action='store_true')
    args=ap.parse_args(argv)
    kwargs=vars(args);kwargs['auto_download']=not kwargs.pop('no_download')
    req=Request(**kwargs)
    def status(i,total):
        if i%500==0 or i==total:print(f'  SPICE + LOLA epoch {i}/{total}',flush=True)
    result=analyze(req,ROOT,progress=status)
    out=ROOT/'reports';out.mkdir(exist_ok=True)
    (out/'advanced_site.json').write_text(json.dumps(result,indent=2,allow_nan=False),encoding='utf-8')
    with (out/'advanced_events.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['body','event','time_utc','bracket_minutes']);w.writeheader();w.writerows(result['site']['events'])
    m=result['site']['metrics']
    print(f'LOLA measured: Sun {m["sun_fraction"]:.1%}; Earth LOS {m["earth_fraction"]:.1%}; both {m["both_fraction"]:.1%}')
    print(f'Longest sampled/refined Sun darkness: {m["sun_blackout_h"]:.1f} h; Earth LOS outage {m["earth_blackout_h"]:.1f} h')
    print('IMPORTANT: transition refinement is NOT a continuous guarantee; shorter unseen events may remain. No link budget or landing safety.')
    print('Results: reports/advanced_site.json and advanced_events.csv')
    return result
if __name__=='__main__':run()
