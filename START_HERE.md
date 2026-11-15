# Run LUNAR V1.0

1. Extract the entire release into a **new folder**.
2. Double-click **START_LUNAR_V1.bat**. Keep its console open. Open its printed URL, normally http://127.0.0.1:5195/?build=lunar-v1.0 .
3. Confirm the browser title is **LUNAR V1.0 · Field Atlas** and **Basic** is selected. No welcome carousel should cover the workspace.
4. Click **Begin at Connecting Ridge**. Use Globe / South pole / Surface and the bottom UTC timeline. Graphics acceleration / WebGL 2 is required for 3D.
5. For new Python studies, run **SETUP_SCIENCE.bat** once, restart, switch to **Advanced**, then open **LUNAR science**. Five SPICE kernels are bundled; regional native DEMs may download roughly 400 MB once.

## First checks

- Observe: select a point; inspect Sun/Earth readings and horizon explanation.
- Compare: pin two points; compare matched 60-day results, arrival dates and schedule slips.
- Base: assign a habitat, return to Observe for another point, then assign a power facility. Confirm the layout survives tab and mode changes. Inspect distances, terrain LOS, exclusion conflicts and joint availability. Save alternatives / export JSON before closing.
- Sites: optional factual catalog, not the default screen.
- Save/open an observation project to retain scientific assumptions and time.

## If startup fails

Open PowerShell in the folder containing run_atlas.py:

```powershell
py -3 run_atlas.py --self-test
py -3 run_atlas.py --port 5195 --open-browser
```

Use the exact URL printed, including the build query. The launcher prints the folder it serves and rejects an older app HTML. If Python has no `py` launcher, use `python` instead. Never open app/index.html directly or reuse an old Atlas bookmark.

## Scientific limits

The fixed Earth-map holdout remains FAIL for both the supplied reference browser code and V1; the shared discrepancy is under investigation. New Python single-site studies include Earth occultation with a documented combined-mask approximation; archived studies and sampled sensitivity remain terrain-only. Base links and separation constraints are screening results, not reliable RF/debris safety predictions. See SCIENCE_STATUS.md.
