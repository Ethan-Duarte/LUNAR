# Install and inspect the 1.1 preview

This patch is based on main commit a3a73c219827d014d94c3b80b77668975366fb63. It has not been pushed by the assistant. Keep your V1.0 folder as a backup.

## GitHub Desktop and Pages

1. Open your existing LUNAR repository in GitHub Desktop and fetch/pull main.
2. Choose Branch → New branch, name it `next`, and create it from main.
3. Extract the CONTENTS of this update into the repository folder. Merge folders and replace matching files. Do not nest the entire update inside another subfolder. Keep `.github` and every other folder in its original relative location.
4. Review the changed files in Desktop, commit as `Add LUNAR 1.1 engineering preview`, then Publish branch / Push origin.
5. GitHub Actions → Test and publish LUNAR should run on next. It tests the preview, builds the current main separately, and deploys main at the usual root with the new viewer under `/preview/`.
6. If GitHub blocks the next branch at the github-pages deployment environment, allow next under repository Settings → Environments → github-pages → Deployment branches and tags. This is necessary only if that environment restricts deployments to main.
7. Visit your existing Pages address followed by `preview/`. The title should say **LUNAR V1.1 Preview · Field Atlas**. The root remains the main build. A later main deployment removes the preview until next is deployed again.

Do not merge into main until the preview is accepted. Existing V1.0 validation documentation remains explicitly historical. If you have changed main after the base commit, review overlapping files before replacing them.

## Local prebuilt viewer

The update also includes the new prebuilt `app/index.html`, scripts/styles and worker. It reuses the unchanged data already in your complete V1.0 installation. Copy the update into a copy of that complete folder, then run START_LUNAR_V1.bat. The Git repository ignores generated app files; Pages builds from frontend source. A source-only checkout must generate app or reuse the existing V1.0 data directory before using the local launcher.

## First feedback session

- Basic → Sites: Study a historical site. Confirm the Sites tab stays selected.
- Switch to Surface at a custom coordinate. Check marker/camera alignment and terrain appearance on your graphics hardware.
- Advanced → Base → Load electrical tutorial → Evaluate design.
- Move the array using Move on map / terrain or numeric coordinates; inspect the connection and recalculate.
- Add a relay, choose fixed/movable components, test tower heights, and search nearby layouts.
- Try a deliberately insufficient array/battery and restrictive link range. Failures should be explicit.
- Set a March 14, 2025 study at the Blue Ghost region to inspect eclipse losses. Time-bin contacts are approximate.
- Save a complete project, change settings, reopen it and recalculate.

Model details and limits: ENGINEERING_V1_1.md. Full roadmap status: NEXT_VERSION_PROGRESS.md.
