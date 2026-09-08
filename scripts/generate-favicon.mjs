// Regenerates app/favicon.ico from scripts/icon-source.svg (the light
// yellow/black app icon — favicons don't get a reliable dark variant across
// browsers, so we always use the light source, same as the header logo).
//
// Run after any change to icon-source.svg:
//   node scripts/generate-favicon.mjs
import sharp from "sharp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pngToIco from "png-to-ico";

const root = path.resolve(import.meta.dirname, "..");
const svg = fs.readFileSync(path.join(root, "scripts/icon-source.svg"));
const sizes = [16, 32, 48];

const tmpFiles = [];
for (const size of sizes) {
  const out = path.join(os.tmpdir(), `favicon-${size}.png`);
  // Rasterize well above target size then downscale, for crisper edges.
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  tmpFiles.push(out);
}

const ico = await pngToIco(tmpFiles);
fs.writeFileSync(path.join(root, "app/favicon.ico"), ico);
for (const f of tmpFiles) fs.unlinkSync(f);

console.log(`app/favicon.ico written (${ico.length} bytes, ${sizes.join("/")}px).`);
