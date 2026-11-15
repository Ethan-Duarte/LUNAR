# Working on LUNAR

Use a fresh branch for each change. Keep visual adjustments separate from scientific algorithm changes so both can be reviewed against clear acceptance criteria.

## Local development

1. Install Python engine requirements with `python -m pip install -r engine/requirements.txt`.
2. Start `python run_atlas.py` for the local science proxy / bundled build.
3. In `frontend`, run `npm ci`, then `npm run dev`. Set `LUNAR_ATLAS_API=http://127.0.0.1:5195` if using the V1 launcher.
4. Tests: `npm test`; Python tests from `engine`: `python -m pytest -q`.
5. Build: `npm run build`; copy `frontend/dist` into `app` before producing an end-user archive. The release helper in `tools/build_release.py` performs this copy and packages source without dependency caches.

## Scientific changes

Record the model version, criterion definitions, terrain provenance, frame, date range, output cadence and event-refinement assumptions. Preserve archived study files and failed validation evidence. Do not alter a threshold or drop a test location merely to obtain a pass.

For browser tests, inherited horizon golden fixtures deliberately retain their original 4k global DEM. Current-production global data and the current three-scenario audit have separate tests. The fixed Earth holdout is opt-in and computationally larger: `LUNAR_HOLDOUT=1 npm test -- src/lunar/holdout.audit.test.ts` (PowerShell: set `$env:LUNAR_HOLDOUT='1'` first).

## UI and assets

Basic must be useful without changing scientific assumptions. Advanced expands the same session. Moving between tools should preserve observations, the camera, and in-progress layout work. Write original user-facing prose and draw original interface graphics. Keep scientific-source credits and the technical upstream attribution visible; do not introduce non-NASA artwork from the upstream reference.
