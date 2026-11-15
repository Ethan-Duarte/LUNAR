# Architecture and calculation boundaries

The browser application is an original LUNAR interface around an attributed rendering/geometry foundation adapted from daniel27-space/lunar-navigator (Apache 2.0). It does not use the upstream welcome UI, guide screenshots, mission narratives, media or vehicle showcases.

- `frontend/src/App.tsx`: Basic/Advanced workspace, observations, finder, matched comparisons, arrival dates, site reference library and shared clock.
- `frontend/src/lunar/BasePlanner.tsx`, `network.ts`: facility assignment, geometric spanning tree, sampled terrain LOS, simultaneous power/Earth availability, layout snapshots and portable exports.
- `frontend/src/lunar/ScienceWorkspace.tsx`: preserved LUNAR long-duration archives plus requests to the Python service. It is persistently mounted so switching tools does not discard a completed study.
- `frontend/src/scene/`: attributed Three.js geometry, DEM shadows and camera foundation; original LUNAR bearings are in `lunar/LunarCompass.tsx`.
- `frontend/src/lib/`: attributed browser ephemeris, horizon, disc visibility, finder and landing-window algorithms, plus their tests.
- `engine/lunar/`: original LUNAR Python science core. V1 adds `eclipse.py` and integrates its occultation fraction into new `mission_analysis` results.
- `run_atlas.py`: local static server and private science proxy. Each launch owns a science-service port; V1 uses a distinct frontend port and build-specific URL.

## Data and model distinctions

The browser uses precomputed DE440 Moon-centred vectors with observer projection. New Python single-site studies use the retained exact-observer SPICE path. Browser and Python terrain representations, eclipse approximations and temporal integration differ. A matched time period and observer height do not automatically make outputs interchangeable.

Archived 180-day studies remain byte-identical and retain their earlier terrain-only Sun model. New Python studies include exact two-circle overlap in a small-angle sky plane, multiplied by terrain-visible fraction. That product is approximate when Earth and terrain simultaneously mask different portions of the Sun. Neither model includes refracted sunlight.

The independent Earth-map holdout remains an explicit unresolved test until evidence supports a changed conclusion. Regression success is not observational validation.

## Base-planner interpretation

The shortest tree minimizes sums of great-circle surface distances. It does not route cable or a rover around obstacles. Radio LOS samples straight 3D segments against the available terrain chain, including curvature; interpolation does not add measurement detail. It excludes Fresnel clearance, antenna patterns, diffraction and RF budgets. Relay nodes participate geometrically but V1 does not find operational relay routes.

Simultaneous availability is the joint sampled condition: all listed power facilities sunlit AND all habitats directly Earth-visible. It is not the product of independent percentages, nor a power-flow or communications-reliability simulation. One-hour sampling may miss short events. User-selected landing-zone exclusion circles are constraints, not plume predictions.
