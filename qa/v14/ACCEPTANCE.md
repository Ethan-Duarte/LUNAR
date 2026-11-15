# V1.4 historical closure evidence — 2026-11-15

294 tests passed; one optional scientific test skipped. Static production build passed with the existing bundle-size warning. Logs are adjacent.

New tests cover body-to-local metre/kilometre round trips, pre-upload terrain localization, azimuth convention, observer terrain occlusion, eclipse attenuation, missing-horizon behavior, support-triangle interpolation, source-resolution labels, simulation-light default, studio opt-in, mission panel controls and tab preservation. Existing Base, terrain and pointing regressions still pass. No numerical acceptance thresholds were changed.

DOM and CPU geometry tests do not compile/execute the WebGL shader or verify shadow-map quality on the user's hardware. Scene appearance, narrow-screen layout and contact-shadow defects require the user checklist in UPDATE_V1_4.md. Shared shading conventions are inspected code, not a claim of independently reproduced pixel equality.

Independent Earth holdout remains failed and unresolved. Skipping an optional audit is not a waiver or pass. VALIDATION_NEXT.md records the next scope without asserting new results.
