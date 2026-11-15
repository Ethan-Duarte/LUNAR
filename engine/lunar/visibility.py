"""Visibility fractions and coarse, explicitly bounded outage metrics."""
from __future__ import annotations
import math
import numpy as np
from .terrain import Horizon


def horizon_at(horizon:Horizon, az_deg):
    az=np.asarray(horizon.az_deg,dtype=float)
    alt=np.asarray(horizon.alt_deg,dtype=float)
    if len(az)!=len(alt) or len(az)<2: raise ValueError('Invalid horizon profile')
    if not np.all(np.isfinite(alt)): return float('nan')
    return float(np.interp(float(az_deg)%360, np.r_[az,az[0]+360], np.r_[alt,alt[0]]))


def disk_fraction(alt_deg,az_deg,angular_radius_deg,horizon:Horizon,samples=49):
    """Analytic area integral of a disc cut by the piecewise-linear skyline.

    ``samples`` is retained for caller compatibility; no disc point sampling
    is used. Uniform azimuth horizons beginning at zero are required.
    """
    from .precision import disc_integral
    a=np.asarray(horizon.az_deg,dtype=float)
    h=np.asarray(horizon.alt_deg,dtype=float)
    if len(a)<2 or len(h)!=len(a) or not np.allclose(a,np.arange(len(a))*360/len(a)):
        raise ValueError('Disc integral requires a uniform cyclic horizon starting at 0 degrees')
    if not angular_radius_deg>0:raise ValueError('Positive disc radius required')
    return float(disc_integral(float(az_deg),float(alt_deg),float(angular_radius_deg),h))


def longest_blackout_hours(flags,step_hours):
    maxrun=run=0
    for flag in flags:
        if flag: run=0
        else:
            run+=1;maxrun=max(maxrun,run)
    return float(maxrun*step_hours)


def summarize(series,step_hours):
    sun=np.asarray([r['sun_fraction'] for r in series],dtype=float)
    earth=np.asarray([r['earth_fraction'] for r in series],dtype=float)
    if not np.all(np.isfinite(sun)) or not np.all(np.isfinite(earth)):
        return {'valid':False, 'reason':'Incomplete terrain horizon'}
    on_s=sun>=.5; on_e=earth>=.5
    return {
        'valid':True,
        'sun_fraction':float(np.mean(sun)),
        'earth_fraction':float(np.mean(earth)),
        'both_fraction':float(np.mean(on_s & on_e)),
        'sun_blackout_h':longest_blackout_hours(on_s,step_hours),
        'earth_blackout_h':longest_blackout_hours(on_e,step_hours),
        'step_h':float(step_hours),
        'caveat':'Outages quantized to sampling step; boundary refinement not implemented.'
    }


def score_metrics(m,criterion):
    """Explicitly subjective ranking, not mission-certification metric."""
    if not m['valid']: return -1e6
    if criterion=='sun':return m['sun_fraction']
    if criterion=='earth':return m['earth_fraction']
    if criterion=='both':return m['both_fraction']
    if criterion=='resilience':
        # Equal weighting of longest blackouts, normalized by 30 days. Only
        # compare under the same interval, which site exporter ensures.
        return -(m['sun_blackout_h']+m['earth_blackout_h'])
    raise ValueError('Unknown ranking objective')
