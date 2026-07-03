// Assemble the self-contained server bundle the Electron app ships, staged
// into dist-server/. Next's standalone output omits static assets and public/
// by design — copy them in. Any local data directories that tracing dragged
// in are stripped: user notes must NEVER ship inside the app bundle.
//
//   next build && node scripts/prep-electron.mjs && electron-builder --mac
import { cpSync, rmSync, existsSync, readdirSync } from "node:fs";

// Staged OUTSIDE the repo: gigabytes of packaging output inside the source
// tree once sent the Next dev watcher into a fatal memory spiral.
const standalone = ".next/standalone";
const stage = "../study-notes-app-builds/dist-server";
if (!existsSync(`${standalone}/server.js`)) {
  console.error("No standalone build — run `npm run build` first.");
  process.exit(1);
}

rmSync(stage, { recursive: true, force: true });
cpSync(standalone, stage, { recursive: true });
cpSync(".next/static", `${stage}/.next/static`, { recursive: true });
cpSync("public", `${stage}/public`, { recursive: true });
// NOTE: .env.local is deliberately NOT copied — the app ships in a public
// GitHub release, so no secrets may enter the bundle. The Anthropic key
// lives in the Supabase Edge Function (supabase/functions/import-outline).

// Belt and braces on top of outputFileTracingExcludes: user data must never
// ship, and packaging output nested inside the bundle recreates the
// app-inside-app recursion.
for (const entry of readdirSync(stage)) {
  if (entry === "data" || entry.startsWith("data.backup") || entry.startsWith("dist-")) {
    rmSync(`${stage}/${entry}`, { recursive: true, force: true });
    console.log("stripped", entry);
  }
}

if (!existsSync(`${stage}/node_modules/next`)) {
  console.error("staged bundle is missing node_modules — aborting");
  process.exit(1);
}
console.log("server bundle staged:", stage);
