# v1.10.0 — primary-data cleanup checkpoint

This is an incremental development release, not a declaration that every
competitor-derived dependency has been removed. The supplied v1.9.1 ZIP is the
baseline. No remote repository or published site was changed.

## Completed and executed

- Independent `tools/prepare_polar_products.py` reads four primary NASA
  GeoTIFFs, regenerates polar elevation/slope tiles and Sun/Earth/PSR overlays,
  and records input/output hashes in `qa/v110/polar_build.json`.
- The native 80 m elevation values and all three overlays reproduce the old
  pixel values exactly. The coarse elevation differs at 3,785 pixels by 0.5 m;
  slope differs at 50 pixels total by one 0.25-degree code. These are measured
  numerical differences, not a claim of improved accuracy.
- `tools/prepare_site_patches.py` independently samples primary PDS SLDEM2015
  and NASA LOLA. Executed for Apollo 11 (inner and outer) and Connecting Ridge.
  Other patch ids are supported by the implementation but NOT yet accepted or
  represented as regenerated. Requests use the existing index as a location
  and output-resolution contract, not as a source of heights.
  Apollo 11's inner patch differs by at most 0.5 m; its outer patch differs by
  at most 20 m (RMS 1.069 m). Connecting Ridge differs by at most 0.1 m.
  These resampling/quantization differences are recorded, not hidden or claimed
  to improve accuracy. Fresh surface-view inspection is still required.
- `tools/prepare_pointing_checks.py` fetched 40 new topocentric Sun/Earth
  records (8 locations, 5 dates) directly from JPL Horizons. Original responses
  and request URLs/hashes are retained in `qa/v110/horizons/`. The browser check
  passes the existing 0.02-degree angular-separation criterion. This checks
  pointing, not terrain visibility or mission suitability.
- Removed an unused copied icon sprite and inactive copied application-source
  snapshot. Replaced the startup HTML with a small LUNAR loading shell.
- Corrected the stale ephemeris source comment; the direct NAIF generator and
  its existing metadata are retained.

## Code inspection scope

Compared 14 corresponding browser modules with the pinned reference commit
707b035fccbc7829c5ee4cf539c17f0d2d9bb652, covering geometry, sky evaluation,
terrain sampling, horizons, windows, finder, landing, global raster handling,
state and renderer entry points. Remaining exact lines are primarily interface
contracts and generic React initialization. See `qa/v110/source_comparison.json`.
This is a scoped inspection, not a claim that matching bytes prove plagiarism
or that different bytes establish independent authorship. A complete origin
review of all modified modules remains open.

## Still outstanding

1. Execute and verify direct regeneration for every remaining site patch,
   including cross-tile boundaries, polar coverage, and partial/no-data cases.
2. Reconstruct/recheck mission catalog records against primary agency sources.
   Scientific coordinates and dates are facts; provenance and curated text are
   the issues to resolve, not changing correct numbers for cosmetic difference.
3. Replace remaining inherited skyline/patch/crest fixtures with independently
   obtained references. Keep the old regression checks until their replacements
   cover the relevant behavior; do not silently reduce validation coverage.
4. Finish primary acquisition of globe imagery. Both attempted NASA image
   endpoints returned HTTP 503 during this run. The current textures and source
   credits are deliberately retained. `tools/prepare_globe_images.py` is a
   pending acquisition recipe, not a successfully executed rebuild.
5. Review modified modules beyond the scoped code comparison, then update
   current acknowledgments to the final dependency inventory. Do not erase
   historical derivation claims while their underlying material remains.
6. Rerun the independent Earth-map holdout after the terrain work. Its historical
   FAIL remains open. This checkpoint does not claim to fix it.

## Reproduction

Install `tools/requirements-data.txt` with Python. From the project root:

```sh
python tools/prepare_polar_products.py
python tools/prepare_site_patches.py --only apollo-11 connecting-ridge
python tools/prepare_pointing_checks.py
python -m pytest tools/test_primary_products.py -q
```

The data cache is ignored by Git and excluded from release archives. Full
download inputs have hashes; partial transfers do not claim a full-source hash.
For selective 20 m TIFF reads, source identity and output hashes are recorded;
block manifests are not a complete checksum of the remote 2.7 GB file.

## Validation

- Browser suite: 126 passed, 2 skipped; no old tests deleted.
- Scientific Python suite: 64 passed.
- New primary-builder invariant checks: 5 passed, including a tile-boundary case.
- Production frontend build: passed (existing large-bundle warning).
- Fresh browser/GPU appearance review: not performed.

Primary documentation: [LOLA high-resolution data](https://pgda.gsfc.nasa.gov/products/78),
[polar visibility products](https://pgda.gsfc.nasa.gov/products/69),
[SLDEM2015](https://pgda.gsfc.nasa.gov/products/54),
[Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html).
