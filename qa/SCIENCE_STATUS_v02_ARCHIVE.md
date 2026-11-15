# Scientific evidence ledger — LUNAR Field Atlas v0.1

**Date:** 2026-11-15. This release is a new visual/user-experience architecture, **not a new round of numerical validation**.

| Area | Status | What the evidence actually says |
|---|---|---|
| JPL topocentric Sun/Earth pointing | Previously PASS | 112 surface-observer comparisons against fresh JPL Horizons. Source summaries and raw reports are retained under `engine/reports/`. |
| Common NASA visibility benchmark | Previously PASS | 185 published comparison coordinates; Sun RMS 2.6749 pp and Earth RMS 2.7707 pp. Configuration-specific parity, not blanket validation. |
| Published Connecting Ridge daylight benchmarks | Previously PASS | Four source-backed comparisons to published ridge results within documented criteria. Not exact original DEM/date reprocessing. |
| Independent 185-point Sun holdout | Previously PASS | Sun RMS 2.0735 pp. |
| Independent 185-point Earth holdout | **FAIL** | Earth RMS **3.1668 pp > 3 pp**, bias **+1.0433 pp > ±1 pp**; fixed coordinates/thresholds retained. |
| Python Science 1 regressions | PASS in packaged copy | `59 passed` on 2026-11-15. No modifications to numerical algorithms. |
| New Atlas JS math/data regressions | PASS | `7 passed` in Node. |
| New Atlas interaction controls | PARTIAL | Headless browser smoke test with real example JSON, mocked HTTP transport, no WebGL: Explore, Study, Evidence, Surface toggles and real metric display. |
| Atlas live 3D rendering | **NOT VERIFIED** | Headless browser environment blocks WebGL2; code is present but shaders, frame pacing and final visual quality must be tested on the user's GPU. |
| Atlas new on-demand studies | **NOT RERUN** | API contract and local engine health checked; needed NASA kernels absent in this package. |
| NASA operational readiness / landing-site safety | **NOT CLAIMED** | Macro DEM coverage, vehicle design and missing uncertainty analyses make flight suitability beyond scope. |

## Decisions, rationale and limitations

- **A-001** New frontend, separate science service. Retain validated configuration-specific results without inheriting prior UI debt. WebGL display cannot modify science outcomes.
- **A-002** Use original WebGL2 implementation, not source or assets copied from a competitor. Distinct organization, visual identity and scientific workflow. The Singapore repo is explicitly acknowledged as an inspiration.
- **A-003** Bundle unchanged previous Science 1 study examples. Preserve computed time series, horizon source metadata, thresholds, start/end times and DEM provenance. The app reads/export the source directly.
- **A-004** Distinguish real measurements from shader graphics. Procedural microtexture, vertical relief, edge blends and finite-range ray shadows are strictly for display, never mission physics. **Unverified on device.**
- **A-005** Snap between locations for now, avoid unwanted camera flythroughs. No animations may obscure location/data consistency.
- **A-006** Expose separate Python engine, bind only to localhost, use port 8766 to avoid colliding with historical port 8765. Report *missing kernel filenames* via health probe without implying complete numerical readiness.
- **A-007** Bundle copied official NASA imagery with clear source credits. These images are display layers, not DEMs.
- **A-008** Do not classify a scene as safe. No vehicle-specific performance, boulder hazards, DEM vertical error ensemble, verified DSN links, thermal model, solar panel attitude or mission-level V&V.

## Next scientific tasks — not implemented in this frontend rebuild

1. Reproduce the failed **independent Earth-map holdout** at its fixed points and distinguish legacy reference heights/DEM, time intervals and finite-disc definitions without moving thresholds.
2. Study registration, local DEM uncertainty and **higher-resolution LROC-derived terrain** for site-specific landing footprints; under-resolved areas yield incomplete evidence.
3. Reconnect the full **Science 1 Qualification** page only after agreeing on clear input requirements, provenance and missing-evidence states.
4. Add independently checked mission-specific power, thermal and communications calculations, rather than labeling Earth LOS as a reliable RF link.
5. Conduct browser GPU validation, NASA data source checks, performance profiling and independent review before describing outputs as operational planning.

Retained primary sources:
- https://pgda.gsfc.nasa.gov/products/90
- https://pgda.gsfc.nasa.gov/products/69
- https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkcpo_c.html
- https://ssd.jpl.nasa.gov/horizons/manual.html
- https://meetingorganizer.copernicus.org/EPSC2014/EPSC2014-136-1.pdf
- https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
