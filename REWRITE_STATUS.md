# V1.9 rewrite checkpoint

## Implemented replacements

- New globe and surface GPU shaders, spherical relief mesh, skirts, conservative height-field picking, photo response, layer rendering and historical-scene transforms.
- New graphics host, display asset hooks, sky objects and camera controller using standard Three.js OrbitControls.
- New state mutation implementation with the compatible UI/project interface.
- Reimplemented spherical coordinates, ephemeris interpolation/observer projection, terrain raster decoding and interpolation, skyline/disc sampling, visibility-series statistics, regional suitability finder, arrival-window ranking, observation hook and disk test adapters.
- Fresh 105,193-record hourly sky table (2024–2036) computed directly from official NASA NAIF kernels. Maximum direction-channel difference from the previous table was 1.49e-8 at float32 precision; distances were identical at that precision. Generator and kernel SHA-256 records included.
- Unused older showcase, spacecraft, camera, compass and export code retired. Unused external source snapshots removed. Current LUNAR education, Base, DSN and original Python science retained.

## Acceptance and limits

126 release tests pass; two skipped. New reference tests retain 0.001 degree skyline and 0.02 degree sky tolerances. Regenerated ephemerides pass the retained Horizons direction checks. Both new terrain/globe shaders compile and link in a headless desktop OpenGL compatibility check; this is not a browser/device appearance test.

The legacy compatibility suite reached 315 passed before the obsolete tests were retired/replaced. Release count is lower, not an increase in validation coverage. qa/v19 lists deleted source/test files and records checkpoints. Existing Earth-map holdout remains FAIL. DSN coverage and ideal shared-bus limitations remain unchanged.

Prepared terrain/layer rasters, mission facts and retained reference vectors still have external provenance. Retained reference agreement is not independent validation. Public types/interfaces remain compatible. Replacements were written after inspecting source, not by an isolated clean-room process. This checkpoint is not an eligibility or legal clearance.

## Immediate hardware checks

Check title V1.9 Rewrite Test. Inspect globe terminator, crater relief, poles and detailed-terrain joins. Then inspect Surface, orbit/zoom/picking, each layer, historical local scenes, keyboard/playback and Base editing/calculation. Camera behavior now uses standard OrbitControls; the previous custom inertial surface-slide behavior is not reproduced exactly. Earth orientation is illustrative; body directions and phase are computed from the table. Keep V1.7/V1.8 for visual comparison.

Replace the COMPLETE old source tree while preserving .git; simply copying over files leaves retired code behind. Push using GitHub Desktop and wait for Pages deployment. No automatic publication was performed.
