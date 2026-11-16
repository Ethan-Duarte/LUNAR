"""Recheck all fixed Earth reference values against the original NASA IMG (51 MB).

Standard-library-only audit. Run from repository root; does not alter scientific inputs.
"""
from pathlib import Path
import hashlib,json,math,struct,urllib.request
ROOT=Path(__file__).resolve().parents[2]
URL='https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608_EARTH.IMG'
def main():
    data=urllib.request.urlopen(URL,timeout=30).read()
    if len(data)!=5058*5058*2:raise ValueError('Unexpected original raster size')
    points=json.loads((ROOT/'engine/reports/validation_v091/maps.json').read_text())['points']
    rows=[]
    for p in points:
        row,col=p['pixel'];value=struct.unpack_from('<h',data,2*(row*5058+col))[0]*.00004
        x=(col-2528.5)*60;y=(2528.5-row)*60
        lat=-90+math.degrees(2*math.atan(math.hypot(x,y)/(2*1737400)));lon=math.degrees(math.atan2(x,y))
        rows.append({'index':p['index'],'saved_reference':p['reference_earth'],'original_IMG_reference':value,'difference':value-p['reference_earth'],'latitude_difference_deg':lat-p['lat'],'longitude_difference_deg':((lon-p['lon']+180)%360)-180})
    result={'source':URL,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'checked_points':len(rows),'max_value_difference':max(abs(r['difference']) for r in rows),'max_lat_difference_deg':max(abs(r['latitude_difference_deg']) for r in rows),'max_lon_difference_deg':max(abs(r['longitude_difference_deg']) for r in rows),'rows':rows,'interpretation':'Checks archived raster values and pixel-centre registration only. Does not establish reference simulation epoch, height or frame equivalence.'}
    out=ROOT/'qa/v15/reference_registration.json';out.parent.mkdir(exist_ok=True,parents=True);out.write_text(json.dumps(result,indent=2));print(out)
if __name__=='__main__':main()
