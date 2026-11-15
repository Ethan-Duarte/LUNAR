"""Independent mathematical properties of geometric polar-cap sampling."""
import math
from lunar.survey import polar_cap_locations


def test_polar_cap_has_exact_count_and_no_low_latitude_outliers():
    pts=polar_cap_locations(1600,'south',160)
    assert len(pts)==1600
    assert all(-90<=p.lat<=-90+math.degrees(160/1737.4)+1e-5 for p in pts)
    assert len({p.lon for p in pts})==1600


def test_polar_cap_uniform_area_in_cosine():
    pts=polar_cap_locations(1600,'north',160)
    # Equal-area Fibonacci cap sampling: half the points have radial area
    # fraction below .5, unlike a uniformly spaced latitude grid.
    cap=math.cos(160/1737.4)
    within=sum((1-math.cos(math.radians(90-p.lat)))/(1-cap)<.5 for p in pts)
    assert abs(within-800)<=2


def test_invalid_cap_parameters_fail_closed():
    for kwargs in ({'n':0},{'n':2,'radius_km':0},{'n':2,'pole':'global'}):
        try: polar_cap_locations(**kwargs)
        except ValueError: pass
        else: raise AssertionError('Accepted invalid polar survey')
