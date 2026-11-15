"""High-density *display-only* elevation grids sampled from published NASA LOLA COGs.

This module never rewrites the SPICE/horizon science stack or claims additional
measurements from interpolation. The optional 20 m source uses GDAL HTTP range
requests against the official COG; it does not download the 2.6 GB file in full.
Failures fail closed, with an explicit user-visible error.
"""
from __future__ import annotations

import base64
import math
from pathlib import Path

import numpy as np

from .geometry import MOON_RADIUS_KM, surface_basis
from .precision import RasterWindow, TerrainStack
from scripts.auto_lola import SOUTH_80, SOUTH_60, ensure_source, choose_source

OFFICIAL_20M = 'LDEM_80S_20MPP_ADJ.TIF'
OFFICIAL_20M_URL = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/' + OFFICIAL_20M
# Guard against accidental global-scale extraction: finite regional visual grids only.
GRIDS = ((6., 601), (24., 769), (72., 1025))
GRIDS_ULTRA = ((6., 601), (24., 2049), (72., 1025))  # full 20m source for the middle field


def _load_one(path, lat, lon, radius):
    return RasterWindow(path, lat, lon, radius)


def _stack(root, lat, lon, remote_20m=False):
    root = Path(root)
    demdir = root / 'data' / 'dems'
    if choose_source(lat, 110., 6.) is None:
        raise ValueError('Measured visual tiles are supported only inside NASA south-polar DEM coverage')
    layers = []
    # The full 20 m product is an optional existing local file. For a region
    # around Connecting Ridge, the shipped 20 m crop remains valid in its footprint.
    full20 = demdir / OFFICIAL_20M
    if full20.is_file():
        layers.append(_load_one(full20, lat, lon, 38.))
    elif remote_20m:
        from rasterio.env import Env
        # The VRT/vsicurl backend is configured in an explicit context during
        # construction. RasterWindow reads only a bounded raster window.
        path = '/vsicurl/' + OFFICIAL_20M_URL
        try:
            with Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.TIF',
                     GDAL_HTTP_MAX_RETRY='1', GDAL_HTTP_TIMEOUT='25', GDAL_HTTP_CONNECTTIMEOUT='15'):
                layers.append(_load_one(path, lat, lon, 38.))
        except Exception as e:
            raise RuntimeError('NASA 20 m COG range access failed. Check network/HTTP range support; '
                               'or place LDEM_80S_20MPP_ADJ.TIF in data/dems. ' + str(e)[:180]) from e
    crop = demdir / 'LDEM_20M_connecting_ridge_crop.TIF'
    if crop.is_file():
        try:
            detail = _load_one(crop, lat, lon, 6.)
            if np.isfinite(detail(np.asarray([lon]), np.asarray([lat]))[0]):
                # The local crop is used only for pixels actually covered.
                layers.insert(0, detail)
        except Exception:
            # A crop that does not intersect a different site is expected.
            pass
    # 80m source is widely available and is the standard regional level.
    # It is the *actual* source of new detail outside the short 20m crop.
    if choose_source(lat, 110., 6.) == SOUTH_80:
        coarse = ensure_source(SOUTH_80, demdir)
    else:
        coarse = ensure_source(SOUTH_60, demdir)
    layers.append(_load_one(coarse, lat, lon, 115.))
    return TerrainStack(layers), [Path(a.path).name for a in layers]


def _height_grid(stack, lat, lon, extent, n, base):
    up, east, north = surface_basis(lat, lon)
    # Sample in rows rather than a single enormous allocation of 1M xyz points.
    heights = np.empty((n, n), dtype='<f4')
    xs = np.linspace(-extent, extent, n, dtype=np.float64)
    for r, z in enumerate(np.linspace(-extent, extent, n, dtype=np.float64)):
        xyz = MOON_RADIUS_KM * up[None, :] + xs[:, None] * east[None, :] - z * north[None, :]
        unit = xyz / np.linalg.norm(xyz, axis=1)[:, None]
        la = np.degrees(np.arcsin(np.clip(unit[:, 2], -1, 1)))
        lo = np.degrees(np.arctan2(unit[:, 1], unit[:, 0]))
        elev = stack(lo, la)
        h = (MOON_RADIUS_KM + elev / 1000) * (unit @ up) - (MOON_RADIUS_KM + base / 1000)
        heights[r, :] = h.astype('<f4')
    return heights


def export_visual_tiles(root, lat, lon, remote_20m=False):
    if not math.isfinite(lat) or not -90 <= lat <= -79 or not math.isfinite(lon):
        raise ValueError('Requested site is outside bounded south-polar visual coverage')
    stack, names = _stack(root, lat, lon, remote_20m=remote_20m)
    base = float(stack(np.asarray([lon]), np.asarray([lat]))[0])
    if not math.isfinite(base):
        raise ValueError('No measured LOLA elevation at the selected observation point')
    output = []
    # Opt-in fine regional grid: the middle field is only about 23 m per
    # visual texel when an actual 20 m COG is available. Outer field remains
    # bounded and coarser; the UI names both sources explicitly.
    grids = GRIDS_ULTRA if remote_20m and any(OFFICIAL_20M in src for src in names) else GRIDS
    for extent, n in grids:
        grid = _height_grid(stack, lat, lon, extent, n, base)
        coverage = float(np.isfinite(grid).mean())
        if coverage < .995:
            raise ValueError(f'LOLA coverage incomplete for ±{extent:g} km visual grid: {coverage:.1%}; keeping previous tiles')
        output.append({'n': n, 'extent_km': extent,
                       'heights_f32_b64': base64.b64encode(grid.tobytes()).decode('ascii'),
                       'sample_spacing_m': round(extent * 2000/(n-1), 3),
                       'coverage_fraction': coverage,
                       'encoding': 'little-endian float32 km, NaN = missing'})
    # The grid spacing is *not* necessarily the native source pixel size.
    return {'lat': lat, 'lon': lon, 'visual_levels': output, 'visual_lod_version': 2,
            'terrain_sources': names, 'primary_source_pixel_m':
                 float(stack.layers[0].metadata['pixel_m'][0]),
            'note': ('Display LOD: measured NASA LOLA heights, sampled onto a view grid. '
                     'Native source pixel size and display-grid spacing differ. '
                     'Scientific horizons, site scoring, study heights and outputs unchanged.')}
