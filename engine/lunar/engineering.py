"""Idealized, non-electrical direct solar-energy proxy.

Assumes a uniformly bright apparent solar disk; disk occlusion fraction
is supplied by LUNAR's separate numerical visibility calculation.
No photovoltaic efficiency, incidence across partially visible disks,
self-shadowing, diffuse reflection, eclipses, temperature derating or
storage losses. Use only for relative comparisons.
"""
from math import sin, radians, isfinite
from datetime import datetime

SOLAR_CONSTANT_W_M2=1361.0
AU_KM=149597870.7

def solar_flux(solar_fraction, altitude_deg, sun_distance_km=AU_KM):
    if not all(isfinite(float(x)) for x in (solar_fraction,altitude_deg,sun_distance_km)):
        raise ValueError('Invalid solar inputs')
    if not 0<=solar_fraction<=1 or sun_distance_km<=0:raise ValueError('Fraction must be 0-1, distance positive')
    direct=SOLAR_CONSTANT_W_M2*(AU_KM/sun_distance_km)**2*solar_fraction
    return {'horizontal_w_m2':direct*max(0,sin(radians(altitude_deg))),
            'tracking_w_m2':direct}

def integrate_incident_energy(samples):
    """Trapezoidal integration, results kWh/m², per input 2+ time samples."""
    if len(samples)<2:raise ValueError('Need two or more samples')
    outputs={'horizontal_kwh_m2':0.,'tracking_kwh_m2':0.}
    previous=None
    for entry in samples:
        t=datetime.fromisoformat(entry['time'].replace('Z','+00:00'))
        value=solar_flux(entry['sun_fraction'],entry['sun_alt'],entry.get('sun_distance_km',AU_KM))
        if previous:
            dt=(t-previous[0]).total_seconds()/3600
            if dt<=0:raise ValueError('Time samples must be strictly increasing')
            outputs['horizontal_kwh_m2']+=dt*(previous[1]['horizontal_w_m2']+value['horizontal_w_m2'])/2000
            outputs['tracking_kwh_m2']+=dt*(previous[1]['tracking_w_m2']+value['tracking_w_m2'])/2000
        previous=t,value
    return outputs
