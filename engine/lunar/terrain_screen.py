"""Reproducible, DEM-resolution-aware *macroscale* landing-footprint screen.

NOT a lander hazard map: a LOLA DEM cannot resolve rocks, small craters,
regolith bearing strength, or HLS-specific descent constraints. Screening
thresholds are user inputs, not NASA requirements. Never assign a safe label.
"""
from __future__ import annotations
import math
from pathlib import Path
import numpy as np
from .geometry import surface_basis, MOON_RADIUS_KM


def screen_sampled_footprint(sampler, lat, lon, radius_m=100., *,
                             native_pixel_m=None, max_slope_deg=10.,
                             max_roughness_m=2., min_coverage=.995):
    """Compute plane trend + cell-gradient descriptors on a sampled DEM.

    Resolutions and footprints are in metres. Surface positions are generated
    on the local spherical tangent using east and north basis vectors; no
    planar longitude approximation near the pole. NaNs are retained as gaps.
    """
    vals=(lat,lon,radius_m,max_slope_deg,max_roughness_m,min_coverage)
    if not all(math.isfinite(float(v)) for v in vals):
        raise ValueError('Terrain screening parameters must be finite')
    if not -90 <= lat <= 90 or not 0 <= radius_m <= 1000 or radius_m < 10:
        raise ValueError('Latitude must be -90..90; radius 10..1000 m')
    if max_slope_deg < 0 or max_slope_deg > 90 or max_roughness_m < 0:
        raise ValueError('Slope limit must be 0..90 degrees and roughness limit nonnegative')
    if not .5 <= min_coverage <= 1:
        raise ValueError('Minimum measured coverage must be 0.5..1')
    if native_pixel_m is not None and (not math.isfinite(float(native_pixel_m)) or native_pixel_m <= 0):
        raise ValueError('Native pixel spacing must be positive')
    # A coarser DEM is sampled on *its own* spacing, not oversampled and
    # represented as a higher resolution physical measurement.
    grid_m=(float(native_pixel_m) if native_pixel_m is not None else max(5.,radius_m/10))
    grid_m=max(grid_m,1.)
    count=int(math.ceil(radius_m/grid_m))
    count=max(1,min(count,250))
    # Uniform spacing never finer than the native DEM pixel dimension.
    xy=np.arange(-count,count+1,dtype=float)*grid_m
    spacing=float(grid_m);east_m,north_m=np.meshgrid(xy,xy)
    mask=east_m*east_m+north_m*north_m <= radius_m*radius_m+1e-6
    up,east,north=surface_basis(lat,lon)
    vectors=(MOON_RADIUS_KM*1000)*up+east_m[...,None]*east+north_m[...,None]*north
    normals=vectors/np.linalg.norm(vectors,axis=-1)[...,None]
    latitudes=np.degrees(np.arcsin(np.clip(normals[...,2],-1,1)))
    longitudes=np.degrees(np.arctan2(normals[...,1],normals[...,0]))%360
    heights=np.asarray(sampler(longitudes.ravel(),latitudes.ravel()),dtype=float).reshape(mask.shape)
    valid=mask & np.isfinite(heights)
    total=int(mask.sum());good=int(valid.sum());coverage=good/total
    native_n=float(native_pixel_m) if native_pixel_m is not None else None
    independent_diameter=2*radius_m/native_n if native_n is not None else None
    # Need enough *native* pixels to make local gradients and a plane fit
    # meaningful; interpolation does not make an unresolved DEM resolved.
    resolved=native_n is not None and independent_diameter>=6 and good>=9 and count>=3
    metrics={'plane_slope_deg':None,'slope_p95_deg':None,'slope_max_deg':None,
             'plane_residual_rms_m':None,'elevation_range_m':None}
    if good >= 3:
        design=np.column_stack((east_m[valid],north_m[valid],np.ones(good)))
        coeff=np.linalg.lstsq(design,heights[valid],rcond=None)[0]
        residual=heights[valid]-design@coeff
        metrics['plane_slope_deg']=float(np.degrees(np.arctan(np.hypot(coeff[0],coeff[1]))))
        metrics['plane_residual_rms_m']=float(np.sqrt(np.mean(residual*residual)))
        metrics['elevation_range_m']=float(np.ptp(heights[valid]))
        dx=(heights[1:-1,2:]-heights[1:-1,:-2])/(2*spacing)
        dy=(heights[2:,1:-1]-heights[:-2,1:-1])/(2*spacing)
        interior=mask[1:-1,1:-1] & np.isfinite(dx) & np.isfinite(dy)
        slopes=np.degrees(np.arctan(np.hypot(dx[interior],dy[interior])))
        if len(slopes):
            metrics['slope_p95_deg']=float(np.quantile(slopes,.95))
            metrics['slope_max_deg']=float(np.max(slopes))
    if coverage<min_coverage:
        status='INCOMPLETE_DATA'
    elif not resolved or any(metrics[k] is None for k in ('plane_slope_deg','plane_residual_rms_m','slope_p95_deg')):
        status='INSUFFICIENT_RESOLUTION'
    elif (metrics['plane_slope_deg']>max_slope_deg or metrics['slope_p95_deg']>max_slope_deg
          or metrics['plane_residual_rms_m']>max_roughness_m):
        status='FAILS_SCREEN'
    else:
        status='MEETS_MACROSCALE_SCREEN'
    return {'status':status,'site':{'lat':float(lat),'lon':float(lon)%360},
            'settings':{'radius_m':radius_m,'max_plane_or_p95_slope_deg':max_slope_deg,
                        'max_plane_residual_rms_m':max_roughness_m,'min_coverage':min_coverage},
            'metrics':metrics,'coverage_fraction':coverage,'valid_samples':good,'total_samples':total,
            'native_pixel_m':native_n,'native_pixels_across_diameter':independent_diameter,
            'sample_grid_spacing_m':spacing,'grid_shape':[len(xy),len(xy)],
            'model':'DEM macroscale plane slope, p95 local central-difference slope and RMS plane residual',
            'limitations':['Not a landing-safety assessment; does not resolve subpixel boulders, hazards, soil mechanics or descent constraints.',
                           'Thresholds are selected by the user, not published NASA lander specifications.',
                           'Deterministic measured raster sampling; DEM accuracy, vertical offsets and registration uncertainty not statistically propagated.',
                           'Spherical-local points generated exactly; sampled raster interpolation does not add measurement resolution.']}


def screen_location(root, lat, lon, radius_m=100., max_slope_deg=10., max_roughness_m=2.):
    from .precision import load_local_stack
    from .mission_analysis import Request
    Request(lat=lat,lon=lon).validate()
    if not 10<=radius_m<=1000: raise ValueError('Radius 10..1000 m required')
    stack=load_local_stack(Path(root),lat,lon,max(3.,radius_m/1000+2.))
    sources=[]
    for layer in stack.layers:
        m=layer.metadata
        sources.append({'filename':Path(m['path']).name,'native_pixel_m':float(max(m['pixel_m'])),
                        'projection':m['crs'],'sampling':m['interpolation']})
    class SourceTrackedSampler:
        def __init__(self,layers):
            self.layers=layers
            self.used={}
        def __call__(self,lons,lats):
            lons=np.asarray(lons,dtype=float)
            lats=np.asarray(lats,dtype=float)
            output=np.full(lons.shape,np.nan,dtype=float)
            self.used={}
            for layer in self.layers:
                missing=~np.isfinite(output)
                if not missing.any():break
                samples=np.asarray(layer(lons[missing],lats[missing]),dtype=float)
                chosen=np.isfinite(samples)
                if chosen.any():
                    output[np.flatnonzero(missing)[chosen]]=samples[chosen]
                    key=Path(layer.metadata['path']).name
                    self.used[key]=self.used.get(key,0)+int(chosen.sum())
            return output
    tracked=SourceTrackedSampler(stack.layers)
    center_lat=np.array([lat]);center_lon=np.array([lon]);center_native=None
    for layer in stack.layers:
        if np.isfinite(layer(center_lon,center_lat)[0]):
            center_native=float(max(layer.metadata['pixel_m']));break
    if center_native is None:raise ValueError('No measured elevation at selected site')
    result=screen_sampled_footprint(tracked,lat,lon,radius_m,
                                    native_pixel_m=center_native,max_slope_deg=max_slope_deg,
                                    max_roughness_m=max_roughness_m)
    assigned={s['filename']:s['native_pixel_m'] for s in sources}
    worst=max((assigned[name] for name in tracked.used),default=center_native)
    if worst>center_native:
        result=screen_sampled_footprint(tracked,lat,lon,radius_m,
                                        native_pixel_m=worst,max_slope_deg=max_slope_deg,
                                        max_roughness_m=max_roughness_m)
    result['sources']=sources
    result['source_sample_counts']=tracked.used
    result['provenance_note']='Conservative largest native pixel spacing among DEM layers actually used at sampled points; boundary registration and DEM uncertainties remain unassessed.'
    return result
