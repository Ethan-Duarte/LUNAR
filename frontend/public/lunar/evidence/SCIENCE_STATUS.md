# Scientific status

## Current verification

The V1.9.1 frontend suite passes 126 tests; two audit tests are skipped. The last Python run passes 64 tests. New globe/surface shaders compile and link in a headless OpenGL check. These do not replace browser/device visual acceptance.

- Ephemerides: 105,193 hourly records generated directly from NASA NAIF kernels, with exact kernel hashes. Retained Horizons direction checks pass a 0.02° tolerance; retained skyline fixtures pass 0.001°. Fixture agreement is regression evidence, not independent validation of their producer.
- Global terrain: native 5760×2880 LOLA input downloaded directly from NASA SVS and encoded without spatial downsampling. Source/output hashes: qa/v20/direct_nasa_global_dem.json.
- DSN: 12 station-elevation samples agree with Horizons within the declared 0.05° tolerance. Tables cover 2026-11-01 through 2027-01-01 UTC; no extrapolation or operational scheduling.
- Base: energy accounting, storage, connectivity, RF, eclipse and selected production-worker examples have recorded tests. A selected mast-height repair does not establish engineered cable feasibility.

## Open Earth-map holdout

The independent Python Earth-map holdout remains FAIL: RMS 3.1668 percentage points and bias +1.0433 pp, beyond limits of 3 pp and absolute bias 1 pp. The last full browser holdout checkpoint (V1.5) also failed: RMS 3.1344 pp, bias +1.0338 pp. The complete browser holdout has not been rerun for this rewrite; component regressions do not replace it. No acceptance threshold was waived.

## Evidence

qa/v19 records the rewrite, retired tests, replacement checks and shader verification. qa/v20 records the contrast patch, direct NASA rebuild and latest frontend checks. engine/reports contains scientific validation reports. qa/SCIENCE_HISTORY.md preserves the prior ledger as historical context. Public evidence files retain detailed benchmark methods and their source references.

Earlier larger test totals included obsolete components and inherited suites subsequently retired/replaced. The smaller release total is not presented as increased coverage. Display changes do not improve scientific resolution or establish scientific superiority.
