"""Moon-fixed surface vectors and SPICE body geometry, units km/degrees.

The lunar mean-Earth frame is used instead of IAU_MOON, for consistency with
LOLA south-pole DEMs. Coordinates are east-positive planetocentric.
"""
from __future__ import annotations
import math
from pathlib import Path
import numpy as np

MOON_RADIUS_KM = 1737.4  # Reference sphere; not a claim of local surface elevation
RAD = math.pi / 180.


def surface_basis(lat_deg: float, lon_deg: float):
    """Return unit vectors (up, east, north) in a lunar body-fixed frame."""
    phi, lam = lat_deg * RAD, lon_deg * RAD
    up = np.array([math.cos(phi)*math.cos(lam),
                   math.cos(phi)*math.sin(lam), math.sin(phi)])
    east = np.array([-math.sin(lam), math.cos(lam), 0.])
    north = np.array([-math.sin(phi)*math.cos(lam),
                      -math.sin(phi)*math.sin(lam), math.cos(phi)])
    return up, east, north


def alt_az_from_vectors(body_km, observer_km, lat_deg, lon_deg):
    """Topocentric elevation and azimuth (degrees, az CW from north)."""
    up, east, north = surface_basis(lat_deg, lon_deg)
    vec = np.asarray(body_km, dtype=float)-np.asarray(observer_km, dtype=float)
    n = np.linalg.norm(vec)
    if n <= 0: raise ValueError('Body and observer must be separated')
    d = vec / n
    alt = math.degrees(math.asin(float(np.clip(d@up, -1., 1.))))
    az = math.degrees(math.atan2(float(d@east), float(d@north)))%360
    return alt, az, n


def observer_position(lat, lon, elevation_m=0., instrument_height_m=2.):
    up, _, _ = surface_basis(lat, lon)
    return (MOON_RADIUS_KM + (elevation_m + instrument_height_m)/1000.)*up


def angular_radius_deg(radius_km, distance_km):
    if distance_km <= radius_km: raise ValueError('Body distance must exceed its radius')
    return math.degrees(math.asin(radius_km / distance_km))


KERNELS = (
    'naif0012.tls', 'pck00011.tpc', 'de440s.bsp',
    'moon_pa_de440_200625.bpc', 'moon_de440_250416.tf'
)


def load_spice(kernels_dir):
    try:
        import spiceypy as spice
    except ImportError as exc:
        raise RuntimeError('Install dependencies: python -m pip install -r requirements.txt') from exc
    kernels_dir=Path(kernels_dir)
    missing=[n for n in KERNELS if not (kernels_dir/n).is_file()]
    if missing:
        raise FileNotFoundError('Missing kernels: '+', '.join(missing)+'. Run python scripts/download_kernels.py')
    spice.kclear()
    for name in KERNELS:
        spice.furnsh(str(kernels_dir/name))
    # Fail early if kernel frame definitions are not correct
    spice.pxform('J2000','MOON_ME',spice.str2et('2026-11-14T00:00:00'))
    return spice


def body_topocentric(spice, utc, lat, lon, elevation_m=0, instrument_height_m=2):
    et=spice.str2et(utc)
    observer=observer_position(lat,lon,elevation_m,instrument_height_m)
    result={}
    for name, radius in [('SUN',695700.),('EARTH',6371.)]:
        # Apply reception corrections at the actual surface observer. The
        # returned vector is already site-relative; do not subtract twice.
        state,_=spice.spkcpo(name,et,'MOON_ME','OBSERVER','LT+S',observer,'MOON','MOON_ME')
        elev,az,dist=alt_az_from_vectors(state[:3],np.zeros(3),lat,lon)
        result[name.lower()]={'alt_deg':elev,'az_deg':az,
                              'distance_km':dist,
                              'radius_deg':angular_radius_deg(radius,dist)}
    return result
