# LUNAR V1.7 preview

Replace the complete source tree with this archive, preserving your repository's .git directory. Use GitHub Desktop to review, commit and push. GitHub Actions builds Pages; wait for the green deployment before refreshing. Local Windows: START_LUNAR_V1.bat. Do not double-click frontend/index.html.

## Check this release

- Space toggles playback; Left/Right move 10 minutes, Shift+Left/Right one hour; Home/End use the visible timeline range. Form controls retain their normal keyboard behavior. Escape cancels placement and closes guidance.
- Changing viewing time no longer silently moves the analysis window. Use “Start analysis at viewing time” explicitly.
- Advanced → Base: use each facility's × to remove it, then Undo. Power facilities show their area.
- Load spatial demo · before, then calculate. Load after and calculate again. The relay/bus junction changes from 2 m to 10 m. Compare connectivity and unmet energy. This selected model example is not an engineered power cable design.
- Require station-specific DSN access only within 2026-11-01 to 2027-01-01 UTC. Out-of-coverage studies must refuse that calculation rather than invent access.
- Outage intervals touching a study boundary are lower bounds. Changing inputs clears stale reports.

312 frontend tests pass; two skipped. GPU rendering still needs your hardware review, including the adjusted original Apollo flag. No progressive global terrain tiles or integrated surface landers were added. The existing high-quality globe remains intact.

Licensed rendering components remain credited in NOTICE. Product exports now identify LUNAR. This is not a claim that the retained renderer has been independently rewritten.
