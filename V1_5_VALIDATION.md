# V1.5 reproducibility and open-science checkpoint

## Results actually reproduced

The fixed 185-point Earth audit completed for both browser terrain configurations. Both reproduce the prior RMS 3.134374 pp and bias +1.033812 pp: FAIL against unchanged 3 pp RMS / 1 pp absolute-bias limits. Correlation is recomputed separately in qa/v15/summary.json against the unchanged 0.98 minimum. No locations, reference values or acceptance thresholds were removed or tuned. The older Python holdout RMS 3.166787 pp remains archived, not replaced by a claim that the browser result fixes it.

The original NASA 5058×5058 Earth IMG was independently retrieved and all 185 saved reference values checked: exact value agreement, maximum latitude registration difference 2.56e-13 degrees and zero longitude difference. Raw SHA-256 and every row are in qa/v15/reference_registration.json. This rules out corruption of those archived samples/pixel centres, not a mismatch of reference calculation assumptions.

Two points (indices 10 and 147) account for 56.604% of the prior squared error. At index 10, Earth visibility is 28.534% at 2 m, 23.419% at 0 m, versus reference 5.568%. At index 147, it is 28.395% at 2 m, 14.678% at 0 m, versus reference 6.004%. The 0 m cases are diagnostics only. Neither matches the reference; height alone is insufficient. No new preferred observer height was selected to fit the data.

The original product label specifies DE421 mean-Earth/polar-axis coordinates, a 1737.4 km sphere, 60 m polar stereographic pixels and the LDEM_85S_060M elevation source. Our current terrain chain and ephemeris fixture differ. The label's START/STOP times describe source data and have not been established as the calculation epoch; it does not establish the calculation's observer height. These differences identify investigations, not a demonstrated cause. Both outliers use the polar terrain without a local mission patch; changing global fallback alone did not affect the fixed audit.

## Base checks

New closed-form cases reproduce: ten hours at 1 kW from 10 kWh stored with 80% discharge efficiency → 8 kWh supplied, 2 kWh unmet and 2 kWh discharge loss; 12 dark hours at 2 kW with 20% reserve and 80% discharge efficiency → 37.5 kWh required capacity, invariant under hourly versus 15-minute sampling; constant 2 kW generation and 1 kW load for two hours without storage → 2 kWh served and 2 kWh curtailed.

A deterministic nine-position synthetic-terrain search is checked for unchanged fixed anchor, every returned facility within the 0.1 km search region, and agreement with a separate full production-worker reevaluation. Its result is compared with the original under identical settings; non-increasing unmet demand and retention of an original feasible result are asserted. qa/v15/optimization.json records actual before/after outputs. In this one-day fixture, the original and proposal both have zero unmet demand and meet the selected constraints. The proposed area drops from 20 m² to zero because initially stored energy covers the finite mission. It is not an autonomous repeating-cycle base. A new report warning makes zero-area reliance explicit. This is one scenario, not proof of global optimization or independent validation of all physics. Existing tower-height, eclipse and network regressions also run.

64 Python component/regression tests passed. Regular frontend counts and logs are recorded in qa/v15/ACCEPTANCE.md. Audit test completion is distinct from scientific agreement: the Earth comparison is still FAIL.

## Reproduce

From frontend, run `npm ci` and `npm test`. For the full audit set environment LUNAR_HOLDOUT=1, then run `npx vitest run src/lunar/holdout.audit.test.ts --maxWorkers=1`. For the height diagnostic set LUNAR_SENSITIVITY=1 and run the corresponding earthSensitivity.audit.test.ts. Unset those variables afterward. The complete holdout takes several minutes.

From the root, run `python engine/scripts/audit_reference_registration.py` to recheck the original IMG (about 51 MB network transfer). It uses the original PDS label's pixel registration and scale. For Python regressions install engine/requirements.txt and run `python -m pytest -q` from engine.

## Primary sources inspected

- NASA product overview: https://pgda.gsfc.nasa.gov/products/69 — any visible portion of Earth; hourly averages over 18.6 years; georeferencing and product limits.
- Original label: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608_EARTH.LBL — archived verbatim in qa/v15/reference_earth.lbl.
- Original data: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608_EARTH.IMG — hash and sample checks retained, full image not bundled.

## Remaining work

Obtain the original calculation epoch/observer-height metadata; compare the exact 60 m reference terrain against our local profiles at the two outliers; quantify frame transformations and azimuth/ray sampling effects with independently justified settings. Validate Earthrise/Earthset events independently. No scientific correction has yet been justified.

Human usability and GPU visual acceptance are not established by these tests. Integrated true-scale landers are deferred: the ordinary surface approach has kilometre-scale camera limits and a minimum 10 m near plane; a reliable close approach needs camera/precision work. The separate local scene remains available. Historical feature work stays bounded.
