// Regenerates every PNG/ICO icon asset from the two source SVGs
// (icon-source.svg = light, icon-source-dark.svg = dark).
//
// Every output is flattened to a fully opaque background. Apple explicitly
// says not to ship an alpha channel in a home-screen (apple-touch-icon)
// image: iOS Safari fills any transparent pixel with black before applying
// its own corner mask, so a source with baked-in rounded corners (leaving
// the four corner triangles transparent) renders with black corners on the
// home screen — in both light and dark mode, since both source SVGs had the
// same issue. The W3C "maskable" manifest icon spec has the same
// full-bleed-no-transparency requirement. Let each OS apply its own mask
// instead of pre-baking one into the artwork.
//
// Run after any change to icon-source*.svg:
//   node scripts/generate-icons.mjs
import sharp from "sharp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pngToIco from "png-to-ico";

const root = path.resolve(import.meta.dirname, "..");
const iconsDir = path.join(root, "public/icons");

const variants = [
  { source: "icon-source.svg", background: "#FACC15", suffix: "" },
  { source: "icon-source-dark.svg", background: "#111111", suffix: "-dark" },
];

async function render(svgPath, background, size) {
  return sharp(fs.readFileSync(svgPath), { density: 384 })
    .resize(size, size)
    .flatten({ background })
    .png();
}

for (const { source, background, suffix } of variants) {
  const svgPath = path.join(root, "scripts", source);

  for (const size of [192, 512]) {
    const out = path.join(iconsDir, `icon-${size}${suffix}.png`);
    await (await render(svgPath, background, size)).toFile(out);
    console.log(`wrote ${path.relative(root, out)}`);
  }

  const touchOut = path.join(iconsDir, `apple-touch-icon${suffix}.png`);
  await (await render(svgPath, background, 180)).toFile(touchOut);
  console.log(`wrote ${path.relative(root, touchOut)}`);
}

// favicon.ico always uses the light variant — favicons don't get a
// reliable dark variant across browsers, same as the in-app header logo.
const faviconSvg = path.join(root, "scripts/icon-source.svg");
const tmpFiles = [];
for (const size of [16, 32, 48]) {
  const out = path.join(os.tmpdir(), `favicon-${size}.png`);
  await (await render(faviconSvg, "#FACC15", size)).toFile(out);
  tmpFiles.push(out);
}
const ico = await pngToIco(tmpFiles);
fs.writeFileSync(path.join(root, "app/favicon.ico"), ico);
for (const f of tmpFiles) fs.unlinkSync(f);
console.log(`wrote app/favicon.ico (${ico.length} bytes)`);
