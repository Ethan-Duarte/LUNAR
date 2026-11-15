# LUNAR V1.3 preview — exploration and Base comparisons

## Install / publish

This ZIP contains the complete source and bundled datasets. Copy its contents into the root of your existing GitHub Desktop repository, replacing matching files while retaining .git. Do not delete the repository or nest another frontend directory. Commit and push to main, wait for GitHub Actions to succeed, then hard-refresh Pages. Confirm FIELD ATLAS / 1.3 PREVIEW.

Local launch: START_LUNAR_V1.bat. Alternatively, in frontend run `npm ci` then `npm run dev` and open the printed HTTP URL. Live Python studies still require the scientific service/data; Pages supports bundled evidence and browser calculations. The ZIP intentionally excludes generated app output and node_modules; launch/build regenerates output.

## First user checks

1. Advanced → Base → Start guided Base lesson. The card should appear inside the viewer below Globe / South pole / Surface, rather than covering Analysis. Collapse/Expand, Show this control, Back/Next and Exit / restore should work. Scroll the analysis controls while the card remains in the viewer. Switching workspace hides the card and retains lesson progress.
2. Sites → open Historical landings → Study this location. Information should scroll into view. Landed missions open a dedicated expedition scene with an original LUNAR crewed or robotic lander archetype. Apollo 15/16/17 include an illustrative rover. Orbit and zoom. These are recognizable teaching models, not flight-accurate spacecraft, verified vehicle placement or historical mission replays.
3. Switch Studio light / Simulation sunlight. Studio light deliberately keeps the teaching model readable and is labeled illustrative. Simulation sunlight uses the selected UTC Sun; it can be dark. Return to observatory or Globe / South pole / Surface restores the measured explorer. Inspect this surface in the education panel opens the normal terrain view. No competitor spacecraft assets are used in the new scene.
4. Find daylight searches forward up to 60 days, hourly, for the complete solar disc above the selected observer's terrain horizon and no material eclipse. It reports the UTC sample and leaves scientific study dates unchanged. No result is legitimate at some polar sites. This is a viewing shortcut, not an exact sunrise solver or continuous-light guarantee.
5. Scrub range → Day / Week / Month / Full range, or enter UTC start/end and Apply. Only the viewing/scrub range changes. If a new range excludes the current clock time, Apply pauses and moves to its nearest endpoint. Playback/external time jumps carry the scrub range forward when needed. Study dates remain separately controlled in Analysis/Base.
6. Base → Evaluate design → Keep current result as comparison baseline. Change a component, evaluate again, then inspect baseline/current columns. A renamed/moved component invalidates the old current result; it should prompt reevaluation. Changing dates, initial battery state or other settings produces an assumptions-differ warning. Comparison evidence is included in export but imported reports are never treated as live recalculated results. Baseline retention is session-only and clears on project import.
7. Base report → Inspect blackout intervals. Jump to a sampled unmet-power or Earth-contact-loss interval. The viewer clock and habitat location change, not the study period. Intervals outside the safe viewer clock range are reported instead of pretending to jump. First 30 intervals of each kind are shown; export retains the full samples.

## Comparison / science limits

Base tables show individual tradeoffs, not an unvalidated composite score. Search rankings explain their priorities and must be reevaluated after applying. Settings equality is necessary but does not prove identical terrain coverage. Network corridors, finite-window battery sizing and geometric Earth visibility retain the previously documented model limits. No physical thresholds changed; the independent Earth holdout remains failed.

The expedition scene uses the same available measured terrain source, sampled on a local curved grid, with synthetic surface material and clearly labeled original vehicle archetypes. It adds no measured spatial resolution and does not claim authentic landing attitude, hardware dimensions, rover placement or full terrain-shadow convergence. Missing terrain samples are labeled and use a level fallback. WebGL hardware/appearance acceptance remains a user check.

The V1.2 cancellation safeguards and repaired observer mesh remain in place. No automated deployment has been performed.

## Automated checks

286 tests passed, one optional scientific test skipped. Static production build passed with the existing bundle-size warning. Evidence and limitations: qa/v13/ACCEPTANCE.md. Hardware appearance and usability acceptance remain your checks above.
