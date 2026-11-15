import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from export_global_lola import convert
import numpy as np
import rasterio
from rasterio.transform import from_origin

def test_global_lola_export(tmp_path):
    tif=tmp_path/'ldem_float.tif'
    sample=np.linspace(-1.5,2.1,8*16,dtype='float32').reshape(8,16)
    with rasterio.open(tif,'w',driver='GTiff',height=8,width=16,count=1,dtype='float32',transform=from_origin(-180,90,22.5,22.5)) as ds:ds.write(sample,1)
    out=tmp_path/'global_moon.js'
    result=convert(tif,out,ppd=1)
    assert result['width']==360 and result['height']==180
    import base64
    raw=base64.b64decode(result['heights_b64'])
    data=np.frombuffer(raw,dtype='<i2')
    assert data.size==360*180
    assert data.min()>=-1500 and data.max()<=2100
