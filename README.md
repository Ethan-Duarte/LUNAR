# LUNAR — Field Atlas V1.9 rewrite experiment

Lunar Utility for Navigation, Analysis, & Reconnaissance.

Explore measured lunar terrain, then study whether a connected facility layout can share power and communications over time. Basic mode presents exploration and mission education; Advanced exposes the Base tools and scientific evidence.

**Start with [REWRITE_STATUS.md](REWRITE_STATUS.md). This is a substantial rewrite checkpoint needing visual acceptance, not a claim of eligibility or mission readiness.**

## Run

GitHub Pages: Settings → Pages → GitHub Actions. Push to main and wait for the deployment workflow. Local Windows: START_LUNAR_V1.bat; use its printed HTTP address. Source build: `npm ci --prefix frontend`, then `VITE_LUNAR_STATIC=true npm run build --prefix frontend`. Tests: `npm test --prefix frontend`. Python scientific checks: from engine, `python -m pytest -q`.

## Explore and plan

Pick a point and inspect the gold observation marker, skyline and Sun/Earth timeline. Space toggles playback; arrow keys step time. Viewing time and analysis start are separate. Sites contains LUNAR's mission notes and illustrative expedition scenes.

Advanced → Base: place habitat, arrays, relays and other facilities; set area, mast height, loads and storage assumptions; calculate and compare layouts. The spatial before/after example demonstrates a selected connectivity change, not engineered cable routing. DSN geometry is bounded to November–December 2026 and excludes actual scheduling. All planning outputs are screening results.

## Evidence

The rewrite release suite has 126 passed tests and two skipped. See qa/v19 for logs and REWRITE_STATUS.md for the retired legacy tests. The independent Earth-map holdout remains an explicit FAIL. No screenshot-based superiority or broad competitor parity is claimed.

Data: NASA LOLA/LROC/SLDEM2015, Blue Marble, JPL SPICE/DE440, Horizons and DSN. Metadata and source links accompany the data. Browser ephemerides can be regenerated with engine/scripts/build_browser_ephemeris.py using the five official kernels.

## Provenance

Earlier releases incorporated another project's technical implementations. V1.8–V1.9 replaced the active rendering and browser calculation paths; prepared NASA rasters and reference vectors retain external provenance. Read [NOTICE](NOTICE), [ATTRIBUTION.md](ATTRIBUTION.md) and the rewrite record. This is not a certified clean-room rewrite. OpenAI Codex assisted implementation. Library dependencies retain their licenses.

The project remains a scientific prototype; boulders, bearing strength, vehicle dispersions, actual cable construction, plume transport, thermal survival and operational DSN schedules are not established by these models.
