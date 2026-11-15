import json,sys
from pathlib import Path
from lunar.geometry import observer_position,alt_az_from_vectors
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from check_data_consistency import validate

def test_basic_consistency(tmp_path):
    position=[350000,150000,80000]
    alt,az,_=alt_az_from_vectors(position,observer_position(-89.5,45),-89.5,45)
    t='2026-11-14T12:00:00Z'
    obj={'kind':'TEST EPHEMERIS','ephemeris':[{'time':t,'sun':{'position_km':position},'earth':{'position_km':position}}],
         'sites':[{'name':'test','lat':-89.5,'lon':45,'elevation_m':0,'height_m':2,
                   'samples':[{'time':t,'sun_alt':alt,'sun_az':az,'earth_alt':alt,'earth_az':az}]}]}
    file=tmp_path/'data.js';file.write_text('window.LUNAR_DATA = '+json.dumps(obj)+';')
    validate(file)
