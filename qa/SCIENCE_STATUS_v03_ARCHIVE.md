# LUNAR Field Atlas v0.3 — scientific evidence ledger

Date: 2026-11-15. Renderer/UI integration is separate from scientific validation.

| Area | Status | Evidence / limit |
|---|---|---|
| Inherited browser engine regressions | PASS | Original 248 tests rerun on supplied data; JPL Horizons worst angular difference reported 0.00007°. These are upstream component fixtures, not fresh external measurements. |
| LUNAR integration / baseline audit | PASS | 9 tests: real server envelope, refined-event timeline duration, sample lookup, CSV, energy dimensions, and recorded cross-engine differences. |
| Original Python engine | PASS | 59 tests; numerical algorithms unchanged. |
| Original inputs / studies | PRESERVED | 38 scientific source/script/example files byte-identical; hashes in qa/science_integrity.json. |
| Official kernels | PRESENT | Five original NAIF kernels included; size checks and SPICE loading checked. |
| Full real API / 300 km study + footprint | PASS | Launcher/proxy round trip with actual kernels and native DEMs, one day / 25 samples; 100% horizon coverage. 100-m-radius footprint screen completes. Raw outputs in qa/real_api_*.json. |
| Native 20 m / real SPICE smoke study | PASS, bounded | 1 day / 5 km horizon / real kernels; not a global validation. Finite crop visual-export warning retained. |
| Shader compilation / offscreen render | PASS | Shipped MoonTerrain GLSL rendered from measured supplied data on Mesa EGL; Deep darker than Inspect. No browser GPU performance claim. |
| Live cloud browser | PARTIAL | WebGL is disabled in this browser. Controls and scientific UI can be exercised; actual interactive 3D on user hardware is still required. |
| Independent LUNAR Earth-map holdout | **FAIL — unresolved** | RMS 3.1668 pp > 3; bias +1.0433 pp > 1. Original reports retained unchanged. |
| Scenario-level independent validation | NOT PERFORMED | Archived results are modeled configuration-specific examples. |
| Browser/Python equivalence | NOT CLAIMED | Different terrain representations, event timing and eclipse treatment; audit records discrepancies. |

## Fixed three-scenario baseline

Matched coordinates, mast height, start/end dates, half solar disc, zero Earth-centre clearance, 300 km horizon and hourly left-hand samples (end excluded). Browser uses supplied nested PNG terrain; Python uses its archived native DEM chain. Browser includes approximate eclipses; original Python does not.

| Scenario | Browser minus Python hourly Sun | Browser minus Python hourly Earth | Browser longest darkness | Python refined longest darkness |
|---|---:|---:|---:|---:|
| Connecting Ridge, 2 m | −1.04167 pp | 0.00000 pp | 121 h | 118.69792 h |
| Connecting Ridge, 10 m | −0.04630 pp | 0.00000 pp | 95 h | 94.91667 h |
| Earth-facing control, 2 m | 0.00000 pp | +0.09259 pp | 566 h | 566.23958 h |

These are comparison results, not proof either engine is more accurate. Refined and hourly blackouts are not identical estimators. JSON: `qa/singapore_baseline.json`. Do not tune thresholds to make the engines agree.

## Modeling decisions

- A-001/A-002 in the archived v0.2 ledger are superseded for the UI: this release deliberately adapts the supplied Apache-2.0 renderer instead of continuing an independent reproduction.
- A-003: retain upstream frontend behavior, terrain assets, validation fixtures and documentation, with source/asset attribution and modified-file notices.
- A-004: original Python algorithms and archived numerical outputs remain unchanged. Long studies and their independent-validation status are exposed explicitly, not relabeled as upstream validated results.
- A-005: Deep shadow floor is display-only: albedo × 0.0015 instead of 0.03 in the same shared tone function. No scientific horizon or boolean visibility changes.
- A-006: retain separate browser and Python results because terrain chains, temporal resolution and eclipse modeling differ. Close the eclipse and independent Earth-holdout gaps before any blanket science-parity claim.
- A-007: no uniform-global-20-m claim. Native measured resolution remains explicit; further geometry interpolation is a rendering choice.
- A-008: source-backed guides and mission showcases are inherited features. Generated clouds / craft stand-ins / local showcase ground retain labels; illustrative sky enlargement does not alter scientific angular calculations.

## Next scientific acceptance work

1. Audit the independent Earth-map holdout against fixed coordinates, frame/orientation, horizon radius and published Earth-visibility definition. Keep its thresholds fixed.
2. Add and independently test an Earth-occultation model to a future Python-science version; preserve legacy archives and version the change.
3. Extend the existing cross-engine audit with identical measured terrain and event criteria before inferring algorithmic errors from the 2 m ridge difference.
4. Run fresh external JPL Horizons comparisons and independent terrain benchmarks for each claimed operational regime. No flight-grade certification is claimed.

Original v0.2 ledger: `qa/SCIENCE_STATUS_v02_ARCHIVE.md`. Original reports: `engine/reports/`. Supplied upstream validation: `upstream-docs/VALIDATION.md`.
