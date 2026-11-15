"""Original precision helpers for LUNAR: exact circular segments and measured DEMs.

The disc integral is exact for the supplied piecewise-linear skyline in the
local angular tangent plane. It does not establish the accuracy of that skyline.
Numba accelerates repeated evaluation; the same functions work without it.
"""
from __future__ import annotations
import math
from pathlib import Path
import numpy as np
try:
    from numba import njit
except ImportError:
    def njit(*args, **kwargs):
        def wrap(fn): return fn
        return wrap


@njit(cache=True)
def _circle_integral(x, r):
    x = min(r, max(-r, x))
    return .5*(x*math.sqrt(max(0., r*r-x*x)) + r*r*math.asin(x/r))


@njit(cache=True)
def disc_integral(az, el, radius, heights):
    """Area above a cyclic, uniform-azimuth, linearly interpolated skyline.

    Intersect each skyline line segment with the disc, split at its analytic
    circle intersections, and integrate the visible circular segment. No rays
    or sampled disc points are counted as area.
    """
    n = len(heights)
    step = 360./n
    c = max(.001, abs(math.cos(el*math.pi/180.)))
    r = radius
    first = int(math.floor((az-r/c)/step))
    last = int(math.floor((az+r/c)/step))
    area = 0.
    for k in range(first, last+1):
        j = k % n
        delta = heights[(j+1) % n]-heights[j]
        if not math.isfinite(heights[j]+delta): return math.nan
        m = delta/(step*c)
        b = heights[j] + (az-k*step)*delta/step-el
        left = max(-r, (k*step-az)*c)
        right = min(r, ((k+1)*step-az)*c)
        if right <= left: continue
        cuts = np.empty(4)
        cuts[0] = left
        count = 1
        determinant = (1+m*m)*r*r-b*b
        if determinant > 0:
            root = math.sqrt(determinant)
            for cross in ((-m*b-root)/(1+m*m), (-m*b+root)/(1+m*m)):
                if left < cross < right:
                    cuts[count] = cross
                    count += 1
        cuts[count] = right
        count += 1
        for t in range(count-1):
            a, z = cuts[t], cuts[t+1]
            mid = .5*(a+z)
            half = math.sqrt(max(0., r*r-mid*mid))
            line = m*mid+b
            integral = _circle_integral(z,r)-_circle_integral(a,r)
            if line <= -half: area += 2*integral
            elif line < half: area += integral-.5*m*(z*z-a*a)-b*(z-a)
    return min(1.,max(0.,area/(math.pi*r*r)))


@njit(cache=True)
def disc_series(az, el, radii, heights):
    out = np.empty(len(az))
    for i in range(len(az)):
        out[i] = disc_integral(az[i],el[i],radii[i],heights)
    return out


def adaptive_distances(radius_km=300., minimum_m=20., growth=.002):
    """20 m spacing near the site; increase step by 0.2% of range beyond 10 km."""
    result=[];distance=float(minimum_m)
    while distance<=radius_km*1000:
        result.append(distance/1000.)
        distance+=max(minimum_m,distance*growth)
    if not result or result[-1]<radius_km: result.append(float(radius_km))
    return np.asarray(result)


class RasterWindow:
    """Bilinear native-pixel sampling of one georeferenced raster window.

    Scales and offsets are applied. All four pixels must be valid; unsupported
    samples return NaN so a coarser measured layer may fill them explicitly.
    No overview/downsampled raster is used for numerical analysis.
    """
    def __init__(self,path,lat,lon,extent_km):
        import rasterio
        from rasterio.windows import from_bounds, Window
        from pyproj import CRS,Transformer
        self.path=str(path)
        with rasterio.open(str(path)) as ds:
            if ds.crs is None: raise ValueError('Raster has no CRS')
            self.project=Transformer.from_crs(CRS.from_proj4('+proj=longlat +R=1737400 +no_defs'),ds.crs,always_xy=True)
            x,y=self.project.transform(lon,lat)
            # Projection scale grows away from the pole. Read a conservative
            # square, then fail closed if an actual ray leaves all layers.
            extent=extent_km*1000*1.25+max(ds.res)*3
            w=from_bounds(x-extent,y-extent,x+extent,y+extent,ds.transform)
            w=Window(math.floor(w.col_off),math.floor(w.row_off),math.ceil(w.width)+2,math.ceil(w.height)+2)
            w=w.intersection(Window(0,0,ds.width,ds.height))
            a=ds.read(1,window=w,masked=True).astype(np.float64)
            self.values=np.asarray(a.filled(np.nan))*ds.scales[0]+ds.offsets[0]
            self.inverse=~ds.window_transform(w)
            self.metadata={'path':self.path,'crs':ds.crs.to_wkt(),'pixel_m':list(ds.res),
                           'scale':ds.scales[0],'offset':ds.offsets[0],'interpolation':'bilinear native pixels',
                           'window':[w.col_off,w.row_off,w.width,w.height]}
    def __call__(self,lons,lats):
        from scipy.ndimage import map_coordinates
        x,y=self.project.transform(np.asarray(lons),np.asarray(lats))
        cols=self.inverse.a*x+self.inverse.b*y+self.inverse.c-.5
        rows=self.inverse.d*x+self.inverse.e*y+self.inverse.f-.5
        return map_coordinates(self.values,[rows,cols],order=1,mode='constant',cval=np.nan,prefilter=False)


class TerrainStack:
    """Explicit highest-resolution-first native DEM chain; missing data stays NaN."""
    def __init__(self,layers): self.layers=layers
    def __call__(self,lons,lats):
        out=np.full(np.asarray(lons).shape,np.nan)
        for layer in self.layers:
            missing=~np.isfinite(out)
            if not missing.any(): break
            out[missing]=layer(np.asarray(lons)[missing],np.asarray(lats)[missing])
        return out


def load_local_stack(root,lat,lon,radius_km=300.,download=True,dem=None):
    """The shared measured terrain chain for physics, display and sensitivity."""
    from scripts.auto_lola import choose_source,ensure_source,validate_dem,SOUTH_60
    from rasterio.errors import WindowError
    root=Path(root);layers=[]
    def obtain(source):
        return ensure_source(source,root/'data/dems') if download else validate_dem(root/'data/dems'/source.filename)
    if dem:return TerrainStack([RasterWindow(dem,lat,lon,radius_km)])
    if choose_source(lat,radius_km,6.) is None:raise ValueError('Requested terrain circle is outside supported measured south-polar coverage')
    near=choose_source(lat,min(40.,radius_km),6.)
    if near:layers.append(RasterWindow(obtain(near),lat,lon,min(45.,radius_km)))
    if radius_km>40:layers.append(RasterWindow(obtain(SOUTH_60),lat,lon,radius_km))
    patch=root/'data/dems/LDEM_20M_connecting_ridge_crop.TIF'
    if patch.exists():
        try:
            detailed=RasterWindow(patch,lat,lon,6.)
            if math.isfinite(float(detailed(np.asarray([lon]),np.asarray([lat]))[0])):layers.insert(0,detailed)
        except WindowError:pass
    return TerrainStack(layers)


def direction_series(vectors,lat,lon,elevation_m=0.,height_m=2.):
    """Project (N,3) Moon-centre or site-relative vectors onto a local basis."""
    from .geometry import surface_basis,observer_position
    v=np.asarray(vectors)-observer_position(lat,lon,elevation_m,height_m)
    distance=np.linalg.norm(v,axis=1)
    u,e,n=surface_basis(lat,lon)
    alt=np.degrees(np.arcsin(np.clip(v@u/distance,-1,1)))
    az=np.degrees(np.arctan2(v@e,v@n))%360
    return az,alt,distance


def sampled_metrics(flags,step_hours):
    flags=np.asarray(flags,dtype=bool)
    edges=np.diff(np.r_[True,flags,True].astype(np.int8))
    starts=np.flatnonzero(edges==-1);ends=np.flatnonzero(edges==1)
    longest=int(np.max(ends-starts)) if len(starts) else 0
    return {'available_fraction':float(flags.mean()),'longest_outage_hours':longest*step_hours,
            'endpoint_convention':'left-hand samples, end epoch excluded; outages censored by study bounds'}


def mesh_from_stack(stack,lat,lon,name,height_m=2.):
    """Display grids sampled from the exact same measured DEM chain as physics.

    These finite tangent grids are display LODs, not additional terrain data
    or the authoritative skyline. Coordinates are East, Up, South in km.
    """
    from .geometry import surface_basis,MOON_RADIUS_KM
    up,east,north=surface_basis(lat,lon)
    base=float(stack(np.asarray([lon]),np.asarray([lat]))[0])
    if not math.isfinite(base):raise ValueError('No measured height at visual origin')
    levels=[]
    for extent,n in [(6.,129),(24.,193),(72.,145)]:
        x,z=np.meshgrid(np.linspace(-extent,extent,n),np.linspace(-extent,extent,n))
        p=MOON_RADIUS_KM*up+x[...,None]*east-z[...,None]*north
        unit=p/np.linalg.norm(p,axis=-1)[...,None]
        latitudes=np.degrees(np.arcsin(np.clip(unit[...,2],-1,1)))
        longitudes=np.degrees(np.arctan2(unit[...,1],unit[...,0]))
        elev=stack(longitudes.ravel(),latitudes.ravel()).reshape(n,n)
        y=(MOON_RADIUS_KM+elev/1000)*(unit@up)-(MOON_RADIUS_KM+base/1000)
        coverage=float(np.isfinite(y).mean())
        if coverage<.9:break
        levels.append({'n':n,'extent_km':extent,'heights_km':[float(v) if math.isfinite(v) else None for v in y.ravel()],
                       'coverage_fraction':coverage,'base_elevation_m':base})
    if not levels:raise ValueError('Insufficient measured coverage for display grid')
    # A native-data texture for per-pixel normals and terrain ray shadows.
    # Sampling this more densely is interpolation, not additional measured detail.
    import base64
    n=513;extent=6.
    x,z=np.meshgrid(np.linspace(-extent,extent,n),np.linspace(-extent,extent,n))
    p=MOON_RADIUS_KM*up+x[...,None]*east-z[...,None]*north
    unit=p/np.linalg.norm(p,axis=-1)[...,None]
    latitudes=np.degrees(np.arcsin(np.clip(unit[...,2],-1,1)))
    longitudes=np.degrees(np.arctan2(unit[...,1],unit[...,0]))
    elev=stack(longitudes.ravel(),latitudes.ravel()).reshape(n,n)
    heights=((MOON_RADIUS_KM+elev/1000)*(unit@up)-(MOON_RADIUS_KM+base/1000)).astype('<f4')
    render_texture={'n':n,'extent_km':extent,'heights_f32_b64':base64.b64encode(heights.tobytes()).decode(),
                    'encoding':'little-endian float32 km; NaN=no data','source_pixel_m':stack.layers[0].metadata['pixel_m'][0]}
    return {**levels[0],'name':name,'lat':lat,'lon':lon,'observer_height_m':height_m,'render_texture':render_texture,
            'source':'NASA LOLA: same native DEM chain used by numerical horizon',
            'regional_levels':levels[1:],'regional_extent_km':levels[-1]['extent_km'],
            'native_pixel_size_m':stack.layers[0].metadata['pixel_m'][0],
            'visual_vertical_exaggeration':1,'regional_source':' + '.join(Path(l.path).name for l in stack.layers)}
