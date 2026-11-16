# Horizon Wheel comparison — V1.6 checkpoint

**Conclusion: selected shared calculations agree; broad feature parity is not established.** LUNAR has a useful connected-base workflow, but DSN access, traverse planning and statistical terrain uncertainty are material gaps.

## Scope and evidence levels

Primary baseline: [NetRunnerXD/lunar-horizon-wheel](https://github.com/NetRunnerXD/lunar-horizon-wheel), inspected at commit **0c0c5f5c00e2be530f8e36053222883ebb402587**. LUNAR starting point: V1.5. Audit performed 2026-11-15, America/New_York. No competitor product source/assets were copied into LUNAR. An isolated checkout was used to execute its original tests and an original adapter audit.

- **Documentation claims:** [README](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/0c0c5f5c00e2be530f8e36053222883ebb402587/README.md) and [METHODS](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/0c0c5f5c00e2be530f8e36053222883ebb402587/METHODS.md) describe the intended workflows, data and validation. These are not treated as independently reproduced results.
- **Inspected implementation:** physics.ts, Operability.tsx, Traverse.tsx, NetworkView.tsx, CloneUncertainty.tsx, AdvancedViews.tsx and shipped data metadata. Primary links are below.
- **Actually reproduced:** original public test suite, **49 tests passed**; two original matched audits passed. This does not reproduce the full raw-data/SPICE pipeline or validate interactive UI behavior. No screenshot-based ranking is made.

## Capability comparison

| Capability | Horizon Wheel inspected code/data | LUNAR V1.6 status | Assessment |
|---|---|---|---|
| Terrain visibility | Site horizons and interpolated custom-site grid; finite limb-darkened Sun | Nested measured terrain, ray-cast horizons, finite uniform disc, eclipse product approximation | Different data and disc defaults; no blanket accuracy ranking |
| Battery and panel sizing | Vertical azimuth-tracking panel, charge loss and usable-capacity fraction | Tracking/horizontal options, initial SOC, charge/discharge losses, reserve, loads and connected delivery | Matched scalar case agrees; default results are not interchangeable |
| Free-space link budget | X/S band presets and representative DSN receivers | Adjustable RF parameters for ground links/Earth link | Matched scalar budget agrees; neither budget alone establishes station access |
| DSN station visibility | Shipped station-elevation series and station mask combined with site Earth visibility | No station-specific gating | Material gap |
| Joint timing | Sun, Earth, DSN and reserve masks | New delivered-solar, supplied-demand, reserve, Earth and selected joint timing lanes | Partial overlap. LUNAR allows battery-supported night work; no DSN/survival-probability claim |
| Relay coverage | Literature-calibrated one/two orbital-relay coverage formula | Ground-tower heights and terrain-cleared network paths | Different problems. LUNAR does not model orbital relays; a spatial ground link is not the peer's relay heuristic |
| Network optimization | Pareto site selection and union coverage over candidate sites | Bounded facility placement, array sizing, relay-height sweep and fixed components | Different objectives; neither is a substitute for the other |
| Traverse | Gated grid routing plus illustrative energy profile | No terrain-constrained rover route planner | Material gap |
| Terrain uncertainty | Shipped Barker clone ensembles and percentile summaries; resolution sensitivity | Common placement-offset robustness samples | Statistical clone uncertainty is a gap; offsets must not be called probabilities |
| Science/context layers | Ice fusion, thermal/heater and secondary-light indices; multilingual chrome and sonification | Historical education, global exploration and a connected-base emphasis | Additional competitor breadth; not independently validated here |

Code sources: [physics.ts](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/0c0c5f5c00e2be530f8e36053222883ebb402587/src/physics.ts), [Operability](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/0c0c5f5c00e2be530f8e36053222883ebb402587/src/Operability.tsx), [Traverse](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/0c0c5f5c00e2be530f8e36053222883ebb402587/src/Traverse.tsx), [NetworkView](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/0c0c5f5c00e2be530f8e36053222883ebb402587/src/NetworkView.tsx), [CloneUncertainty](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/0c0c5f5c00e2be530f8e36053222883ebb402587/src/CloneUncertainty.tsx), [AdvancedViews](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/0c0c5f5c00e2be530f8e36053222883ebb402587/src/AdvancedViews.tsx).

## Reproduced matched cases

1. **Battery:** identical generation trace, 100 W load, full initial state, 50% usable capacity, ideal charge/discharge and equal panel incidence. Horizon Wheel returns 600 Wh; LUNAR returns 599.999988 Wh (numerical sizing tolerance). This is an agreement under matched assumptions, not proof of all power behavior.
2. **RF:** identical 8.42 GHz, 384400 km, 10 W transmitter, 12 dBi transmit gain, 68.2 dBi receive gain, 33 K noise and 3 dB lumped losses. FSPL agrees within 1e-5 dB; C/N0 differs by 0.000833 dB, consistent with the rounded versus exact Boltzmann constant. No station geometry is compared.
3. **Controlled site:** 0° latitude/longitude, 2 m observer, zero-degree synthetic horizon, identical ephemeris vectors at hourly nodes, uniform solar disc, 720 samples during 2026-11-14 through 2026-12-14 exclusive. Mean visible Sun is 49.396115% versus 49.395736%; Earth-centre visibility is 100% in both. The declared tolerance was 0.01 percentage point. This explicitly avoids measured-terrain, default interpolation and solar-model differences; it is not a real-site validation or DSN comparison.

Reproduce with an isolated pinned peer checkout: install its locked npm dependencies, then run `python engine/scripts/run_horizon_wheel_match.py /absolute/peer/checkout` from LUNAR. The helper creates and removes one temporary original audit file in the peer checkout; tracked peer source is untouched. Raw outputs and logs are in qa/v16. The peer's full data pipeline and Horizons refresh were not rerun.

## Validation comparisons that must not be made

Horizon Wheel documents several different PGDA comparisons, including a broad grid and selected sites, using different raster resolutions, epochs, time steps and, for some solar crest comparisons, a neighborhood-selected pixel. LUNAR's 185-point fixed holdout cannot be ranked against those headline errors. Its own Earth holdout remains FAIL. The peer's test of saved pipeline fixtures is reproducible regression evidence, not an independent reconstruction of the reference map.

Implementation cautions matter too: the inspected traverse energy profile uses representative fixed generation/load values and node-average sunlight, not a fully time-resolved rover electrical simulation. Its orbital relay formula is literature-calibrated, not propagated relay geometry. Its joint operability requires sunlight even when a battery has charge; LUNAR's new timing screen instead permits night operation when power and selected contact requirements hold. These are scope differences, not grounds for declaring one overall winner.

## Specific next work

1. Add independently checked station-specific Earth/DSN access to LUNAR, with a distinct scheduling disclaimer and matched epochs. This is the highest-value communication gap.
2. Investigate the exact 60 m terrain and original metadata at the Earth-holdout outliers; do not alter fixed samples/thresholds to improve the score.
3. Add justified numerical/terrain sensitivity bands before any survival-probability language. Placement offsets alone are insufficient.
4. Add traverse planning only as a separate, explicitly approximate workflow after the base/network tool is well tested. Its battery simulation must use time-resolved conditions rather than imply a guaranteed safe route from mean illumination.
5. Keep improving LUNAR's spatial base design: explain selected array area, network topology, storage tradeoffs and failure intervals under identical settings. Do not dilute this into superficial copies of every peer tab.
