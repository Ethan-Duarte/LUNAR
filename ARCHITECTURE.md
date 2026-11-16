# Architecture

- frontend/src/App.tsx: Basic/Advanced workspace, observation state, scientific controls and education.
- frontend/src/scene/LunarGlobe.tsx and LunarSurface.tsx: spherical displacement, height-field normals, terrain shadow tracing and photographic display response.
- frontend/src/scene/LunarCamera.tsx: standard Three.js OrbitControls with spherical camera flights.
- frontend/src/lib: terrain decoding/lookup, spherical geometry, sky-table interpolation, horizon/disc sampling, visibility statistics, suitability search and arrival ranking.
- frontend/src/ui/useSiteAnalysis.ts: memoized observation geometry and time-window calculations.
- frontend/src/lunar: connected-base engineering, optional RF screening, DSN geometry, timeline, project handling and original education tools.
- engine/lunar: Python scientific calculations and data/service support.
- run_atlas.py: local launcher/server and scientific-service proxy. Pages runs the static browser edition.

Measured terrain is not procedural detail. Render interpolation and display exposure do not change scientific data. Prepared terrain/source metadata remains separate from calculations and results. See NOTICE for provenance and SCIENCE_STATUS.md for acceptance limits.
