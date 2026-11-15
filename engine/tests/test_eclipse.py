import math
import pytest
from lunar.eclipse import unocculted_fraction,eclipse_from_sample

def test_no_contact_total_and_annular():
    assert unocculted_fraction(2,.27,.95)==1
    assert unocculted_fraction(0,.27,.95)==0
    assert unocculted_fraction(0,1,.5)==pytest.approx(.75)

def test_equal_discs_partial_overlap_exact_geometry():
    expected=1-(2*math.pi/3-math.sqrt(3)/2)/math.pi
    assert unocculted_fraction(1,1,1)==pytest.approx(expected)

def test_contact_continuity_and_monotonicity():
    a=[unocculted_fraction(x/100,.27,.95) for x in range(160)]
    assert all(0<=v<=1 for v in a)
    assert all(x<=y+1e-14 for x,y in zip(a,a[1:]))
    assert unocculted_fraction(1.22,.27,.95)==pytest.approx(1)

def test_sample_wraps_azimuth_and_preserves_local_angle():
    r={'sun_alt':0,'earth_alt':0,'sun_az':359.9,'earth_az':.1,'sun_radius':.27,'earth_radius':.95}
    assert eclipse_from_sample(r)==0
    r['earth_az']=20
    assert eclipse_from_sample(r)==1

def test_rejects_invalid_geometry():
    with pytest.raises(ValueError):unocculted_fraction(-1,1,1)
