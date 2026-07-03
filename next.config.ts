import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build (.next/standalone) — the Electron shell
  // bundles and forks it, so the desktop app runs fully offline.
  output: "standalone",
  // A stray package.json in the home directory makes Next infer the wrong
  // workspace root; pin it so the standalone layout is stable.
  outputFileTracingRoot: path.join(__dirname),
  // Keep user data and any packaging output out of the standalone bundle —
  // the tracer once pulled dist-app INTO the server bundle, creating a
  // recursive app-inside-app tree.
  outputFileTracingExcludes: {
    "*": ["data/**", "data.backup*/**", "dist-app/**", "dist-server/**"],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

// NOTE: dist-app/ (~600MB) and dist-server/ (~400MB) are Electron packaging
// outputs with nested node_modules. Next has no watch-ignore option for them,
// so never run more than one dev server against this project at a time.

export default nextConfig;
