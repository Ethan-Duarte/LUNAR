# Next-version staged progress

## Checkpoint 1.1-preview.1

Implemented:
- Preserve the current workspace when locating a site; regression checked with the actual App component.
- Basic navigation emphasizes Observe/Sites; Advanced reveals Find/Compare/Base and scientific tools.
- Display-only observer-centred measured-terrain remesh; refresh camera elevation after terrain loads. Hardware acceptance still required.
- Lower Sun glare and near-black blue sky; resizable desktop analysis panel.
- Direct Base map/terrain placement, numeric facility editing, antenna/panel heights, array area, fixed anchors and facility undo/redo.
- Constant-load solar generation/storage model, finite-window battery and array recommendations.
- Explicit analytic eclipse fractions and eclipse-aware energy reporting.
- Bounded nearby-layout search, discrete tower-height sweep, geometric relay routing and optional free-space RF gate.
- Nine-point placement sensitivity, failures, terrain-source labels and approximate obstruction attribution.
- Base input recovery, full project exports/restoration and alternative snapshots.
- Original educational notes for three historical missions. Historical-site viewing explicitly retains simulation time.

Still pending from the full agreed roadmap:
- Hardware/browser visual acceptance and user usability feedback.
- Full arbitrary-region drawing, dense/adaptive/worker-budgeted optimization, Pareto engineering alternatives and stronger facility footprints.
- Full observation-project autosave/camera bookmarks; Base autosave currently preserves facilities/settings, while exports preserve the complete scenario.
- Finer streamed global elevation/imagery and dedicated north-pole products.
- Mission replay with sourced trajectory and historical ephemeris; broader original historical content.
- Landing ellipse and rover traverse planning; terrain-error ensembles and event uncertainty bounds.
- Station-specific DSN geometry/scheduling, realistic propagation and full electrical network/thermal/vehicle models.
- Root-cause resolution of the fixed Earth-map discrepancy and independent eclipse/event-time validation.
- Multilingual UI, complete accessibility audit, judge report/video/submission materials.

No claim of complete competitor parity or accuracy superiority is made. The development branch has not been pushed because the GitHub integration still returns 403.

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
