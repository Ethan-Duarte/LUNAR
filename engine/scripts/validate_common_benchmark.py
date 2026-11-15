"""Common coordinates, dates and rules: LUNAR vs NASA and published peer results.

Uses only numerical facts from the cited peer table, not its implementation.
An additional fixed random holdout is reported separately, including failures.
"""
from __future__ import annotations
import json,sys,time
from pathlib import Path
import numpy as np
from pyproj import CRS,Transformer
import rasterio
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'scripts'))
from run_validation import sky_table,terrain,horizon,site_series,stats,write


def main():
    reference=json.loads((ROOT/'validation/common_reference.json').read_text())
    table=sky_table(reference['period'],reference['hours'],reference['step_h'])
    paths=[ROOT/'data/reference'/f'AVGVISIB_75S_120M_201608{suffix}.TIF' for suffix in ['', '_EARTH']]
    datasets=[rasterio.open(path) for path in paths]
    geographic=CRS.from_proj4('+proj=longlat +R=1737400 +no_defs')
    transforms=[Transformer.from_crs(geographic,d.crs,always_xy=True) for d in datasets]
    rows=[]
    try:
        for i,p in enumerate(reference['points']):
            lat,lon=p['lat'],p['lon']
            refs=[]
            for ds,tr in zip(datasets,transforms):
                x,y=tr.transform(lon,lat)
                raw=next(ds.sample([(x,y)],masked=True))[0]
                if np.ma.is_masked(raw):raise ValueError('Reference is no-data')
                refs.append(float(raw*ds.scales[0]+ds.offsets[0]))
            stack=terrain(lat,lon)
            z,h=horizon(stack,lat,lon,2.)
            s=site_series(table,lat,lon,z,2.,h)
            rows.append({**p,'nasa_sun':refs[0],'nasa_earth':refs[1],
                         'lunar_sun':s['sun']['any']['available_fraction'],
                         'lunar_earth':s['earth']['any']['available_fraction']})
            if i%10==0:print(f'COMMON {i+1}/{len(reference["points"])}',flush=True)
    finally:
        for ds in datasets:ds.close()
    summary={}
    for body in ['sun','earth']:
        ours=np.asarray([r['lunar_'+body] for r in rows]);peer=np.asarray([r['peer_'+body+'_2m_any'] for r in rows]);nasa=np.asarray([r['nasa_'+body] for r in rows])
        summary[body]={'lunar_minus_nasa':stats(ours-nasa),'peer_minus_nasa':stats(peer-nasa),'lunar_minus_peer':stats(ours-peer),
                       'lunar_nasa_correlation':float(np.corrcoef(ours,nasa)[0,1]),'peer_nasa_correlation':float(np.corrcoef(peer,nasa)[0,1])}
    # Retain criteria already used on the independent holdout. Relative
    # comparisons are descriptive and are not assigned a convenient pass bar.
    passed=all(s['lunar_minus_nasa']['rms']<=.03 and abs(s['lunar_minus_nasa']['mean_signed'])<=.01 and s['lunar_nasa_correlation']>=.98 for s in summary.values())
    write('common_benchmark.json',{'status':'PASS' if passed else 'FAIL','summary':summary,'rows':rows,
                                  'source':reference['source_url'],'source_blob_sha':reference['source_blob_sha'],
                                  'period':reference['period'],'hours':reference['hours'],'height_m':2.,
                                  'rule':'any visible fraction of Sun/Earth; operational Earth-center LOS is separate',
                                  'limits':['Same points, epochs and thresholds; far-field terrain chains differ.',
                                            'Peer numerical results are reproduced as published, not independently rerun.',
                                            'This set was published by the peer; it does not replace the independent random holdout.']})
    print(json.dumps(summary,indent=2),flush=True)

if __name__=='__main__':main()
