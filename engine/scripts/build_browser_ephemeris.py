"""Rebuild LUNAR's browser sky table directly from NASA NAIF kernels.

Uses the documented SPICE spkpos API, apparent LT+S Moon-centred directions,
MOON_ME_DE440_ME421 orientation, hourly UTC dates. No prior table is read.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import argparse
import hashlib
import json
import numpy as np
import spiceypy as spice


def build(kernel_root: Path, output: Path):
    names = ['naif0012.tls', 'pck00011.tpc', 'de440s.bsp',
             'moon_pa_de440_200625.bpc', 'moon_de440_250416.tf']
    for name in names:
        spice.furnsh(str(kernel_root / name))
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    end = datetime(2036, 1, 1, tzinfo=timezone.utc)
    step = 3600
    count = int((end - start).total_seconds() / step) + 1
    values = np.empty((count, 8), dtype='<f4')
    for sample in range(count):
        date = start + timedelta(seconds=sample * step)
        epoch = spice.str2et(date.strftime('%Y-%m-%dT%H:%M:%S'))
        for body, offset in [('SUN', 0), ('EARTH', 4)]:
            position, _ = spice.spkpos(body, epoch, 'MOON_ME_DE440_ME421', 'LT+S', 'MOON')
            distance = np.linalg.norm(position)
            values[sample, offset:offset + 3] = position / distance
            values[sample, offset + 3] = distance
    output.mkdir(parents=True, exist_ok=True)
    values.tofile(output / 'ephem.bin')
    metadata = dict(t0_utc=start.strftime('%Y-%m-%dT%H:%M:%SZ'), step_s=step,
                    count=count, frame='MOON_ME_DE440_ME421', abcorr='LT+S', kernels=names,
                    record=['sun_x', 'sun_y', 'sun_z', 'sun_dist_km',
                            'earth_x', 'earth_y', 'earth_z', 'earth_dist_km'],
                    generator='LUNAR engine/scripts/build_browser_ephemeris.py',
                    sources=['https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'],
                    kernel_sha256={n: hashlib.sha256((kernel_root / n).read_bytes()).hexdigest()
                                   for n in names})
    (output / 'ephem.json').write_text(json.dumps(metadata, indent=2) + '\n')
    spice.kclear()
    print(json.dumps(dict(count=count, output=str(output), sha256=hashlib.sha256(
        (output / 'ephem.bin').read_bytes()).hexdigest())))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--kernels', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    options = parser.parse_args()
    build(options.kernels, options.output)
