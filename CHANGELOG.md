# 1.1.0-preview.1

- Direct Base editing, facility undo/redo, worker-based finite-mission electrical analysis and explicit failure reporting.
- Bounded layout search with shortlisted array resizing; discrete tower-height sweep; placement sensitivity.
- Geometric relay routing and optional free-space link budget.
- Analytic browser eclipse overlap and eclipse-aware generation/storage reports.
- Preserve workspace when selecting sites; Basic/Advanced navigation; complete Base project import/export.
- Observer-centred measured-terrain remesh and camera elevation refresh, reduced glare and resizable analysis panel.
- Hardware rendering, independent eclipse timing and full roadmap remain pending. Earth holdout remains FAIL.

# V1.0.0 — 2026-11-15

- Replaced the inherited product interface with an original LUNAR workspace: quiet left analysis panel, large observatory and bottom UTC timeline.
- Basic is the default; Advanced exposes shared scientific assumptions and the retained Python workspace without resetting the scene.
- Added original field-guide copy and Sun/Earth bearings; removed inherited welcome imagery, mission narratives, photos and craft showcases from the app.
- Added Observe, Find, Compare, Base and Sites navigation. The factual site reference catalog is optional, not the default experience.
- Added connected-base screening: up to eight facilities, minimum-distance tree, user-defined separation constraints, sampled terrain LOS, joint availability, saved alternatives and exports.
- Added portable observation-project validation and restoration of time, sites, criteria, observer height and display settings.
- Re-encoded NASA's published 5760×2880 whole-Moon LOLA grid at native horizontal spacing and 0.5m vertical encoding, replacing the downsampled default global elevation layer. Local 20/80/160m patches remain available.
- Added apparent circular-disc Earth occultation to new Python single-site analyses. Archived studies remain unchanged; terrain/eclipsing disc combination is explicitly approximate.
- Added a fixed-coordinate cross-engine Earth-holdout audit and transparent scientific-status documentation.
- Moved the V1 launcher to port 5195 with a build-specific URL and printed source folder to reduce old-server/cache confusion.

## V1.2 preview usability checkpoint (2026-11-15)

- Added explicit Inspect/Add/Move map modes, a seven-step Base lesson with failure/repair, contextual help, and disconnected-facility diagnostics.
- File cancellation/empty selection never starts import; failed imports show errors. Render error boundaries provide recovery controls. Exact reported browser crash remains un-reproduced.
- Removed the separate observer terrain patch; refine the existing measured mesh around the observer. Hardware visual acceptance pending.
- Added original Mission/Landscape/Try it/Sources education with three NASA-credited Apollo photographs and provenance hashes.
- Scientific model thresholds unchanged; independent Earth holdout remains failed. See UPDATE_V1_2.md for acceptance checks.

## V1.3 preview (2026-11-15)

- Viewer-mounted, collapsible Base guide; mission selection scrolls to education.
- Calendar-controlled scrub range and hourly geometric-daylight viewing shortcut; study dates remain independent.
- Original educational crewed/robotic lander archetypes, illustrative Apollo rover, measured local ground and labeled studio/simulation lighting. No competitor showcase assets in the new scene.
- Retained Base result comparison, assumptions mismatch warnings, ranking explanation and sampled blackout jumps.
- Scientific acceptance thresholds unchanged; Earth holdout still failed. No hardware visual or competitor superiority claim. See UPDATE_V1_3.md.

## V1.4 preview — final historical pass (2026-11-15)

- Independent right-side mission file / narrow-screen drawer, persistent education tabs, original hardware explanations and terrain-spacing labels.
- Simulation sunlight by default. Shared observatory terrain renderer in local coordinates, observer-horizon/eclipse gating for spacecraft, improved support placement and framing.
- Double-precision localization before GPU upload; direct body-frame Sun and exposure conventions retained.
- Numerical visibility, Base physics and acceptance thresholds unchanged. GPU visual acceptance remains pending; Earth holdout remains failed.
- Historical additions frozen apart from blocking defects. See UPDATE_V1_4.md and VALIDATION_NEXT.md.

## V1.5 science checkpoint (2026-11-15)

- Reproduced all 185 fixed Earth points in both browser configurations: RMS 3.134374 pp, bias +1.033812 pp, correlation 0.989396; status still FAIL. No physical thresholds changed.
- Verified every saved reference value and coordinate against the original NASA IMG/label. Two-point height diagnostics show sensitivity but do not explain or solve the mismatch.
- Closed-form energy/storage cases and deterministic search bounds/fixed-anchor/re-evaluation checks pass. One-day optimizer case can legitimately remove solar area because initial battery energy covers demand; the UI now warns explicitly. No sustainable-base claim.
- 64 Python regressions passed. Regular frontend/audit counts and commands are in qa/v15 and V1_5_VALIDATION.md. GPU and unassisted usability acceptance remain pending.
- Mission information now overlays a fixed-size viewport. Integrated metre-scale landers deferred to avoid another camera overhaul.

## V1.6 comparison / mission timing checkpoint (2026-11-15)

- Pinned Horizon Wheel code audit; 49 original peer tests and 2 matched adapters reproduced. Scalar battery/RF and a controlled flat-horizon site agree; broad parity is not established.
- Added original joint power/reserve/contact timing lanes and a 30-day low-initial-charge electrical example. 0 m² fails with 672.5 kWh unmet; 20/40 m² satisfy modeled demand with siting/Earth gates explicitly relaxed.
- Independent NASA eclipse-event timing/phase sanity check passes at one-minute resolution; no local contact-time certification.
- Original Apollo 11 flag and explicit Expedition-versus-Surface guidance.
- DSN station access, clone statistics and traverse routing remain gaps. Earth holdout remains FAIL. See HORIZON_WHEEL_AUDIT.md, V1_6_SCIENCE.md and qa/v16.


## V1.7 preview checkpoint
Keyboard navigation, explicit analysis time, per-facility removal, stale-result clearing, boundary-censored outage labels, bounded station-specific DSN geometry and a selected spatial before/after case. See UPDATE_V1_7.md and V1_7_SCIENCE.md. Global progressive tiles deferred; Earth holdout remains FAIL.
