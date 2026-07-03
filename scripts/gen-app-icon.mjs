// Generate the macOS app icon (build/icon.icns) from the logo in
// public/favicon_io. The source PNG is a cream rounded square sitting on a
// black backing — we mask out the backing, keep the rounded square, and
// center it on a transparent 1024 canvas with the standard Big Sur margin.
//
//   node scripts/gen-app-icon.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const SRC = "public/favicon_io/android-chrome-512x512.png";
const ICON_FRAC = 0.86; // squircle size within the canvas (Big Sur grid ≈ 824/1024)
const INSET_FRAC = 0.035; // trims the black backing ring off the source
const RADIUS_FRAC = 0.22; // iOS/macOS-style corner radius

async function makeIcon(size) {
  const art = Math.round(size * ICON_FRAC);
  const inset = Math.round(art * INSET_FRAC);
  const r = Math.round(art * RADIUS_FRAC);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${art}" height="${art}">` +
      `<rect x="${inset}" y="${inset}" width="${art - 2 * inset}" height="${art - 2 * inset}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
  const squircle = await sharp(SRC)
    .resize(art, art)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: squircle, gravity: "center" }])
    .png()
    .toBuffer();
}

const iconset = "build/icon.iconset";
await mkdir(iconset, { recursive: true });
const macSizes = [
  ["icon_16x16.png", 16], ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32], ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128], ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256], ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512], ["icon_512x512@2x.png", 1024],
];
for (const [name, size] of macSizes) await writeFile(`${iconset}/${name}`, await makeIcon(size));
console.log("wrote", iconset);
execFileSync("iconutil", ["-c", "icns", iconset, "-o", "build/icon.icns"]);
console.log("wrote build/icon.icns");
