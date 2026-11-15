# V1.0 acceptance checks

Start from a fresh extraction with START_LUNAR_V1.bat. Use the printed build-specific URL on port 5195 (or its reported fallback). CHECK_ATLAS.bat must pass.

## Browser workflows checked

- Basic is default; original Observe/Find/Compare/Base/Sites navigation replaces the inherited product UI.
- Placing a Connecting Ridge observer computes Sun/Earth readings and a 60-day availability view.
- A real requirement-based finder returns candidates; selecting one creates an observation and matched comparisons work.
- Arrival-window rankings are calculated using shared criteria.
- Advanced reveals the Python workspace and criteria without discarding selected sites.
- A habitat remains in Base after changing tabs to place another observer. Adding a nearby power site computes a 0.30 km connection, terrain blockage and 21.5% joint availability in the tested scenario.
- Saved layout alternatives and exported lunar-base-1 JSON contain two facilities, one tree link, assumptions and sampled temporal results.
- Returning to Basic preserves the base state.
- A loading race involving retained observers was reproduced, guarded and covered by two component regressions.

The remote browser disables WebGL. This validates interface/calculation workflows, not full hardware rendering. Shipped terrain/globe GLSL also compiles/renders through Mesa EGL as a separate check.

## Required hardware acceptance

Check Globe, South pole, Surface, camera orbit/zoom, original Sun/Earth bearing indicators, selected-point ring, Earth texture, shadow toggle and detail settings on a hardware-accelerated browser. Move across patch boundaries and check flicker/joins. Confirm Basic/Advanced and tool changes preserve the camera. Check mobile layout separately; it is responsive in code but was not tested across physical devices.

## Reproducible checks

- frontend: npm ci; npm test; npm run build. 241 normal tests pass; fixed holdout is opt-in.
- engine: python -m pytest -q. 64 tests pass.
- Fixed Earth holdout: set LUNAR_HOLDOUT=1 and run src/lunar/holdout.audit.test.ts. The audit records both configurations at all 185 points; both fail unchanged scientific limits.
- qa/check_real_eclipse.py: real SPICE / synthetic clear skyline smoke case, not independent event timing.
- qa/api_smoke.py: needs regional native DEMs; starts/stops its own launcher and checks live analyze/footprint endpoints.
- run_atlas.py --self-test: packaged asset references and MIME types.

See SCIENCE_STATUS.md for the distinction between a successful regression/audit execution and a failed scientific comparison. No RF reliability, landing safety or flight certification is claimed.
