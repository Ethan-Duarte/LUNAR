# LUNAR V1.4 preview — final historical pass

## Install

Complete source and bundled data, not a patch. Extract separately, copy the contents into your existing repository root, retain .git, commit and push main. Wait for Pages Actions to succeed, hard-refresh and confirm FIELD ATLAS / 1.4 PREVIEW. Read-only external repository access has not been used to publish this checkpoint automatically.

For local use, START_LUNAR_V1.bat, or `cd frontend`, `npm ci`, `npm run dev`, then the printed HTTP address. Generated app output and node_modules are excluded; launch/build recreates them. Live Python scientific studies still require their separate service/data.

## What changed

- Mission information moved out of the left numerical workspace into a collapsible, independently scrolling right-side panel. On narrow screens it becomes a bottom drawer. It retains the education tab when collapsed and resets content scroll on a new mission.
- Mission / Hardware / Landscape / Try it / Sources provide original copy, existing credited NASA photos, measured elevation spacing where available, and explicit separation of measured terrain from illustrative hardware.
- Historical scenes now default to simulation sunlight. Studio light is an explicit inspection option and does not change UTC. Find daylight remains available in the mission panel; it selects the mission observer first if necessary.
- Regional terrain uses the observatory's existing height-field shadow shader, NASA surface map, Sun direction and rendering detail setting. The local scene uses a body-fixed-to-local transform, applied in double precision before uploading local vertices, with camera exposure transformed back into the body-fixed frame.
- Spacecraft direct light is attenuated by the selected observer's terrain-disc visibility and modeled eclipse fraction. If its horizon is not available, direct spacecraft light is withheld. Contact shadows use a separate local shadow map. Leg pads and rover wheels sample the local support mesh; the crewed archetype has a ladder and robotic scenes have closer framing.

## First checks on Pages

1. Sites → historical landing → Study this location. Confirm a right-side mission file appears, not a long education card in Analysis. Scroll it independently. Collapse/reopen while on Hardware; the tab should remain. Browse missions should reveal the left library if hidden.
2. Change missions and confirm name, photo/notes, model and source links change together. Check Mission, Hardware, Landscape and Sources. Compare a crewed and robotic scene.
3. Simulation sunlight should be the initial mode. Record site and UTC. Compare terrain shadow direction with the normal surface view at that same UTC. Compare a lit time, near-sunrise time and night. Send screenshots plus site/UTC if the images disagree. Display shadows are approximations, not the numerical visibility verdict.
4. Find daylight at this site should work without manually finding the right observer first. Dates are reported in UTC; the study start/duration must not change. No result can be legitimate in the forward 60-day search.
5. Toggle studio light and return to simulation light. Studio makes hardware readable without pretending that the selected time is daylight. Return to terrain, reopen the expedition scene, switch Globe / South pole / Surface, and repeat.
6. Orbit close to footpads and check for floating/sinking, shadow acne, square shadow-map edges and terrain seams. Look at rover wheels on Apollo 15/16/17. Check a narrow window and a full-width viewer with Analysis hidden.
7. Regression: Open Project → cancel; tutorial card placement/collapse; calendar scrub range; Base evaluation, retained comparison and save/reopen. Existing numerical behavior should remain.

## Evidence and limits

294 automated tests passed and one optional scientific test skipped. Static build and clean extracted-source build must succeed before delivery. Logs: qa/v14. No live GPU/browser appearance verification is claimed.

Sharing the terrain renderer aligns implementation and conventions; it does not prove pixel equality across cameras or scientific shadow convergence. Regional shader rays have finite steps and tile coverage. Spacecraft illumination uses the observer horizon as a local approximation, not independently calculated horizons for every hardware surface. The local contact map is finite-resolution, terrain support is interpolated, and archetypes/poses are illustrative. A missing regional grid falls back to the simpler local measured mesh. No new spatial measurements, authentic touchdown attitude, traverse reconstruction or exact eclipse/terrain-mask integration are implied.

Historical feature additions are now frozen apart from blocking defects. Next work is fixed-input Earth holdout investigation, independent Base checks, optimization checks and first-time-user usability. No scientific acceptance thresholds were changed; the existing Earth holdout remains failed. See VALIDATION_NEXT.md.
