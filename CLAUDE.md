# Study Notes — instructions for Claude

## ABSOLUTE RULE: NEVER START A DEV SERVER IN THIS REPO

`next dev` / `preview_start` / any file-watching dev server on this project
has crashed Samuel's machine TWICE (2026-07-03). Cause: ~1.2GB of recursive
Electron packaging output (`dist-app/`, `dist-server/`) sat inside the repo
and the dev watcher ballooned on it. Mitigated since: packaging now outputs
to `../study-notes-app-builds/` (outside the repo). The no-dev-server rule
stands regardless — do not relitigate it without Samuel's explicit OK.

- Do NOT run `npm run dev`, `next dev`, or the Claude preview tools here.
- Verification happens via the production standalone server only
  (`node dist-server/server.js` with PORT set), started briefly and killed
  immediately, or via `curl` against a server the user already runs.
- Kill every process you start the moment its check is done. Never leave
  test instances running across turns.
- `npm run build`, `npm run app:build`, `tsc` are fine (they terminate).

## Distribution (signing + notarization)

Builds output to `../study-notes-app-builds/` (NEVER inside this repo — see
rule above). Pipeline: `npm run build` → `node scripts/prep-electron.mjs` →
`npx electron-builder --mac` with env `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`
(parse from `~/Desktop/openclaw/workspace/memory/apple-signing-checklist.md`,
never print them), `APPLE_TEAM_ID=7352NBAF44`. Identity: "Developer ID
Application: Samuel Wang (7352NBAF44)". scripts/after-pack.cjs deep-signs the
native binaries inside Resources/app-server before the outer signature.
Verify with `spctl --assess` + `xcrun stapler validate`.

## Data safety

User data lives in `~/Library/Application Support/Study Notes/data`
(plain JSON). The repo-local `data/` folder is a frozen pre-migration backup —
do not modify either without explicit instruction. Never ship data inside the
app bundle (scripts/prep-electron.mjs strips it — keep that).
