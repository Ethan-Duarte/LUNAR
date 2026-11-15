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
