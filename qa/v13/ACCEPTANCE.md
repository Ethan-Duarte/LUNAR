# V1.3 preview evidence — 2026-11-15

- 286 tests passed, one optional scientific test skipped (42 files: 41 passed, one skipped).
- VITE_LUNAR_STATIC=true production build passed. Existing large-bundle warning remains.
- New checks: viewer portal placement/collapse and original draft restoration; explicit placement; retained baseline survives edits and compares reevaluated report; mismatched assumptions warning; calendar presets/validation; daylight selection and obstruction rejection; half-open blackout intervals; measured educational ground curvature and missing-data flag.
- Existing JPL/terrain/engineering regression assertions were not loosened. An earlier full run encountered slow-test timeouts under load and was interrupted; isolated UI checks and subsequent full runs passed without timing/tolerance changes.
- No live browser/GPU or visual acceptance is claimed. Original educational models are illustrative archetypes; actual placement, mission geometry and lighting fidelity require separate validation. User checks are in UPDATE_V1_3.md.
- Independent Earth holdout remains failed. The optional test skip is not a pass or waiver. No competitor superiority/parity claim is made.
