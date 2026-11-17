# Run LUNAR

## Existing GitHub repository

1. Back up your current checkout. Preserve its .git directory.
2. Replace the complete project source with this package. Copying over files alone leaves retired files behind. This ZIP does not contain a .git directory.
3. Review additions, changes and deletions in GitHub Desktop; commit and push to main.
4. In GitHub Settings → Pages, use GitHub Actions. Wait for the build and deployment to succeed, then open the Pages URL.
5. Confirm the title reads V1.10.0. Check globe/surface switching and Deep shadows.

## Local Windows

Run START_LUNAR_V1.bat, keep its console open and use the exact HTTP URL it prints. Do not double-click an HTML file. For new Python calculations, run SETUP_SCIENCE.bat and restart. GitHub Pages supports browser calculations and bundled studies; it does not run the Python service.

## Development

Use Node/npm to install and build the frontend:

```sh
npm ci --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
```

For a static hosted build, set VITE_LUNAR_STATIC=true before the build. Python checks run from engine with `python -m pytest -q`. See TESTING.md for the rest of the checks.
