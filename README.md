# LUNAR

**Lunar Utility for Navigation, Analysis, & Reconnaissance**

Explore measured lunar terrain and study how a connected outpost could share power and communications over time. Basic mode supports exploration and mission education; Advanced exposes engineering tools, assumptions and scientific evidence.

## What it does

- Globe and surface views with NASA imagery, terrain relief, calculated Sun/Earth directions and terrain shadows.
- Site screening, matched comparisons, arrival-window rankings and shared UTC playback.
- Connected facility layouts with solar-array area, mast height, storage/load assumptions, terrain-clear links, optional RF screening and eclipse-aware power.
- Bounded station-specific DSN geometry, joint timing lanes, outage inspection and portable project files.
- Historical mission notes and original illustrative expedition scenes.

## Run or publish

Read [START_HERE.md](START_HERE.md). GitHub Pages builds from source through GitHub Actions. Local Windows users run START_LUNAR_V1.bat and use its printed HTTP address. Never open an HTML file directly.

Current development checkpoint: **1.10.0**. Primary-data cleanup is in progress; see [PROVENANCE_PROGRESS.md](PROVENANCE_PROGRESS.md). Deep shadows have a bounded display fill; Inspect retains its brighter response. Those controls change appearance, not scientific results.

## How it was built

React and Three.js render NASA imagery and elevation maps. Python/SPICE calculations and browser ephemeris tables supply sky geometry; terrain horizons determine visibility. The Base model combines sampled connectivity with solar generation, storage, load and optional RF/DSN screening.

## Validation

[SCIENCE_STATUS.md](SCIENCE_STATUS.md) records the scientific evidence and open failure. [ENGINEERING.md](ENGINEERING.md) explains the base model; [TESTING.md](TESTING.md) lists reproducible checks and hardware acceptance.

The release suite has 126 passing frontend tests and two skipped audits; the last Python run passed 64 tests. The Earth-visibility holdout remains outside its declared error limits. See SCIENCE_STATUS.md for results, tolerances and model limitations.

## Sources

Data sources, development references, dependency credits and AI assistance are listed in [NOTICE](NOTICE).
