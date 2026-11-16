# V1.6 preview — compared capabilities and connected-base timing

Complete source: copy contents into your existing repository root, preserve .git, commit/push main, wait for Actions and hard-refresh Pages. Confirm 1.6 PREVIEW. Local start remains START_LUNAR_V1.bat. Live Python studies require their own service/data as before.

## What changed

- Base has delivered-solar, supplied-demand, reserve, Earth-contact and selected joint timing lanes with failure inspection. Battery-supported night work is allowed. No DSN access or survival probability is implied; slope/separation and other constraints remain in the full verdict.
- Load 30-day power case starts Connecting Ridge on 2026-11-14 UTC, 1 kW, 250 kWh capacity at 20% initial charge/reserve, hourly samples, 20 m² array. Save your existing layout before loading. The co-located electrical demonstration deliberately relaxes Earth and slope gates. With actual shipped JPL/LOLA inputs, 0 m² leaves 672.5 kWh unmet; 20 and 40 m² supply modeled demand. This is finite-period electrical evidence, not a certified base or sustainable repeating-cycle guarantee.
- Battery input now says Modeled battery capacity, distinguishing capacity from usable reserve and starting charge.
- Original Apollo 11 flag geometry uses 13 stripes and 50 stars. Its scene position is illustrative. Mission notes explain that hardware appears in Expedition scene; ordinary Surface remains measured terrain plus markers.
- A pinned Horizon Wheel audit distinguishes documentation, inspected implementation and reproduced results. Its original 49 tests passed, plus two matched adapter tests. Battery, RF and a controlled flat-horizon site agree under aligned assumptions; no full feature/accuracy parity claim is made.
- Independent NASA eclipse-event check: Moon-centre minimum separation at 06:59 UTC on 2025-03-14, versus published 06:58:41.7 UT, on a one-minute grid with a predeclared five-minute tolerance. Interior/exterior phase checks agree. Global eclipse contacts are not local surface contacts; this is not full contact-time validation.

## First user checks

1. Sites → Apollo 11 → Open expedition scene → Find daylight if needed. Inspect the flag and its shadow; ordinary Surface should still be described as terrain-only. Confirm mission information still overlays without resizing.
2. Advanced → Base: save your project, then Load 30-day power case and Evaluate. Inspect the new timing lanes. Earth contact is not required in this demonstration; its lane remains informative.
3. Retain the baseline. Set array area to zero, evaluate and inspect joint failures. Expect 672.5 kWh unmet with unchanged inputs. Restore 20 m² and reevaluate. Compare with 40 m²: more generation can become curtailment rather than a better result.
4. Change initial charge/reserve or dates and confirm comparison assumptions flag the change. Export and reopen, then recalculate. Cancel another import to check recovery remains intact.
5. Return to the full constraint verdict: a good timing fraction must not hide slope, separation or missing scientific inputs. Contact is geometric/selected RF screening, not station-specific DSN scheduling.

## Evidence and limits

HORIZON_WHEEL_AUDIT.md is the primary comparison report; qa/v16 contains pinned provenance, raw matched cases, month outputs and logs. New normal regression checks cover joint masks, night battery operation and longer energy balance. Existing Earth holdout failure is unchanged and was not rerun again for this checkpoint; V1.5 retains the full audit.

Hardware visual acceptance and unassisted usability remain user checks. Orbital relay geometry, DSN station gating, terrain-clone probabilities and traverse routing have not been added. These gaps are explicit next work, not implied features.
