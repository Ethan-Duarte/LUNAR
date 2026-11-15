"""LUNAR V1: apparent circular-disc Earth occultation of sunlight.

Exact two-circle overlap in the small-angle sky plane. Combined terrain / eclipse
visibility uses a product approximation, not exact three-boundary integration.
No atmospheric refraction, diffraction or Earth limb topography is modeled.
"""
import math

def unocculted_fraction(separation_deg,sun_radius_deg,earth_radius_deg):
    d,r,R=map(float,(separation_deg,sun_radius_deg,earth_radius_deg))
    if not all(math.isfinite(v) for v in (d,r,R)) or d<0 or r<=0 or R<=0:
        raise ValueError('Finite nonnegative separation and positive radii required')
    if d>=r+R:return 1.
    if d<=abs(R-r):return max(0.,1.-min(r,R)**2/r**2)
    c1=max(-1.,min(1.,(d*d+r*r-R*R)/(2*d*r)))
    c2=max(-1.,min(1.,(d*d+R*R-r*r)/(2*d*R)))
    area=r*r*math.acos(c1)+R*R*math.acos(c2)-.5*math.sqrt(max(0.,(-d+r+R)*(d+r-R)*(d-r+R)*(d+r+R)))
    return max(0.,min(1.,1.-area/(math.pi*r*r)))

def eclipse_from_sample(row):
    a,b=math.radians(row['sun_alt']),math.radians(row['earth_alt'])
    az=math.radians(row['sun_az']-row['earth_az'])
    dot=math.sin(a)*math.sin(b)+math.cos(a)*math.cos(b)*math.cos(az)
    # atan2 avoids acos loss near perfect alignment.
    sep=math.degrees(math.atan2(math.sqrt(max(0.,1-dot*dot)),max(-1.,min(1.,dot))))
    return unocculted_fraction(sep,row['sun_radius'],row['earth_radius'])
