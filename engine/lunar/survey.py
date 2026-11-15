"""Fast, *terrain-free* global site screening for lunar mission-analysis exercises.

Every result here ignores hills, crater rims, boulders, surface slope, and
communications link availability. Use only to downselect candidates for
independent high-resolution LOLA/SPICE analysis; never label as safe landings.

Coordinates are lunar planetocentric latitude and east-positive longitude.
"""
from __future__ import annotations
from dataclasses import dataclass
import math
import numpy as np

MOON_KM = 1737.4
AU_KM = 149597870.7
SUN_RADIUS_KM = 695700.0
EARTH_RADIUS_KM = 6371.0

@dataclass(frozen=True)
class Point:
    name: str
    lat: float
    lon: float
    source: str = 'Global survey grid'

# These are broad SCIENCE REFERENCE REGIONS, not geodetically verified landing
# sites. NASA community-based landed science priorities, 2018:
# https://www.nasa.gov/wp-content/uploads/2016/05/noble_landed_science_sc_aug_2018tagged_0.pdf
SCIENCE_REGIONS = (
    Point('Shackleton crater region', -89.9, 0., 'NASA landed science: polar region'),
    Point('Aristarchus Plateau region', 25., -50., 'NASA landed science'),
    Point('Compton-Belkovich volcanic region', 61.1, 99.5, 'NASA landed science'),
    Point('Gruithuisen Domes region', 36.6, -40.5, 'NASA landed science'),
    Point('Reiner Gamma region', 7.5, -59., 'NASA landed science'),
    Point('Marius Hills region', 13., -53., 'NASA landed science'),
    Point('Orientale Basin region', -20., -95., 'NASA landed science'),
    Point('Schrodinger Basin region', -75., -135., 'NASA landed science'),
    Point('South Pole-Aitken region', -53., -170., 'NASA landed science'),
)


def fibonacci_locations(n: int, region: str = 'global') -> list[Point]:
    """Near-uniform-area global samples, optionally clipped to polar regions.

    For south/north, oversample a global sequence to get n points in the target
    region, rather than calling a polar lat/lon grid area-uniform.
    """
    if n < 1 or n > 100_000:raise ValueError('n must lie between 1 and 100000')
    if region not in ('global','south','north'):raise ValueError('Unknown region')
    if region=='global':count=n
    else:count=n*30  # roughly 1/27 sphere is within 22 degrees of a pole
    i=np.arange(count,dtype=np.float64)
    z=1-2*(i+0.5)/count
    lat=np.rad2deg(np.arcsin(z))
    golden=math.pi*(3-math.sqrt(5))
    lon=((np.rad2deg(i*golden)+180)%360)-180
    mask=np.ones(count,dtype=bool)
    if region=='south':mask=lat<=-68
    if region=='north':mask=lat>=68
    indices=np.flatnonzero(mask)
    if indices.size>n:indices=indices[np.linspace(0,indices.size-1,n,dtype=int)]
    return [Point(f'Survey {j:04}',round(float(lat[k]),5),round(float(lon[k]),5))
            for j,k in enumerate(indices)]


def polar_cap_locations(n: int, pole: str = 'south', radius_km: float = 160.) -> list[Point]:
    """Near-uniform-area sites in a true spherical polar cap of given radius.

    Unlike 'region=south', which spans to 68°S, the cap is mission-focused.
    Radius is a great-circle surface distance from the Moon's pole.
    This is a geometric survey sampling scheme, not a landing-safety mask.
    """
    if n < 1 or n > 100_000:raise ValueError('n must lie between 1 and 100000')
    if pole not in ('south','north'):raise ValueError('Unknown pole')
    if not 0 < radius_km < MOON_KM*math.pi/2:raise ValueError('Invalid polar cap radius')
    cmax=math.cos(radius_km/MOON_KM)
    i=np.arange(n,dtype=np.float64)
    u=(i+.5)/n
    theta=np.arccos(1-u*(1-cmax))
    lat=(-90+np.rad2deg(theta)) if pole=='south' else (90-np.rad2deg(theta))
    golden=math.pi*(3-math.sqrt(5))
    lon=(np.rad2deg(i*golden)%360)-180
    return [Point(f'Survey {j:04}',round(float(lat[j]),5),round(float(lon[j]),5)) for j in range(n)]


def unit_radials(points:list[Point])->np.ndarray:
    angles=np.deg2rad(np.array([[p.lat,p.lon] for p in points],dtype=float))
    phi,lam=angles[:,0],angles[:,1]
    return np.column_stack((np.cos(phi)*np.cos(lam),np.cos(phi)*np.sin(lam),np.sin(phi)))


def visible_disk_fraction(delta_alt_deg:np.ndarray,radius_deg:np.ndarray)->np.ndarray:
    """Fraction of apparent disk above a *locally straight* geometric horizon.

    Analytic circle-segment area (not sampled limb fraction). This is a smooth-
    sphere approximation and is invalid if local terrain changes the skyline.
    """
    x=np.asarray(delta_alt_deg)/np.asarray(radius_deg)
    x=np.clip(x,-1.,1.)
    return (np.arccos(-x)+x*np.sqrt(np.maximum(0.,1-x*x)))/math.pi


def max_blackout_hours(fractions: np.ndarray, step_hours:float, threshold:float=.5)->np.ndarray:
    """Return max *sampled* consecutive outage duration for each site."""
    if fractions.ndim!=2 or step_hours<=0:raise ValueError('Expected sites x time array and positive step')
    run=np.zeros(fractions.shape[0],dtype=np.int32)
    longest=np.zeros_like(run)
    for t in range(fractions.shape[1]):
        off=fractions[:,t]<threshold
        run=np.where(off,run+1,0)
        longest=np.maximum(longest,run)
    return longest*step_hours


def screen_sites(points:list[Point],ephemeris:list[dict],step_hours:float,observer_height_m:float=2.0):
    """Vectorized Moon-fixed SPICE body vectors -> geometric visibility stats.

    `ephemeris`: [{'sun': np.array(km), 'earth': np.array(km)}, ...].
    Outputs numeric ranking data and per-body time-series arrays. Not terrain
    corrected. No eclipse, link budget, surface slope, or travel accessibility.
    """
    if not points or len(ephemeris)<2:raise ValueError('Need sites and at least two ephemeris epochs')
    if not np.isfinite(step_hours) or step_hours<=0:raise ValueError('step_hours must be positive')
    U=unit_radials(points)
    observer=U*(MOON_KM+observer_height_m/1000)
    dip=-math.degrees(math.acos(MOON_KM/(MOON_KM+max(0,observer_height_m)/1000))) if observer_height_m>0 else 0.
    T=len(ephemeris)
    fractions={};elevation={}
    for body,radius in [('sun',SUN_RADIUS_KM),('earth',EARTH_RADIUS_KM)]:
        pos=np.asarray([e[body] for e in ephemeris],dtype=float)
        if pos.shape!=(T,3):raise ValueError('Invalid ephemeris vector shape')
        vec=pos[None,:,:]-observer[:,None,:]
        dist=np.linalg.norm(vec,axis=2)
        coszenith=np.einsum('ntk,nk->nt',vec,U)/dist
        alt=np.rad2deg(np.arcsin(np.clip(coszenith,-1.,1.)))
        angle=np.rad2deg(np.arcsin(np.clip(radius/dist,-1.,1.)))
        fractions[body]=visible_disk_fraction(alt-dip,angle)
        elevation[body]=alt
    sun=fractions['sun'];earth=fractions['earth']
    sunny=sun>=.5;earthen=earth>=.5
    solardistance=np.linalg.norm(np.asarray([e['sun'] for e in ephemeris]),axis=1)
    solar_flux=1361*(AU_KM/solardistance)**2
    # kWh/m² of ideal normal-tracking incident energy (not PV electrical output).
    integrate=getattr(np,'trapezoid',None) or np.trapz
    energy=integrate(sun*solar_flux[None,:],dx=step_hours,axis=1)/1000
    ntime=(T-1)*step_hours
    solarblack=max_blackout_hours(sun,step_hours)
    earthblack=max_blackout_hours(earth,step_hours)
    stats=[]
    for i,p in enumerate(points):
        s=float(np.mean(sun[i]));e=float(np.mean(earth[i]));b=float(np.mean(sunny[i]&earthen[i]));
        # Explicitly subjective screening score, not engineering feasibility.
        rank=.3*s+.3*e+.4*b-.10*(solarblack[i]+earthblack[i])/max(ntime,step_hours)
        stats.append({'name':p.name,'lat':p.lat,'lon':p.lon,'source':p.source,
          'sun_fraction':round(s,5),'earth_fraction':round(e,5),'both_fraction':round(b,5),
          'solar_blackout_h':float(solarblack[i]),'earth_blackout_h':float(earthblack[i]),
          'tracking_incident_kwh_m2':round(float(energy[i]),3),'screening_score':round(float(rank),6),
          'min_sun_alt_deg':round(float(np.min(elevation['sun'][i])),3),
          'min_earth_alt_deg':round(float(np.min(elevation['earth'][i])),3),
          'terrain_mode':'NO TERRAIN: SMOOTH SPHERE SCREEN ONLY'})
    return stats,{'sun_fraction':sun,'earth_fraction':earth,'sun_alt':elevation['sun'],'earth_alt':elevation['earth']}


def rank_filtered(stats:list[dict],top:int=10,min_sun:float=0,min_earth:float=0,max_solar_blackout_h:float=float('inf'),max_earth_blackout_h:float=float('inf')):
    filtered=[r for r in stats if (r['sun_fraction']>=min_sun and r['earth_fraction']>=min_earth
        and r['solar_blackout_h']<=max_solar_blackout_h and r['earth_blackout_h']<=max_earth_blackout_h)]
    return sorted(filtered,key=lambda r:(-r['screening_score'],r['name']))[:top]
