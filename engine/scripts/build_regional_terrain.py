"""Create a continuous, concentric LOLA terrain region around survey sites.

This is an optional visual export. It does not calculate or modify illumination,
SPICE ephemerides, horizons, scores or candidate evidence tiers.

Levels share the exact site-centred tangent plane: 6 km (near), 24 km
(middle), 72 km (distant), each derived from the same georeferenced LOLA DEM.
The frontend masks overlapping inner squares to avoid z-fighting.

Run from project root:
    py scripts/build_regional_terrain.py --sync

Source: NASA/GSFC LOLA https://pgda.gsfc.nasa.gov/products/78
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from scripts.auto_lola import choose_source,ensure_source
from scripts.export_lola_tiles import sample_grid
from scripts.sync_frontend_data import parse_assignment,sync

LEVELS=((6.,129),(24.,193),(72.,145))


def terrain_layer(ds,lat,lon,extent,n):
    y,coverage,base=sample_grid(ds,lat,lon,extent,n)
    if coverage < .90:
        raise ValueError(f'Only {coverage:.1%} coverage of the {extent:g} km level')
    return {'n':n,'extent_km':extent,'heights_km':[None if not np.isfinite(x) else round(float(x),6) for x in y.ravel()],
            'coverage_fraction':round(coverage,5),'base_elevation_m':round(base,2)}


def selected_sites(payload, limit):
    tiles=payload.get('tiles') or []
    # Restrict to locations with an existing exported measured tile. Never
    # invent 'measured' status for a site just because NASA has a nearby COG.
    return tiles[:limit] if limit else tiles


def build_region(tile,source_path,levels=LEVELS):
    import rasterio
    lat,lon=float(tile['lat']),float(tile['lon'])
    result=dict(tile)
    extras=[]
    with rasterio.open(source_path) as ds:
        # Original visual tile is retained verbatim, avoiding a recalculation
        # that might shift source dimensions or break existing renders.
        for extent,n in levels[1:]:
            try:
                level=terrain_layer(ds,lat,lon,extent,n)
                extras.append(level)
                print(f'  {tile["name"]}: LOLA regional level ±{extent:g} km {n}×{n} coverage {level["coverage_fraction"]:.1%}',flush=True)
            except Exception as exc:
                # Missing far-field coverage is not filled with made-up heights.
                print(f'  {tile["name"]}: no ±{extent:g} km regional level ({exc})',flush=True)
                break
        result['regional_levels']=extras
        result['regional_source']=source_path.name
        # Visual geometry is based on the native DEM; additional vertices from
        # interpolation are NOT additional measurement resolution.
        result['native_pixel_size_m']=80 if '80MPP' in source_path.name else 240 if '240MPP' in source_path.name else None
        result['regional_extent_km']=max([float(tile['extent_km'])]+[x['extent_km'] for x in extras])
        result['visual_vertical_exaggeration']=1
    return result


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--limit',type=int,default=0,help='Maximum number of existing measured sites to prepare; 0 = all')
    ap.add_argument('--sync',action='store_true',help='Update frontend/public/data/ after generating regions')
    ap.add_argument('--no-download',action='store_true',help='Require existing cached LOLA DEMs')
    ap.add_argument('--dem',type=Path,default=None,help='Optional verified GeoTIFF for all listed sites')
    args=ap.parse_args(argv)
    from scripts.auto_lola import validate_dem
    if args.dem:validate_dem(args.dem)
    src=ROOT/'web'/'survey_terrain.js'
    payload=parse_assignment(src,'LUNAR_SURVEY_TERRAIN')
    if not isinstance(payload,dict):raise RuntimeError('No terrain payload; run scripts/survey_sites.py with terrain refinement first')
    tiles=selected_sites(payload,args.limit)
    if not tiles:raise RuntimeError('No measured survey terrain tiles. Run survey_sites.py --terrain-top 8 first.')
    completed=[];errors=[]
    for tile in tiles:
        lat,lon=float(tile['lat']),float(tile['lon'])
        try:
            source=choose_source(lat,radius_km=40,tile_extent_km=LEVELS[-1][0]) if not args.dem else None
            if not args.dem and source is None:raise RuntimeError('No full south-polar LOLA coverage at ±72 km')
            path=args.dem or (ROOT/'data'/'dems'/source.filename if args.no_download else ensure_source(source))
            if not path.is_file():raise FileNotFoundError(f'Cached NASA DEM missing: {path}')
            completed.append(build_region(tile,path))
        except Exception as exc:
            errors.append({'name':tile['name'],'error':str(exc)})
            # Maintain the existing measured local tile even when far regions fail.
            completed.append(tile)
            print(f'  {tile["name"]}: local-only (reason: {exc})',flush=True)
    # Do not drop sites beyond --limit; keep their current tiles.
    completed += payload['tiles'][len(tiles):]
    payload['tiles']=completed
    payload['regional_errors']=errors
    payload['regional_kind']='Concentric NASA LOLA regional visual terrain; original scientific horizon preserved'
    src.write_text('window.LUNAR_SURVEY_TERRAIN = '+json.dumps(payload,allow_nan=False,separators=(',',':'))+';\n',encoding='utf-8')
    print('Measured local tiles:',len(payload['tiles']),'with wide regions:',sum(bool(t.get('regional_levels')) for t in payload['tiles']))
    if args.sync:sync()
    return payload

if __name__=='__main__':main()
