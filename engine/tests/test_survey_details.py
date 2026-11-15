"""Regression tests: selecting candidates must rely on their own scientific data.

Uses intentionally constructed vectors/terrain — not a replacement for
independent validation against downloaded NAIF/LOLA products.
"""
from datetime import datetime,timedelta,timezone
import numpy as np
from lunar.survey import Point,screen_sites
from scripts import survey_sites as ss


def example():
    p=Point('Survey 0000',0,0)
    vectors=[{'sun':np.array([149_600_000.,0.,0.]),
              'earth':np.array([20_000.,384_400.,0.])} for _ in range(5)]
    times=[datetime(2026,11,14,tzinfo=timezone.utc)+timedelta(hours=2*i) for i in range(5)]
    stats,arrays=screen_sites([p],vectors,2.)
    return p,vectors,times,stats,arrays


def test_screen_detail_matches_candidate_not_preloaded():
    p,vectors,times,stats,arrays=example()
    detail=ss.make_screen_details(stats,[p],arrays,vectors,times,2.,2.)[p.name]
    assert len(detail['samples'])==5
    assert detail['analysis_group']=='survey_geometry'
    assert detail['metrics']['sun_fraction']>.99
    assert detail['metrics']['earth_fraction']>.99
    assert detail['samples'][0]['earth_az']==90.0
    assert detail['samples'][0]['time'].endswith('Z')


def test_lola_hill_changes_terrain_visibility(monkeypatch,tmp_path):
    p,vectors,times,stats,arrays=example()
    class FakeDEM:
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def __call__(self,lons,lats):
            # A measured-style high east-facing ridge close to the observer.
            lon=np.asarray(lons)
            return np.where((lon>.08)&(lon<.4)&(np.abs(lats)<.5),2500.,0.)
    monkeypatch.setattr(ss,'load_dem_sampler',lambda path:FakeDEM())
    rows,details=ss.refinement(stats,vectors,times,tmp_path/'mock.tif',2.,2.,
                               40.,6.,500.,1,.95)
    assert rows[0]['terrain_valid']
    assert rows[0]['horizon_coverage']==1.0
    assert rows[0]['terrain_earth_fraction']<stats[0]['earth_fraction']
    assert details[p.name]['analysis_group']=='survey_terrain'
    assert details[p.name]['metrics']['earth_fraction']<.5
    assert len(details[p.name]['samples'])==5
    horizon=details[p.name]['horizon']
    assert len(horizon['az_deg'])==len(horizon['alt_deg'])==60
    assert horizon['radius_km']==40.0
    assert horizon['coverage_fraction']==1.0


def test_incomplete_dem_is_not_reported_as_refined(monkeypatch,tmp_path):
    _,vectors,times,stats,_=example()
    class Incomplete:
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def __call__(self,lon,lat):
            lon=np.asarray(lon)
            return np.where(lon<0,np.nan,0.)
    monkeypatch.setattr(ss,'load_dem_sampler',lambda path:Incomplete())
    rows,details=ss.refinement(stats,vectors,times,tmp_path/'mock.tif',2.,2.,
                               40.,6.,500.,1,.95)
    assert rows[0]['terrain_valid'] is False
    assert details=={}
