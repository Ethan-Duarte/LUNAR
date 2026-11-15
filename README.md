# LUNAR

**Lunar Utility for Navigation, Analysis, & Reconnaissance — V1.0**

A lunar landscape is more than a promising coordinate. A habitat needs power, a power installation needs useful sunlight, and facilities need connections that work at the same time. LUNAR brings measured terrain, sky geometry and early infrastructure screening into one workspace.

V1.0 combines an original, restrained interface with an attributed open-source rendering/geometry foundation. It is a scientific screening prototype, not flight software or a certified mission-design system.

## Browser edition

The GitHub Pages edition runs without installation. Observe, Find, Compare, Base, Sites and the bundled scientific studies run in the browser. New exact-observer Python/SPICE studies, footprint screens and mast sensitivity jobs require the local edition; Pages does not host the Python API. Those controls are explicitly unavailable in the hosted edition.

Publishing is handled by `.github/workflows/pages.yml`: the locked dependencies are installed, frontend tests run, and a production build is deployed only from `main`. Other branches and pull requests run checks without changing the live site. In repository Settings → Pages, choose **GitHub Actions** as the source.

## Open the local atlas

Extract the complete release into a new folder and run **START_LUNAR_V1.bat**. Python 3 is required; the browser application is already built, so Node/npm is not needed to use the release. Keep the launcher console open and use the exact URL it prints, normally:

`http://127.0.0.1:5195/?build=lunar-v1.0`

The console prints the actual source folder. V1 uses a different port and build-specific URL to avoid accidentally reopening an older Atlas server. The browser title must read **LUNAR V1.0 · Field Atlas**. Do not open `app/index.html` directly. Run `CHECK_ATLAS.bat` to verify packaged files and Windows-safe module MIME types.

For new Python scientific studies, run **SETUP_SCIENCE.bat** once, then restart the launcher. The five official SPICE kernels are bundled. Native regional science DEMs download separately on demand (roughly 400 MB combined). Saved studies and the browser tools work without those regional downloads. Use a hardware-accelerated browser with WebGL 2 for 3D.

## A useful first session

1. In **Observe**, begin at Connecting Ridge or enter coordinates. Move the terrain camera independently of the gold observer marker.
2. Read Sun availability, Earth clearance and the shared 60-day timeline. Open the horizon explanation to inspect the terrain relationship.
3. In **Find**, describe the ground you need. Shortlisted points come from published long-term polar layers; they are not presented as date-specific mission certification.
4. Pin two or three observations and open **Compare**. Inspect matched availability, darkness, arrival windows and the effect of a schedule slip.
5. In **Base**, assign selected observations as habitat, power, resource, relay or landing facilities. Add nearby locations and compare alternative arrangements.
6. Switch to **Advanced** when you need shared disc/mask/height criteria, the Python workspace, footprint/mast studies, provenance or validation records.

Basic is the default. Both modes share the same observations, clock, camera and criteria; Advanced reveals additional controls rather than starting a different application. **Sites** is a separate factual reference catalog of historical and announced locations, not the default experience. Its planned entries reflect the supplied catalog and may be approximate or stale; source links remain attached.

## What the base tool calculates

| Quantity | V1 implementation | Interpretation |
|---|---|---|
| Facility spacing | Spherical surface distances | Not a traversable route |
| Connection tree | Minimum spanning tree over facility distances | Geometric infrastructure lower-bound proxy, not routed cable |
| Terrain LOS | Straight segments sampled against the measured terrain chain, with lunar curvature | No Fresnel zone, diffraction, antennas or RF budget; coarser inputs remain coarser |
| Concurrent availability | Hourly joint condition: all power sites sunlit and all habitats directly Earth-visible | No power storage, load flow or relay routing |
| Pad–habitat separation | User-selected exclusion radius | Planning constraint, not debris/plume safety |
| Alternatives | Named layout snapshots and JSON exports | Original assumptions remain in snapshots; restoring facilities recomputes under current settings |

V1 supports up to eight facilities. Add observations from other tabs without losing the layout. Save base JSON and layout alternatives before closing the page. Observation projects separately preserve sites, UTC, height, criteria and display settings. V1 does not yet capture an arbitrary free-orbit camera pose in a project file.

## Terrain and sky

The release includes whole-Moon LOLA elevation at the published native **5760 × 2880** grid (16 pixels/degree, approximately **1.90 km at the equator**), encoded without horizontal downsampling and with **0.5 m vertical quantization**. Grid spacing and quantization are not measurement accuracy. Detailed south-polar terrain and local 20/80/160 m patches take precedence where present. Resolution varies; finer interpolation does not create additional observed detail.

The global grid is prepared from [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720). The original source TIFF is reproducible using `tools/prepare_global_lola.py`; it is not required in the end-user archive. Source links and encoding metadata are retained in `app/data/globe/globe.json`.

Sun/Earth directions follow JPL DE440-based data. Main-scene sky sizes/distances are enlarged for visibility, and Earth texture orientation remains approximate. Numerical visibility is calculated from the observer, not inferred from enlarged display bodies. The long-term map overlays apply to the mapped south-polar area, not the entire Moon.

## Evidence before confidence

The scientific status is recorded in [SCIENCE_STATUS.md](SCIENCE_STATUS.md). Tests establish specific properties; passing a build or matching another model is not independent physical validation.

| Check | V1 result / boundary |
|---|---|
| Frontend regressions and new integration/math tests | 241 pass; the larger fixed-holdout audit is opt-in |
| Python regressions, including occulting-disc geometry | 64 pass |
| Exact fixed Earth holdout, supplied reference browser code | **FAIL:** RMS 3.13437 pp; bias +1.03381 pp |
| Same holdout with V1 native global elevation | **FAIL:** same results at these south-polar points |
| Archived LUNAR Python holdout | **FAIL:** RMS 3.16679 pp; bias +1.04327 pp |
| New Python eclipse smoke check | Real SPICE geometry produces total occultation on 14 March 2025 with a synthetic clear skyline; not an independent event-timing observation |
| Interactive 3D acceptance | Full hardware-browser rendering remains a user-hardware check; remote QA browser disables WebGL |

The holdout uses the same 185 saved reference points, 18.6-year period, 2 m observer, 300 km horizon and unchanged RMS/bias limits. Both browser configurations use the supplied reference geometry code and their corresponding terrain chains. The agreement narrows the discrepancy to shared modeling/reference issues; it does not establish which result is ground truth or prove a specific cause. Exact reference epoch/height metadata and terrain-product differences remain investigation items. Report and reproducible test: `qa/earth_holdout_cross_engine.json`, `frontend/src/lunar/holdout.audit.test.ts`.

### A versioned eclipse change

New Python single-site studies include analytic circular-disc Earth occultation. Terrain-visible fraction and eclipse-visible fraction are multiplied: an explicit approximation when both obscure different regions of the Sun. Refraction through Earth's atmosphere is omitted. Archived 180-day examples remain unchanged and retain their original terrain-only solar calculation. The sampled mast/footprint sensitivity endpoint also remains terrain-only. These outputs must not be silently interchanged.

## Development and reproducibility

See [CONTRIBUTING.md](CONTRIBUTING.md) for source setup and [ARCHITECTURE.md](ARCHITECTURE.md) for calculation boundaries. A typical development session uses the Python launcher and `npm ci && npm run dev` from `frontend`. The downloadable release includes a ready-to-use build under `app`. A source checkout generates it with `python tools/build_release.py` after building the frontend. Official kernels are downloaded with `python engine/scripts/download_kernels.py`.

- Frontend tests: `cd frontend`, then `npm test`.
- Python tests: `cd engine`, then `python -m pytest -q`.
- Production build: `cd frontend`, then `npm run build`.
- Fixed holdout: set `LUNAR_HOLDOUT=1`, then run the dedicated audit test; its SPICE ephemeris fixture is included.
- Original benchmark records and all three archived example JSONs remain available. Updated algorithms and archives are versioned separately.

## Sources, credit and originality

The V1 product interface, field-guide text, visual identity, SVG bearings, base-layout tool and observation-project workflow are LUNAR work. It does not use the reference project's welcome screenshots, mission prose, photos or spacecraft showcases.

The technical foundation adapts [daniel27-space/lunar-navigator](https://github.com/daniel27-space/lunar-navigator) under **Apache 2.0**, including substantial Three.js rendering, camera, browser geometry and planning algorithms. That contribution is explicitly credited, not represented as independently authored LUNAR code. Modified source, dependency licenses and original attribution are retained in NOTICE and THIRD_PARTY_LICENSES.txt. Code/documentation assistance was provided by OpenAI Codex; upstream assistance disclosures remain in the archival source documents.

Scientific sources include NASA LOLA / LROC, NASA GSFC PGDA, NASA Blue Marble and [JPL NAIF SPICE](https://naif.jpl.nasa.gov/naif/). Terrain products and mission-coordinate records retain their source metadata. The original project's documents are retained under `upstream-docs` for provenance, separate from this original README and LUNAR's claims.

## Further development

V1 is a usable baseline, not completion of the entire roadmap. Remaining work includes diagnosing the shared Earth-reference discrepancy, independent event timing checks, tiled higher-resolution global terrain, automatic connected-base optimization, routed infrastructure, operational relay paths, footprint robustness across entire layouts and validated plume/trajectory models. Planned capabilities must remain labeled as planned.
