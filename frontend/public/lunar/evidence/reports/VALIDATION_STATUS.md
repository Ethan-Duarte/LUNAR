# LUNAR: current landscape and completed numerical validation

**Outcome:** LUNAR v0.9.1 reaches numerical parity with the Singapore project on its published 185-point NASA-map benchmark and four literature ridge cases. A separate fixed random sample reveals a remaining Earth-visibility failure. This supports parity on the specified tests, not superiority over every project or a blanket accuracy claim.

## What was actually run

Official NAIF kernels, native NASA LOLA terrain, NASA average-visibility and permanent-shadow rasters, and fresh live JPL Horizons queries were obtained and used. Competitor implementation code was not imported or executed. The common benchmark uses only public numerical coordinates and outputs as a documented comparison set.

| Check | Outcome | Evidence |
|---|---|---|
| Global surface-observer pointing | PASS | Seven sites × eight dates × Sun/Earth; 112 numerical comparisons, fresh Horizons replies saved. |
| Common NASA comparison | PASS | Same 185 coordinates, 18.6-year interval, 2 m observer, any-disc rule, NASA 120 m reference. |
| Published ridge points | PASS | Four coordinates and heights; 19 years; 20 m terrain near the observer. |
| Spatial convergence | PASS for registered case | 0.5 vs 0.25 degree at 300 km on the original ridge coordinate using 80 m near terrain. |
| Independent 185-point sample | FAIL overall | Sun passes; Earth RMS and bias narrowly exceed the thresholds fixed before this run. |
| Software verification | PASS | 50 Python cases, 19 JavaScript cases; production React/Vite build succeeded. |

The source and data hashes, settings, raw replies and point-level residuals are included in the accompanying patch. Synthetic tests establish numerical/software behavior; they are not counted as independent lunar terrain evidence.

## 1. Pointing against JPL Horizons

| Body | Cases | RMS altitude error | Maximum altitude error | Maximum on-sky error |
|---|---:|---:|---:|---:|
| Sun | 56 | 9.85e-08° | 3.36e-07° | 7.2e-07° |
| Earth | 56 | 1.7e-07° | 5.05e-07° | 5.11e-07° |

The on-demand geometry now applies light time and stellar aberration at the actual surface observer with SPICE `spkcpo`. The old Moon-centred-vector subtraction approximation was already small, but this removes its approximately 0.1 arcsecond Earth residual. Horizons and LUNAR still share JPL-family ephemeris information, so this is an independent service/implementation check, not independent observational ground truth.

## 2. Same benchmark as the Singapore project

NASA reference rasters were downloaded independently. Same coordinates, dates, height and disc rule are used on both sides. LUNAR traces its own horizons and computes its own series. The peer column is calculated from its published numerical output; their whole pipeline was not rerun.

| Metric against NASA | LUNAR | Singapore published output |
|---|---:|---:|
| Sun RMS difference | 2.6749 pp | 2.6741 pp |
| Sun correlation | 0.987572 | 0.987569 |
| Sun mean bias | +0.6814 pp | +0.6780 pp |
| Earth RMS difference | 2.7707 pp | 2.7714 pp |
| Earth correlation | 0.992555 | 0.992553 |
| Earth mean bias | +0.5097 pp | +0.5116 pp |

Here pp means percentage points, not relative percent error. Across all 185 points, the maximum difference between LUNAR and the peer output is 0.0196 pp for Sun and 0.0374 pp for Earth. These differences are negligible compared with the terrain/reference discrepancies.

The reference comparison uses **any part of Earth visible**, matching the NASA product. The operational LUNAR card uses **Earth-center clearance**. Those are intentionally different quantities.

## 3. Published Connecting Ridge cases

Native 20 m terrain was cropped without resampling from the official NASA COG; 80 m and 240 m measured terrain supply the surrounding region. Published coordinates were used directly, without searching for a more favorable point.

| Spot / height | Published time in light | LUNAR time in light | Published longest darkness | LUNAR longest darkness |
|---|---:|---:|---:|---:|
| spot1 / 2 m | 92.00% | 91.731% | 4.58 d | 4.708 d |
| spot2 / 2 m | 92.30% | 92.164% | 4.62 d | 4.667 d |
| spot3 / 10 m | 95.60% | 95.652% | 3.08 d | 3.042 d |
| spot4 / 10 m | 95.66% | 95.679% | 3.17 d | 3.167 d |

The published EPSC abstract specifies 20 m terrain, 0.5 degree horizons, hourly steps and a roughly 19-year period, but not its start epoch. Our 2024-start cycle and the modern NASA adjusted terrain are therefore an analogous replication, not an exact rerun of the original inputs. These four results satisfy the preselected 1 pp sunlight/mean-disc and 0.5 d darkness criteria.

At spot 2, the 80 m control gives 8.54 days of longest darkness; the 20 m run gives 4.67 days. The fine terrain changes the ground height under the observer by about 1.12 m. This reproduces the resolution sensitivity identified by the Singapore project. The any-disc benchmark does not validate a half-disc number by substitution; both definitions are stored separately.

## 4. Independent holdout: the remaining failure

A fixed-seed, uniform-area sample of 185 points inside a 140 km polar cap was selected. Coordinates were snapped to their 60 m reference pixel centres before reading the map value. No point was dropped for having an unfavorable residual, and no best nearby pixel was substituted. This set is separate from the peer coordinates.

Acceptance criteria fixed before this run: for each body, RMS ≤3 pp, absolute mean bias ≤1 pp, correlation ≥0.98. These were chosen after seeing the published comparison; this is not a blind or independently preregistered study.

| Quantity | Sun | Earth |
|---|---:|---:|
| RMS difference | 2.0735 pp | 3.1668 pp |
| Mean bias | 0.8065 pp | 1.0433 pp |
| 95th percentile absolute difference | 4.2798 pp | 5.4487 pp |
| Largest absolute difference | 13.8354 pp | 23.3745 pp |
| Correlation | 0.9912 | 0.9892 |

**Sun passes. Earth fails:** RMS is 3.167 pp and bias +1.043 pp. The original limits are retained. The largest local Earth error is 23.37 pp; an excellent overall correlation does not certify an individual location.

The NASA label explicitly defines any-disc visibility but does not specify the simulation start/end or observer height. It also identifies a legacy 60 m elevation model, different from the modern adjusted 80 m terrain in this run. These are unresolved reference/model differences, not proven explanations for every residual. Follow-up must separate height, local terrain and datum effects rather than changing thresholds to obtain PASS.

Permanent-shadow diagnostic on the same set: 23 NASA PSR points reproduced, two missed, 160 non-PSR points reproduced, no false PSR classifications: 183/185 agreement. This is descriptive; no PSR acceptance threshold was set beforehand.

## 5. Changes that are implemented in the patch

- Exact surface-observer SPICE correction for on-demand studies and the pointing benchmark.
- Analytic disc-area integration against the stored angular skyline, checked at 481 positions against the closed-form circular segment and against independent adaptive quadrature.
- Measured multi-resolution DEM chain, bilinear native-pixel sampling, 20 m near-field marching and 0.5 degree / 300 km defaults.
- A native 20 m ridge crop, with source URL/window and crop checksum. It does not cover the whole south pole.
- Five-minute interior event scans plus one-minute transition brackets; a short-window test confirms detection between equal-state output samples. Events shorter than the scan step remain a stated limit.
- Display meshes sampled from the same DEM chain and origin as the physics.
- Regression and build fixes, version/provenance metadata, reproducible scripts and a Windows launcher.

The long-cycle driver retains the separately bounded Moon-centre correction approximation for bulk calculations and uses hourly endpoint-excluded samples, as stated in its source. The live API uses exact surface-observer corrections and the finer event scan. Benchmarks validate specific configurations and numerical components; they do not turn every previously generated static survey into a v0.9.1 result.

## 6. What remains before a stronger overall claim

1. Diagnose and resolve the holdout Earth residuals at fixed coordinates; preserve the failed run.
2. Quantify native DEM height/effective-resolution uncertainty and sensitivity across a small landing footprint.
3. Add independent dated shadow-image checks and eclipse validation. No source examined here establishes precise real-terrain rise/set clock times at these sites.
4. Extend validation across more locations and mission dates.
5. Evaluate the actual public user flow and GPU display separately from the successful production build.

The Singapore numerical benchmark is matched. Kestro remains a useful target for uncertainty and observational evidence. No claim of being better than every project is supported yet.

## Scientific source register

- [NASA JPL NAIF surface-observer geometry](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkcpo_c.html): read; production method.
- [NASA JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html): read; live numerical reference and conventions.
- [NASA PGDA south-pole adjusted LOLA products](https://pgda.gsfc.nasa.gov/products/90): read; native 20/80/240 m data.
- [NASA PGDA lunar polar illumination](https://pgda.gsfc.nasa.gov/products/69): read; average-visibility/PSR reference rasters downloaded and scaling applied.
- [NASA PDS Sun map label](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608.LBL): read; any-disc definition, scale and legacy terrain provenance.
- [Gläser et al., EPSC2014-136-1](https://meetingorganizer.copernicus.org/EPSC2014/EPSC2014-136-1.pdf): read; four published ridge coordinates/heights and statistics.
- Gläser et al., Icarus 243 (2014), DOI [10.1016/j.icarus.2014.08.013](https://doi.org/10.1016/j.icarus.2014.08.013): bibliographic reference; full article not independently read in this run.

## Competitive landscape snapshot

Search snapshot: the current session, during the November 14–15, 2026 event.
Discovery used current web search and GitHub repository search. Seven additional
repository READMEs were inspected beyond the already-known Singapore project;
the stronger projects' validation documents were read as well. This is a public
snapshot, not an exhaustive census or a ruling on competition eligibility.

| Project | Publicly stated status | Evidence relevant to LUNAR |
|---|---|---|
| [Singapore Lunar Navigator](https://github.com/daniel27-space/lunar-navigator) | 2026 Space Apps entry, Singapore | Detailed SPICE/Horizons comparison; 185-point NASA comparison; published ridge benchmark and native 20 m patches; browser/reference consistency tests. |
| [Kestro Aerospace / Lunar Site Navigator](https://github.com/Littiary/lunar-site-navigator) | 2026 Space Apps entry, Aachen | Validation card reports 31/32 checks passing, including 95,676 Horizons rows and NASA-map checks. The LROC image-strip classification check fails at 89.3% vs 90%. Also reports uncertainty bands, terrain checkpoints and footprint sensitivity. |
| [Lunar Horizon Wheel](https://github.com/NetRunnerXD/lunar-horizon-wheel) | Space Apps-related tool; README and validation history include pre-event development | Reports a 3,721-point map check, Sun RMSE 4.55 pp and Earth 6.63 pp, plus uncertainty, DSN, energy and traverse features. The stronger 3.54 pp site metric chooses the best NASA pixel within 150 m; it must not be compared with an exact-coordinate residual. |
| [LUNAR//OPS](https://github.com/RootVandal/lunar-ops) | Explicitly says independent project, not a hackathon submission | Requirements-to-feasible-date solver, terrain/DSN geometry, NASA DEM-clone ensembles and reported Horizons checks. Its four-site map ranking comparison is explicitly indicative, with a different averaging interval. |
| [Lunar Lighting Planner](https://github.com/astoreyai/lunar-lighting-planner) | Explicitly says independent project, not submitted for judging | Wide date coverage, site/date slip analysis, native terrain, uncertainty and operational verdicts. Reports Earth pointing residual up to 0.006 degrees, larger than LUNAR's current direct-observer residual. |
| [Lunar Horizon](https://github.com/localizedprojects/CLPS-MOON-BROWSER) | README describes a 2026 challenge entry; also documents development before the event | Flutter web/Android planner, published validation data, NASA layers, whole-Moon sites, eclipse logic, reusable numerical library and large reported test suites. Timing/eligibility is not adjudicated here. |
| [LuminaLuna](https://github.com/Planet-Coders/lunar-landing-site-navigator) | Space Apps challenge project | Uses Horizons directly for site comparison; explicitly excludes terrain obstruction and finite discs from its visibility calculations. |
| [M9nx Lunar Landing Site Navigator](https://github.com/M9nx/lunar-landing-site-navigator) | Research/prototype planning | README says validated lunar calculations are not enabled. It is not a numerical-accuracy benchmark yet. |

## Strongest standards to match

The bar is broader than a good-looking Moon viewer or a small pointing error:

1. Reproducible, matched-source numerical comparisons with visible failures.
2. Near-field terrain resolution, realistic observer height and coverage checks.
3. Correctly distinguished any-disc, half-disc, mean-disc and Earth-center rules.
4. Long-cycle statistics plus operational blackout durations and short events.
5. Uncertainty in terrain and landing location, with traceable assumptions.
6. A usable public result with source metadata and exportable evidence.

LUNAR now matches the Singapore numerical examples evaluated in this update.
Kestro's uncertainty and observational checks remain a useful next benchmark;
matching Singapore's table does not demonstrate superiority over every tool.

## Inspected primary project evidence

- [Singapore ephemeris validation](https://github.com/daniel27-space/lunar-navigator/blob/main/docs/research/ephemeris-validation.md)
- [Singapore terrain validation](https://github.com/daniel27-space/lunar-navigator/blob/main/docs/VALIDATION.md)
- [Singapore saved NASA comparison](https://github.com/daniel27-space/lunar-navigator/blob/main/pipeline/validation/results/study_a.json)
- [Kestro validation card](https://github.com/Littiary/lunar-site-navigator/blob/main/validation/card/validation_card.md)
- [Lunar Horizon Wheel validation](https://github.com/NetRunnerXD/lunar-horizon-wheel/blob/main/docs/validation.md)
- [LUNAR//OPS validation](https://github.com/RootVandal/lunar-ops/blob/main/docs/VALIDATION.md)

Project-reported results above were inspected in repository documentation and
where noted saved outputs/tests. Their entire pipelines were not independently
rerun. LUNAR's results in `reports/validation_v091` were actually computed here
from official NASA/JPL inputs.

