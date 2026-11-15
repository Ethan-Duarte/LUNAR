# LUNAR V1.2 preview — usability checkpoint

This is complete source, not a patch. Extract into a temporary folder. Copy its contents into the root of your existing GitHub Desktop repository, replacing matching files and keeping the existing .git folder. Do not delete the repository or nest the extracted folder inside frontend. Commit and push to main. Wait for the Pages workflow to finish, then hard-refresh. The interface must say FIELD ATLAS / 1.2 PREVIEW.

For local use: START_LUNAR_V1.bat, or `cd frontend`, `npm ci`, `npm run dev`. Open the HTTP address printed by Vite. Never double-click index.html. The Python scientific service and kernels remain necessary for live studies; Pages supplies the browser tools and bundled evidence/examples.

## First acceptance checks

1. Save your existing project. Open project, cancel the chooser repeatedly, then try a malformed JSON file. The interface should stay usable. Try both the main project and Base project controls. Report browser/OS and console text if it fails.
2. Inspect the same south-pole and historical surface locations as before, including aerial and instrument eye. The separate rectangular observer patch has been removed; one measured mesh is refined around the observer. Send a screenshot if a seam remains. Mesh refinement does not create new measured terrain resolution. This still needs hardware/WebGL acceptance.
3. In Advanced → Base, click empty map ground. It should inspect without adding anything. Select Add component, place once, then click again: the second click should not add. Select an existing component and use Move component for relocation.
4. Start guided Base lesson. Next should require placing the requested components and evaluating. Follow the insufficient-power step (zero array and battery, two days at 1 kW): expect 48 kWh unmet. Restore lesson power, evaluate, then save or return to your previous design. A full battery covering two days is not evidence of long-term solar autonomy.
5. Check a disconnected array: delivered generation can be zero even when sunlight exists. Inspect the named connectivity failures and red outlines. Zero unmet demand can coexist with failed connectivity when stored energy supplies the load.
6. Sites → Study this location: check Mission, Landscape, Try it and Sources. Switching educational tabs must not change simulation time or close Sites. NASA photos are historical context, not rendered landing reconstructions.

## Scope and limitations

The exact cause of the reported chooser-cancel blank screen was not reproduced. The input now ignores cancellation/empty selections, catches import errors, permits same-file retries, and interface/render error boundaries show recovery controls. Asynchronous WebGL/driver failures are not all caught by React boundaries.

This checkpoint does not change scientific acceptance thresholds or solve the independent Earth-visibility holdout failure. No competitor superiority claim is made. Automated tests cover DOM behavior, planner calculations and mesh-coordinate continuity; they do not certify visual quality or mission safety. Original historical prose and NASA-credited images replace use of competitor presentation assets. See NOTICE and ATTRIBUTION.md for the licensed technical foundation.

## Automated verification

277 tests passed; one optional holdout test skipped. Static production build passed with a large-bundle warning. Logs and limitations: qa/v12/ACCEPTANCE.md.
