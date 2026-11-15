# V1.1 preview additions

The base engineering worker is new screening code. Its analytic energy-conservation, constant-darkness discharge, minimum-storage, RF scaling, eclipse-overlap, disconnected-network and relay-routing checks pass. Production-worker integration runs use shipped JPL/LOLA data and separately synthetic terrain; `qa/v11` preserves the cases. The actual App navigation regression and Base editing/recovery/undo flows are checked in a simulated DOM. These are not unassisted human usability or hardware rendering checks.

Browser partial eclipses now use analytic circular overlap; terrain and eclipse masks still use a product approximation. Explicit loss-of-generation and battery implications are new. Independent eclipse contact timing has not been validated for this version. Python calculations/archives remain unchanged.

Earth-dependent design recommendations remain provisional. No fixed-holdout thresholds have been changed and the older failure remains below. Source terrain has not been upgraded globally by the display remesh. The remote browser could not reach the local preview; no new live hardware rendering claim is made.

See ENGINEERING_V1_1.md for assumptions, limits and sources; NEXT_VERSION_PROGRESS.md separates implemented work from the broader roadmap.

---

# V1.0 scientific evidence and open questions

V1 is a versioned screening prototype. A polished view is not evidence of physical accuracy.

## Fixed Earth-map holdout, rerun for V1

All 185 original locations and reference values, 18.6-year period starting 2024-01-01, 2 m observer, 300 km horizon, 0.5° azimuth grid and hourly end-excluded sampling were retained. The test counts any visible portion of Earth, not the operational Earth-centre mask. Acceptance limits remain RMS 3 pp, absolute bias 1 pp, correlation 0.98.

| Calculation | RMS / pp | Bias / pp | Status |
|---|---:|---:|---|
| Archived LUNAR Python calculation | 3.16679 | +1.04327 | FAIL |
| Supplied reference browser geometry / original global input | 3.13437 | +1.03381 | FAIL |
| Same browser geometry / V1 native global input | 3.13437 | +1.03381 | FAIL |

The two browser configurations use the same supplied nested terrain and differ in their global elevation input. Both reproduce the largest discrepancies at the same locations. This is evidence of a shared modeling/reference discrepancy, not proof of a specific cause or a new accuracy advantage. Global resolution does not change these polar cases. The reference-map observer height and exact epoch remain unresolved metadata questions. No coordinates, pixels or acceptance limits were tuned.

The raw report, SPICE ephemeris fixture and reproducible audit are included in qa/earth_holdout_cross_engine.json, qa/holdout_ephem.bin and frontend/src/lunar/holdout.audit.test.ts. The old Python report remains unchanged under engine/reports/validation_v091/maps.json.

A diagnostic using the archived Python rows gives Earth RMS 5.51 pp for centre/half-disc criteria, versus 3.17 pp for any-disc visibility. Simply changing the visibility definition does not resolve the discrepancy. This diagnostic does not establish the NASA product's exact rule.

## New eclipse model

New Python single-site studies include exact two-circle apparent overlap in a small-angle sky plane. Terrain-visible and unocculted fractions are multiplied; this is not exact integration of overlapping terrain and Earth masks. Refraction, atmospheric limb transmission and diffraction are absent.

Five synthetic tests check contacts, total/annular coverage, partial overlap, monotonicity, azimuth wrapping and invalid geometry. A real-SPICE, synthetic-clear-skyline smoke case on 2025-03-14 produces total solar occultation while terrain-only Sun remains visible (qa/real_eclipse_check.json). It is not an independent timing observation. Archived 180-day studies and the sampled sensitivity endpoint retain their earlier terrain-only calculation and are labeled accordingly.

## Evidence inventory

- 241 regular frontend tests pass; one optional larger audit is skipped in the normal run. The dedicated audit separately completes; its scientific comparison result is FAIL, even though the audit test successfully records all 185 locations.
- 64 Python regression/component tests pass.
- Historical browser horizon golden fixtures retain the original 4k global input. Current native global data and the current three-scenario comparison are tested separately; inherited tests are not presented as a fresh validation of changed terrain.
- Native global map: NASA SVS published 5760×2880 grid, no horizontal downsampling; 0.5m vertical encoding. Spacing/quantization are not measurement accuracy.
- Base tool: spherical distances, geometric tree, synthetic curvature LOS tests, simultaneous-availability tests and project validation. No independent RF-network validation.
- Hardware rendering: remote browser disables WebGL. Original interface and planner workflows are tested through the live browser. Terrain GLSL can be rendered offscreen with Mesa; full interactive hardware rendering and performance remain acceptance tasks.

## Boundaries for planning

Base connections are not traversable routes. Sampled terrain LOS is not an RF link budget, and automatic operational relay paths are not implemented. The simultaneous metric requires all listed power sites sunlit and all habitats directly Earth-visible at hourly samples; it does not model loads or storage. Pad exclusion is a user assumption, not a debris safety prediction.

## Required next evidence

Investigate the two largest Earth-holdout outliers against reference metadata, terrain profiles, datum/frame and raster registration. Validate individual Earthrise/Earthset events externally. Test footprint robustness and global terrain regimes separately. Maintain fixed thresholds and preserve unresolved failures.

## V1.2 preview usability checkpoint (2026-11-15)

- Added explicit Inspect/Add/Move map modes, a seven-step Base lesson with failure/repair, contextual help, and disconnected-facility diagnostics.
- File cancellation/empty selection never starts import; failed imports show errors. Render error boundaries provide recovery controls. Exact reported browser crash remains un-reproduced.
- Removed the separate observer terrain patch; refine the existing measured mesh around the observer. Hardware visual acceptance pending.
- Added original Mission/Landscape/Try it/Sources education with three NASA-credited Apollo photographs and provenance hashes.
- Scientific model thresholds unchanged; independent Earth holdout remains failed. See UPDATE_V1_2.md for acceptance checks.
