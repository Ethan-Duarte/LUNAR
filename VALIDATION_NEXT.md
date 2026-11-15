# Next checkpoint: science and usability

Historical feature work is frozen after V1.4, apart from blocking defects.

1. Reproduce the existing Earth holdout without changing locations, reference values, time span or thresholds. Audit the largest outliers, visibility definitions, terrain coverage, coordinate conventions and reference-product metadata. Report error contributions and unresolved causes. A threshold change is not a fix. Existing evidence: SCIENCE_STATUS.md and qa/earth_holdout_cross_engine.json.
2. Base: compare energy accounting, storage sizing, eclipse loss and tower-height/LOS responses against analytic or independent reference cases. Keep geometric visibility, RF assumptions and electrical connectivity distinct. Verify results survive export/reopen with explicit recalculation.
3. Optimization: use fixed seeds/scenarios; confirm bounds, fixed components and ranking priorities. Compare recommendations against original layouts under identical dates, loads, storage states, terrain and numerical settings. Report tradeoffs and failure cases, not only favorable examples.
4. Usability: ask a new user to choose a site, interpret a blackout, place a habitat/array/relay, evaluate a failure, improve it, compare and export. Record completion, wrong turns, help usage and misunderstood results. Repair observed friction before adding more controls.
5. Competition review: inspect current primary-source code and reproducible runs before claiming functional parity or superiority. Separate README promises, inspected implementation and reproduced outcomes.

No new scientific validation results are asserted in this planning file. The independent Earth holdout remains unresolved.
