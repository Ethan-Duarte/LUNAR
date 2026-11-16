# V1.7 science checkpoint

## Station-specific DSN geometry

Official NAIF SPICE kernels generate apparent Moon-to-station positions and terrestrial Moon-centre elevation for DSS-14, DSS-63 and DSS-43. Station coordinates: DSN 810-005 301M, Table 6: https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301M.pdf . Kernels: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ . Frame: MOON_ME_DE440_ME421; terrestrial ITRF93, LT+S corrections.

Coverage: 2026-11-01 through 2027-01-01 UTC, 600-second sampling, linear interpolation; no extrapolation. Terrestrial mask uses Moon-centre elevation >=10 degrees. Lunar-side station directions are checked against the local horizon and selected Earth mask. Real station scheduling, weather, link acquisition, capacity and near-limb station-view lunar-site offset are not modeled. Earth-orientation predictions limit future accuracy.

Twelve JPL Horizons AIRLESS station elevation samples at half-table-step times on November 14 pass the predeclared 0.05 degree tolerance; maximum interpolated error 0.04174057685 degrees. Raw responses and results: qa/v17/horizons_*.txt, dsn_horizons.json. This samples terrestrial elevation, not every access transition or the complete radio system.

Reproduce with engine/scripts/build_dsn.py (see --help), supplying naif0012.tls, pck00011.tpc, de440s.bsp, earth_latest_high_prec.bpc, moon_pa_de440_200625.bpc and moon_de440_250416.tf. Generated metadata records exact kernel hashes; refreshed Earth orientation can change results.

## Selected spatial demonstration

The shipped Connecting Ridge terrain example uses separated habitat and solar array (~400 m separation), and an intermediate relay/bus junction. Changing its mast from 2 m to 10 m changes modeled disconnected to connected; the selected 30-day calculation changes unmet energy from 672.5 kWh to zero. See qa/v17/spatial_demo.json and frontend/public/lunar/examples/. This is an explanatory chosen case, not a blind validation or physically engineered elevated cable route. Existing ideal shared-bus assumptions apply.

## Remaining acceptance limits

Independent Earth-map holdout still FAILS: Python RMS 3.1668 pp, bias +1.0433 pp; browser RMS 3.1344 pp, bias +1.0338 pp. No threshold was waived. DSN geometry does not establish broad competitor parity or mission readiness. Progressive global terrain is deferred. Required source and dataset notices are retained.
