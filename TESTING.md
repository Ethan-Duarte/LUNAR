# Verification

## Automated

```sh
npm ci --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
```

For Pages, set VITE_LUNAR_STATIC=true for the build. Run `python -m pytest -q` from engine. On Linux with Mesa/EGL available, `python qa/render_shaders.py` compiles/links the replacement globe/surface shaders; despite the historical filename, it does not render or verify the live browser interface.

## User hardware

1. Confirm V1.9.1 and inspect globe relief, terminator, poles and terrain joins.
2. Toggle Deep shadows / Inspect in globe and surface views. Deep fill should stay dark as exposure changes.
3. Pick and change sites, orbit/zoom, switch views and inspect the gold observer marker.
4. Play/pause and scrub time; use Space/arrows outside form controls. Change analysis start explicitly.
5. Open historical scenes and check terrain placement and shadows.
6. In Advanced → Base, edit area/mast/storage, remove/undo a facility, calculate and compare the spatial examples.
7. Cancel project import; switch tabs; verify the page and current project remain usable.

Record build version, site/UTC, observer height, browser/GPU, expected behavior and a screenshot for a visual defect. Preserve console errors. See SCIENCE_STATUS.md for scientific limitations.
