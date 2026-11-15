import math
from datetime import datetime,timedelta,timezone
from lunar.engineering import solar_flux,integrate_incident_energy

def test_full_sun_tracking_at_one_au():
    values=solar_flux(1,12)
    assert math.isclose(values['tracking_w_m2'],1361,rel_tol=1e-12)
    assert math.isclose(values['horizontal_w_m2'],1361*math.sin(math.radians(12)),rel_tol=1e-12)

def test_dark_no_power():
    assert solar_flux(0,30)['tracking_w_m2']==0
    assert solar_flux(1,-5)['horizontal_w_m2']==0

def test_distance_inverse_square():
    assert math.isclose(solar_flux(1,90,2*149597870.7)['tracking_w_m2'],1361/4)

def test_energy_integral():
    t=datetime(2026,11,14,tzinfo=timezone.utc)
    samples=[{'time':(t+timedelta(hours=h)).isoformat(),'sun_fraction':1,'sun_alt':90} for h in (0,1,2)]
    ans=integrate_incident_energy(samples)
    assert math.isclose(ans['horizontal_kwh_m2'],2*1.361,rel_tol=1e-12)
    assert math.isclose(ans['tracking_kwh_m2'],2*1.361,rel_tol=1e-12)
