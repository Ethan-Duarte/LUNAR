# Supplied Singapore baseline → LUNAR v0.3

Reference: user-supplied `lunar-navigator-main (1).zip`, not an assumed future main branch. The frontend is a direct Apache-2.0 adaptation, with explicit credit.

| Supplied feature | Included implementation | LUNAR treatment |
|---|---|---|
| Globe + measured polar/local terrain, ray-marched shadows | frontend/src/scene/{Globe,MoonTerrain,shading}.tsx/.ts | Same geometry/shadow implementation; adjustable darker fill |
| Sun, textured Earth, sky compass | scene/SkyBodies.tsx, landers/earth.ts, SkyCompass.tsx | Retained with native assets / illustrative size conventions |
| Mission sites, ground showcases, media / credits | Missions.tsx, Showcase*, public/data/missions* | Retained |
| Guides / welcome / Explore–Plan | ui/Tutorial.tsx, Welcome.tsx, store.ts | Retained; LUNAR identity / isolated saved preferences |
| Shared criteria, observer height, current sky + windows | ui/useSiteAnalysis.ts, lib/assumptions.ts, windows.ts | Retained browser engine; LUNAR Python results separately labeled |
| Finder and map layers | ui/FinderPanel.tsx, lib/finder.ts, public/data/layers | Retained published-layer scoring and source labels |
| Two / three site comparison | ui/Compare.tsx, lib/verdict.ts | Retained |
| Landing-date / delay planning | ui/WhenToLand.tsx, lib/landing.ts | Retained |
| Playback, scenario links, CSV export | App.tsx, lib/shareLink.ts, exportScenario.ts | Retained |
| Upstream science pipeline / evidence | upstream-pipeline/, upstream-docs/, original browser tests | Preserved and credited, not claimed as original LUNAR validation |
| LUNAR long-duration studies / refined events | frontend/src/lunar/, engine/lunar/mission_analysis.py | Added workspace; original numerical outputs retained |
| LUNAR exact surface observer, footprint / mast sensitivity | engine/lunar/{geometry,terrain_screen,trade_study}.py | Added API tools and exports |
| LUNAR independent validation / provenance | SCIENCE_STATUS.md, engine/reports/, qa/ | Failures and differences remain visible |

All upstream feature implementations are included; integration/UI and automated data checks pass. Full interactive GPU parity remains a hardware-browser acceptance task. No claim is made that separate Python calculations are numerically identical to the browser engine.
