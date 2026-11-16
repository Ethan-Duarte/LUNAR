# V1.8 rewrite experiment — NOT a provenance-cleared competition release

## Replacements in this checkpoint

- Globe.tsx now delegates to new LunarGlobe.tsx: independent globe shader and component, spherical tangent stencil for relief normals, NASA photograph and elevation, surface cutouts and camera exposure. No shared rendering shader is imported by the new globe. Its asset loaders and parent scene remain retained components.
- geo.ts: newly implemented spherical-coordinate, ENU and stereographic formula kernel.
- ephem.ts: newly implemented binary-table evaluator, interpolation and observer projection. The precomputed table remains retained, NOT independently regenerated.
- CSV filenames use LUNAR rather than the other project's product name.

These implementations were developed after exposure to the reference project and retain compatible interfaces. They are not a legally certified clean-room rewrite. Standard mathematical equations and interface compatibility do not establish independent provenance of the entire project.

## Explicit remaining dependencies

MoonTerrain (surface mesh and shadow shader), shading asset loaders, Rig/camera, MoonCanvas, sky bodies, browser horizon/disc/window/finder/landing algorithms, terrain lookup/decode modules, store foundation, inherited tests and prepared datasets remain wholly or partly shared/adapted. Historical upstream docs and required provenance remain. Replacing a few modules does NOT clear this combined package for competition submission.

Earlier Apache assertions were not independently established: the inspected upstream root did not contain a LICENSE at pinned commit 707b035fccbc7829c5ee4cf539c17f0d2d9bb652. Historical notices are retained as records, not new legal verification. Permission/competition eligibility remains unresolved.

## Acceptance

312 frontend tests passed, two skipped, after coordinate/sky replacements. CPU/DOM regression checks do not verify WebGL shader output. Static production build passed. No GPU appearance check was possible in this environment. Existing tests/fixtures include inherited reference checks, which are NOT original LUNAR validation work merely because they pass.

## Inspect immediately

Preserve your .git directory and replace the source files. Push through GitHub Desktop for Pages, or run START_LUNAR_V1.bat locally. Check the browser title says V1.8 Rewrite Test. Compare globe light/dark boundary, crater relief, poles and terrain joins against V1.7. Check Surface remains as before, pick a location, then play/pause and switch globe/surface. Keep V1.7 as a recoverable visual baseline.

Do not use this package's unchanged old README as a current eligibility declaration. It contains historical version claims. This document supersedes them for this experiment.
