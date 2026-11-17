"""Acquire fresh JPL Horizons checks, independent of previous reference fixtures.

These check sky pointing only, with a spherical Moon observer 2 m above the
1737.4 km reference sphere; they do not validate terrain obstruction.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'engine/scripts'))
from validate_jpl_auto import build_params, request_horizons, parse_horizons


def main():
    sites=[(-89.5,0),(-88.25,95),(-85,-150),(-70,30),(0,0),(25,45),(-35,160),(80,-90)]
    dates=[datetime(2026,12,2,3,17,tzinfo=timezone.utc)+timedelta(days=d) for d in [0,7,31,92,183]]
    cache=ROOT/'qa/v110/horizons';cache.mkdir(parents=True,exist_ok=True)
    def query(item):
        lat,lon,target=item
        params=build_params(lat,lon,.002,dates,target)
        raw,url=request_horizons(params,cache)
        header,rows=parse_horizons(raw)
        return lat,lon,target,rows,dict(url=url,sha256=hashlib.sha256(raw.encode()).hexdigest(),
                                      frame='Horizons lunar mean Earth',altitude_km=.002)
    with ThreadPoolExecutor(max_workers=3) as pool:
        replies=list(pool.map(query,[(lat,lon,target) for lat,lon in sites for target in ['10','399']]))
    records={};manifest=[]
    for lat,lon,target,rows,provenance in replies:
        manifest.append(provenance)
        for date,row in zip(dates,rows):
            key=(lat,lon,date.isoformat())
            record=records.setdefault(key,dict(lat=lat,lon=lon,h_m=2,utc=date.isoformat().replace('+00:00','Z')))
            body='sun' if target=='10' else 'earth'
            record[body+'_az']=row['az'];record[body+'_el']=row['el']
    path=ROOT/'frontend/public/data/ephem/validation_vectors.json'
    path.write_text(json.dumps(list(records.values()),indent=2)+'\n')
    (cache/'requests.json').write_text(json.dumps(dict(generator='tools/prepare_pointing_checks.py',
        requests=manifest,output_sha256=hashlib.sha256(path.read_bytes()).hexdigest()),indent=2)+'\n')
    print('Fresh JPL pointing records:',len(records),flush=True)


if __name__=='__main__':main()
