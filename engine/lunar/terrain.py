"""Terrain skyline sampling with lunar curvature and raster elevations.

Real DEM requires downloaded NASA LOLA GeoTIFF in moon-centered south-pole
stereographic coordinates, with MOON_ME-aligned elevations relative to the
1737.4 km reference sphere. This code does not interpolate unsupported gaps.
"""
from __future__ import annotations
import math
from dataclasses import dataclass
import numpy as np
from .geometry import surface_basis, observer_position, MOON_RADIUS_KM

@dataclass
class Horizon:
    az_deg: list[float]
    alt_deg: list[float]
    coverage_fraction: float
    source: str
    radius_km: float
    distance_km: list[float] | None = None


def smooth_horizon(observer_height_m=2.0):
    """An airless spherical horizon: negative dip when observer elevated."""
    h=max(0., observer_height_m)/1000.
    dip=-math.degrees(math.acos(MOON_RADIUS_KM/(MOON_RADIUS_KM+h))) if h else 0.
    return Horizon(list(np.arange(0,360,5,dtype=float)),[dip]*72,1.,
                   'SMOOTH SPHERE ONLY — local terrain excluded',0.)


def compute_horizon(lat,lon,elevation_fn,site_elevation_m=0.,
                    observer_height_m=2., radius_km=35.,step_m=200.,
                    az_step_deg=5.,distances_km=None):
    """Compute maximum vertical angle of sampled terrain from observer.

    elevation_fn(lons_deg, lats_deg) -> 1D elevations m (NaN if missing).
    d is lunar great-circle arc distance on reference sphere.
    The horizon is only as complete as the DEM and search radius; the full
    azimuth coverage fraction is reported but not a global horizon guarantee.
    """
    if radius_km<=0 or step_m<=0 or az_step_deg<=0: raise ValueError('Positive sampling scales required')
    up,east,north=surface_basis(lat,lon)
    observer=observer_position(lat,lon,site_elevation_m,observer_height_m)
    azs=np.arange(0,360.,az_step_deg)
    dist=(np.arange(step_m/1000., radius_km+1e-9, step_m/1000.)
          if distances_km is None else np.asarray(distances_km,dtype=float))
    if not len(dist) or np.any(dist<=0) or np.any(np.diff(dist)<=0) or dist[-1]>radius_km+1e-8:
        raise ValueError('Terrain distances must increase from >0 to the horizon radius')
    alpha=dist/MOON_RADIUS_KM
    res=[]; distances=[]; valid_counts=0; total_counts=0
    for az in azs:
        a=math.radians(float(az))
        tangent=np.cos(a)*north+np.sin(a)*east
        points=np.cos(alpha)[:,None]*up+np.sin(alpha)[:,None]*tangent
        lat_points=np.rad2deg(np.arcsin(np.clip(points[:,2],-1.,1.)))
        lon_points=np.rad2deg(np.arctan2(points[:,1],points[:,0]))
        z=np.asarray(elevation_fn(lon_points,lat_points),dtype=float)
        if z.shape!=dist.shape: raise ValueError('Elevation callback shape incorrect')
        finite=np.isfinite(z)
        valid_counts+=int(finite.sum());total_counts+=len(z)
        if not finite.any():
            res.append(float('nan'));distances.append(float('nan'));continue
        q=(MOON_RADIUS_KM + z[finite]/1000.)[:,None]*points[finite]
        delta=q-observer
        vertical=delta@up
        horizontal=np.linalg.norm(delta-vertical[:,None]*up,axis=1)
        angles=np.rad2deg(np.arctan2(vertical,horizontal))
        peak=int(np.argmax(angles));res.append(float(angles[peak]));distances.append(float(dist[finite][peak]))
    return Horizon([float(a) for a in azs],res,valid_counts/max(1,total_counts),
                   'TERRAIN DEM — finite radius; verify coverage',float(radius_km),distances)


def load_dem_sampler(path):
    """Return context-managed raster sampler with planetocentric lon/lat input."""
    import rasterio
    from pyproj import CRS,Transformer
    class Sampler:
        def __enter__(self):
            self.ds=rasterio.open(str(path))
            if self.ds.crs is None:
                raise ValueError('GeoTIFF has no CRS; cannot assume projection')
            lunar_geographic=CRS.from_proj4('+proj=longlat +R=1737400 +no_defs')
            self.project=Transformer.from_crs(lunar_geographic,self.ds.crs,always_xy=True)
            return self
        def __exit__(self,exc_type,exc,tb):
            self.ds.close()
        def __call__(self,lons,lats):
            xs,ys=self.project.transform(np.asarray(lons),np.asarray(lats))
            sampled=list(self.ds.sample(list(zip(xs,ys)),masked=True))
            z=np.array([np.nan if np.ma.is_masked(v[0]) else float(v[0]) for v in sampled])
            z[~np.isfinite(z)]=np.nan
            return z
    return Sampler()
