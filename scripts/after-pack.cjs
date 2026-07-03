// electron-builder afterPack hook: copy the staged Next standalone server
// into the app's Resources verbatim. Done here because electron-builder's
// own copiers always ignore node_modules, which the server needs to run.
// Runs BEFORE code signing, so the native binaries inside the server are
// deep-signed here first — notarization rejects any unsigned Mach-O, and
// they must be signed before the outer app seals its Resources.
const { cpSync, rmSync, existsSync, readdirSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const IDENTITY = "Developer ID Application: Samuel Wang (7352NBAF44)";

function* machoFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* machoFiles(p);
    else if (/\.(node|dylib)$/.test(entry.name)) yield p;
  }
}

exports.default = async (context) => {
  if (context.electronPlatformName !== "darwin") return;
  const dest = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    "Contents",
    "Resources",
    "app-server",
  );
  rmSync(dest, { recursive: true, force: true });
  cpSync("../study-notes-app-builds/dist-server", dest, { recursive: true });
  if (!existsSync(path.join(dest, "node_modules", "next"))) {
    throw new Error("app-server missing node_modules after copy");
  }
  console.log("afterPack: bundled server ->", dest);

  if (process.env.SKIP_SIGN === "true") return;
  for (const file of machoFiles(dest)) {
    execFileSync("codesign", [
      "--force", "--sign", IDENTITY,
      "--options", "runtime",
      "--timestamp",
      file,
    ]);
    console.log("afterPack: signed", path.relative(dest, file));
  }
};
