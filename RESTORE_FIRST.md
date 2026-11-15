# Restore the complete GitHub repository

The earlier update was a PATCH. The failed deployment commit removed original code/data. This archive contains the COMPLETE V1.1 GitHub source and data, preserving the 45 updated source files exactly as pushed.

1. In GitHub Desktop, open LUNAR and select main. Use Repository → Show in Explorer.
2. Extract this archive to a temporary folder. Inside it, you should see frontend, engine, .github, README.md, LICENSE and other root files.
3. Copy ALL of those contents into the existing repository folder. Replace matching files. KEEP your existing .git folder; this archive does not include one. Do not put the extracted folder inside the repository as a new subfolder.
4. In Desktop, expect hundreds of restored files, including frontend/src/lib/geo.ts, frontend/src/lib/terrain.ts, frontend/src/ui/useSiteAnalysis.ts and frontend/public/data.
5. Commit as Restore complete source and data, then Push origin. Actions runs automatically.
6. Wait for build and deploy to succeed. Because your update was pushed to main, open the NORMAL Pages address, not /preview/. The next-branch preview workflow is optional later.

This is a complete GitHub-source archive, not the standalone batch release: app is generated and ignored by Git. GitHub Actions builds the website. Do not delete tests or change import paths to work around missing files. The checked source has 269 passing tests; the missing files caused the deployment failure before tests could run.

If you already have uncommitted work, preserve it before copying. The existing Git history remains intact, and the restoration is an ordinary new commit.
