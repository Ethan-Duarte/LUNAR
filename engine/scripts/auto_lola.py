"""Select, download, cache and validate documented NASA GSFC LOLA south-pole DEMs.

These are measured elevation models (not imagery), in lunar polar stereographic
projection. Only coordinates within conservatively buffered coverage are eligible.
Out-of-region sites remain geometric-only; the program never invents a DEM.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import math
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PGDA_ROOT = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/'

@dataclass(frozen=True)
class LolaSource:
    filename: str
    boundary_lat: float
    pixel_size_m: int
    approx_mb: int

SOUTH_80 = LolaSource('LDEM_80S_80MPP_ADJ.TIF', -80., 80, 181)
SOUTH_60 = LolaSource('LDEM_60S_240MPP_ADJ.TIF', -60., 240, 210)


def choose_source(lat: float, radius_km: float = 40., tile_extent_km: float = 6.) -> LolaSource | None:
    """Choose finest of two supported COGs with a conservative coverage buffer.

    0.3 degree margin absorbs sample spacing/projection and avoids promising a
    complete 40-km horizon on the outermost edge of a polar DEM.
    """
    margin_deg = max(radius_km, math.sqrt(2)*tile_extent_km)/1737.4*180/math.pi + .3
    if -90 <= lat <= SOUTH_80.boundary_lat-margin_deg:
        return SOUTH_80
    if -90 <= lat <= SOUTH_60.boundary_lat-margin_deg:
        return SOUTH_60
    return None


def validate_dem(path: Path):
    """Fail closed on placeholder/HTML files, missing projection or invalid bands."""
    import rasterio
    with rasterio.open(path) as ds:
        if ds.crs is None or ds.width < 100 or ds.height < 100 or ds.count < 1:
            raise ValueError(f'Not a usable georeferenced LOLA DEM: {path}')
        if ds.dtypes[0] not in ('float32','float64','int16','int32','uint16','uint32'):
            raise ValueError(f'Unexpected DEM pixel type: {ds.dtypes[0]}')
    return path


def ensure_source(source: LolaSource, destination_dir: Path | None = None) -> Path:
    """Reuse validated DEM or download a complete source COG exactly once.

    No partial file is treated as a successful download. A network failure is
    reported to caller; never silently switch to synthetic or geometric data.
    """
    directory=Path(destination_dir or ROOT/'data'/'dems')
    directory.mkdir(parents=True, exist_ok=True)
    target=directory/source.filename
    if target.is_file():
        try:
            return validate_dem(target)
        except Exception as exc:
            raise RuntimeError(f'Cached DEM exists but is invalid: {target}. {exc}') from exc
    url=PGDA_ROOT+source.filename
    partial=target.with_suffix('.TIF.part')
    print(f'NASA LOLA: downloading {source.filename} (~{source.approx_mb} MB) once from {url}',flush=True)
    try:
        request=urllib.request.Request(url,headers={'User-Agent':'LUNAR educational research prototype; NASA/GSFC public data'})
        with urllib.request.urlopen(request,timeout=90) as response, partial.open('wb') as out:
            expected=int(response.headers.get('Content-Length') or 0)
            total=0; next_log=25_000_000
            while True:
                chunk=response.read(2*1024*1024)
                if not chunk: break
                out.write(chunk)
                total+=len(chunk)
                if total>=next_log:
                    print(f'  {total/1e6:.0f} MB received',flush=True)
                    next_log+=25_000_000
            if total<1_000_000 or (expected and total!=expected):
                raise RuntimeError(f'Incomplete DEM download: {total} bytes; expected {expected or "a valid GeoTIFF"}')
        validate_dem(partial)
        partial.replace(target)
        print('LOLA cached:',target,flush=True)
        return target
    except Exception:
        partial.unlink(missing_ok=True)
        raise
