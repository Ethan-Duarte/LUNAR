"""End-to-end export test with fake ephemerides and DEM, NOT NASA verification."""
import json,sys
import numpy as np
from scripts import survey_sites as ss


def test_cli_publishes_separate_terrain_ranking_and_site_timelines(monkeypatch,tmp_path):
    (tmp_path/'data'/'kernels').mkdir(parents=True)
    (tmp_path/'web').mkdir()
    (tmp_path/'data.js').write_text('keep')
    (tmp_path/'sample.tif').write_bytes(b'fake (sampler mocked)')
    class FakeSPICE:
        def str2et(self,utc):return 0
        def spkpos(self,body,*args):
            return np.array([149600000.,0.,0.]) if body=='SUN' else np.array([384400.,0.,0.]),0
        def kclear(self):pass
    class FlatDEM:
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def __call__(self,lons,lats):return np.zeros_like(np.asarray(lons,dtype=float))
    monkeypatch.setattr(ss,'ROOT',tmp_path)
    monkeypatch.setattr(ss,'load_spice',lambda path:FakeSPICE())
    monkeypatch.setattr(ss,'load_dem_sampler',lambda path:FlatDEM())
    monkeypatch.setattr(sys,'argv',['survey_sites.py','--region','south','--points','35',
        '--top','3','--days','1','--step-hours','12',
        '--dem',str(tmp_path/'sample.tif'),'--terrain-top','1',
        '--az-step','30','--dist-step-m','2000'])
    ss.main()
    src=(tmp_path/'web'/'survey.js').read_text()
    obj=json.loads(src.removeprefix('window.LUNAR_SURVEY = ').rstrip(';\n'))
    assert obj['schema_version']==2
    assert len(obj['top_sites'])==3
    assert obj['terrain']['attempted']==1
    assert obj['terrain']['valid']==1
    assert len(obj['terrain_ranked'])==1
    name=obj['terrain_ranked'][0]['name']
    assert obj['details'][name]['analysis_group']=='survey_terrain'
    assert len(obj['details'][name]['samples'])==3
    assert (tmp_path/'reports'/'terrain_ranked.csv').is_file()
    assert not (tmp_path/'web'/'data.js').exists(), 'Never overwrite default timelines'
    # Subsequent geometric run cannot leave old terrain ranking in the browser.
    monkeypatch.setattr(sys,'argv',['survey_sites.py','--region','south','--points','35',
        '--top','3','--days','1','--step-hours','12','--no-auto-terrain'])
    ss.main()
    src=(tmp_path/'web'/'survey.js').read_text()
    obj=json.loads(src.removeprefix('window.LUNAR_SURVEY = ').rstrip(';\n'))
    assert not obj['terrain_ranked']
    assert obj['terrain']['attempted']==0
    assert not (tmp_path/'reports'/'terrain_ranked.csv').exists()
