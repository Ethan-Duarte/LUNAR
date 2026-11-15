# Publish LUNAR V1.0 with GitHub Desktop

1. Extract this ZIP into a new folder. Keep all files together, including the hidden `.git` folder. Do not copy it over an older LUNAR checkout.
2. In GitHub Desktop, choose **File → Add local repository**, then select the extracted `LUNAR_V1.0_GitHub` folder (the one containing README.md). The prepared `main` branch and commits should appear.
3. Click **Publish repository**. Name it `LUNAR` (or another name you prefer), uncheck **Keep this code private**, and publish to your personal account. Do not initialize another repository inside this folder.
4. Open the repository on GitHub. Go to **Settings → Pages**. Under **Build and deployment → Source**, select **GitHub Actions**.
5. Open **Actions → Test and publish LUNAR**. Use **Run workflow** on `main`. If the initial automatic deployment failed because Pages was not enabled yet, rerun it now.
6. Wait for both `build` and `deploy` to turn green. The deployment summary and **Settings → Pages** display the live URL. Open that exact URL.

No Node, npm, Python or batch file is required on your work computer. GitHub builds the website from source. The archive also includes the already-built hosted viewer in `app/` for reference; generated files are deliberately ignored by Git. Do not double-click app/index.html.

## Check the published site

- The title is **LUNAR V1.0 · Field Atlas**, with Basic mode as the default.
- Globe and surface terrain load; switch repeatedly without losing the session.
- Move time, switch sites, pin comparisons and try a small Base layout.
- In Advanced → LUNAR science, open the saved studies and validation records.
- Run a study explains that new Python/SPICE calculations require the local edition. The online browser analyses and saved studies still work.
- If WebGL is disabled by your work computer, analytical controls can remain available but the 3D view will not render.

## Prepared Git state

- `main`: source, licenses, NASA-derived data, README, and deployment workflow.
- `v1.0.0`: local annotated baseline tag. GitHub Desktop may not publish an existing tag automatically. If a tag is needed later, open **Repository → Open in Terminal** and run `git push origin v1.0.0`.
- `next`: a separate local branch for the next release. Switch to it in GitHub Desktop before developing. Only `main` deploys to the public site.
- Python kernel binaries and local/generated files are ignored. Source checkouts download official kernels with `python engine/scripts/download_kernels.py`.

The source retains the disclosed Apache-2.0 technical foundation and its attribution. Independent Earth-map validation remains a documented failure, not a waived pass. This packaging step does not change scientific results.

After publishing, send me the repository URL and the Pages URL. I can check the deployed version and use the repository as the baseline for our next changes.

GitHub documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
