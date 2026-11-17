"""Build browser polar rasters directly from NASA GeoTIFFs.

No competitor raster or pipeline is an input. The output layout is the existing
LUNAR browser contract. Run from any directory with numpy/rasterio/Pillow.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling

ROOT = Path(__file__).resolve().parents[1]
NASA = 'https://pgda.gsfc.nasa.gov/data/'
URLS = {
    'elevation': NASA + 'LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF',
    'sun_avg': NASA + 'MoonIllumination/AVGVISIB_75S_120M_201608.TIF',
    'earth_avg': NASA + 'MoonIllumination/AVGVISIB_75S_120M_201608_EARTH.TIF',
    'psr': NASA + 'MoonIllumination/LPSR_75S_120M_201608.TIF',
}


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def acquire(item):
    key, url = item
    cache = ROOT / 'engine/data/direct_sources' / url.rsplit('/', 1)[1]
    cache.parent.mkdir(parents=True, exist_ok=True)
    if not cache.exists():
        temporary = cache.with_suffix('.part')
        with urlopen(url + '?lunar_polar_rebuild=1', timeout=60) as response:
            if response.status != 200:
                raise ValueError('Expected complete source download: ' + url)
            expected = response.headers.get('Content-Length')
            with temporary.open('wb') as target:
                while block := response.read(2**20):
                    target.write(block)
        if expected and temporary.stat().st_size != int(expected):
            raise ValueError('Incomplete source: ' + url)
        with rasterio.open(temporary) as source:
            if source.crs is None:
                raise ValueError('Source raster has no coordinate system')
        temporary.replace(cache)
    print('SOURCE', key, cache.stat().st_size, flush=True)
    return key, cache


def remap(values, source, size, half_width, method):
    output = np.full((size, size), np.nan, dtype=np.float32)
    reproject(values, output, src_transform=source.transform,
              src_crs=source.crs, src_nodata=np.nan,
              dst_transform=from_bounds(-half_width, -half_width, half_width,
                                        half_width, size, size),
              dst_crs=source.crs, dst_nodata=np.nan, resampling=method)
    return output


def height_codes(values):
    finite = np.isfinite(values)
    codes = np.zeros(values.shape, dtype=np.uint16)
    quantized = np.rint((values[finite] + 10000) * 2)
    if np.any((quantized < 1) | (quantized > 65535)):
        raise ValueError('Elevation is outside browser encoding range')
    codes[finite] = quantized.astype(np.uint16)
    return np.stack((codes >> 8, codes & 255, np.zeros_like(codes)), axis=-1).astype('uint8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'frontend/public/data')
    args = parser.parse_args()
    output = args.output
    for folder in ['terrain', 'layers']:
        (output / folder).mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        sources = dict(pool.map(acquire, URLS.items()))
    products = []

    def save(relative, values, **details):
        path = output / relative
        Image.fromarray(values).save(path)
        products.append(dict(file=relative, sha256=sha(path), **details))

    with rasterio.open(sources['elevation']) as source:
        elevation = source.read(1, masked=True).astype('float32').filled(np.nan)
        # Map coordinates are stretched away from a stereographic pole. Divide
        # coordinate distances by k to obtain physical surface distances.
        yy, xx = np.indices(elevation.shape, dtype='float32')
        xx = source.transform.c + (xx + .5) * source.transform.a
        yy = source.transform.f + (yy + .5) * source.transform.e
        k = 1 + (xx * xx + yy * yy) / (4 * 1737400.0**2)
        dy, dx = np.gradient(elevation, abs(source.transform.e), source.transform.a)
        slopes = np.degrees(np.arctan(np.hypot(dx, dy) * k))
        levels = []
        for level, size, half in [(0, 2048, 304000), (1, 4096, 163840)]:
            spacing = 2 * half / size
            heights = remap(elevation, source, size, half, Resampling.average)
            slope = remap(slopes, source, size, half, Resampling.average)
            save(f'terrain/sp_dem_L{level}.png', height_codes(heights),
                 max_quantization_error_m=float(np.nanmax(abs(
                     np.rint((heights + 10000) * 2) / 2 - 10000 - heights))))
            slope_code = np.where(np.isfinite(slope), np.clip(np.rint(slope * 4), 0, 255), 255).astype('uint8')
            save(f'terrain/sp_slope_L{level}.png', slope_code)
            levels.append(dict(file=f'sp_dem_L{level}.png', size=size,
                               x_min_m=-half, x_max_m=half, y_min_m=-half,
                               y_max_m=half, pixel_m=spacing))
        terrain = dict(radius_m=1737400, projection='south polar stereographic',
                       levels=levels, height_encoding=dict(scale_m=.5, offset_m=-10000,
                       nodata_rgb=[0, 0, 0], pixel_registration='pixel centres; north row first'),
                       slope_encoding=dict(formula='degrees = code / 4', clamp_deg=63.75,
                       method='central differences of native 80 m elevation, stereographic scale correction, then area average'),
                       source=dict(url=URLS['elevation'], sha256=sha(sources['elevation']),
                                   crs_wkt=source.crs.to_wkt()),
                       generator='tools/prepare_polar_products.py')
        (output / 'terrain/sp_meta.json').write_text(json.dumps(terrain, indent=2) + '\n')

    layers = []
    for name in ['sun_avg', 'earth_avg', 'psr']:
        with rasterio.open(sources[name]) as source:
            raw = source.read(1, masked=True).astype('float32').filled(np.nan)
            scale, offset = ((2.5e-5, .5) if name == 'psr' else (4e-5, 0))
            fractions = remap(raw * scale + offset, source, 2048, 304000, Resampling.average)
            if name == 'psr':
                if not np.isfinite(fractions).all():
                    raise ValueError('PSR source does not cover the target map')
                encoded = (fractions >= .5).astype('uint8') * 255
            else:
                encoded = np.where(np.isfinite(fractions), np.clip(np.rint(fractions * 250), 0, 250), 255).astype('uint8')
            save(f'layers/{name}.png', encoded)
            layers.append(dict(id=name, file=name+'.png', size=2048, pixel_m=593.75/2,
                extent=dict(x_min_m=-304000, x_max_m=304000, y_min_m=-304000, y_max_m=304000),
                source=dict(url=URLS[name], sha256=sha(sources[name]), raw_scale=scale, raw_offset=offset),
                encoding=({'values': {'0': 'not PSR', '255': 'PSR'}} if name == 'psr' else {'formula': 'fraction = value / 250', 'nodata': 255}),
                meaning=('Majority-area permanent-shadow mask' if name == 'psr' else 'NASA long-term average visibility, not current mission visibility'),
                resampling='area average; majority threshold at 0.5 for PSR'))
    (output / 'layers/layers.json').write_text(json.dumps(dict(radius_m=1737400,
        projection='south polar stereographic', layers=layers,
        generator='tools/prepare_polar_products.py', source_documentation='https://pgda.gsfc.nasa.gov/products/69'), indent=2)+'\n')
    report = dict(generator='tools/prepare_polar_products.py',
        sources=[dict(url=URLS[k], sha256=sha(v), bytes=v.stat().st_size) for k,v in sources.items()],
        products=products, caveat='Regenerated products require scientific regression checks; no new accuracy claim.')
    report_path = ROOT / 'qa/v110/polar_build.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2)+'\n')
    print('WROTE', report_path, flush=True)


if __name__ == '__main__':
    main()
