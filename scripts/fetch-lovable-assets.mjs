#!/usr/bin/env node
// Recover image binaries that Lovable's repo export left behind.
//
// Lovable exported 30 images (logo, coach photos, tour artwork, ...) as
// *.asset.json placeholders whose `url` is a relative /__l5e/assets-v1/...
// path that only resolves on Lovable's own hosting — so on Vercel those
// images 404. This script, run on a machine with open internet:
//
//   1. downloads every missing binary from the live Lovable site,
//   2. rewrites `import x from "@/assets/foo.png.asset.json"` imports to the
//      real file and `x.url` usages to `x` (the only field ever used),
//   3. deletes the placeholder .asset.json files.
//
// Usage, from the repo root:
//   node scripts/fetch-lovable-assets.mjs
//   node scripts/fetch-lovable-assets.mjs --base https://your-site.lovable.app
//
// Then review `git diff`, commit, and push — Vercel redeploys with the images.
//
// Requires Node 18+ (built-in fetch). Idempotent: already-downloaded files are
// skipped, and the import rewrite only runs once every binary is present.

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";

const ASSETS_DIR = "src/assets";
const SRC_DIR = "src";

const argBase = process.argv.indexOf("--base");
const BASES = argBase !== -1 && process.argv[argBase + 1]
  ? [process.argv[argBase + 1]]
  : ["https://suffolktennis.online", "https://suffolk-tennis-hub.lovable.app"];

const placeholders = readdirSync(ASSETS_DIR)
  .filter((f) => f.endsWith(".asset.json"))
  .map((f) => {
    const meta = JSON.parse(readFileSync(join(ASSETS_DIR, f), "utf8"));
    return { jsonFile: join(ASSETS_DIR, f), realFile: join(ASSETS_DIR, f.replace(/\.asset\.json$/, "")), meta };
  });

console.log(`Found ${placeholders.length} asset placeholders.`);

let failures = 0;
for (const { realFile, meta } of placeholders) {
  if (existsSync(realFile) && statSync(realFile).size > 0) {
    console.log(`  skip (exists)  ${realFile}`);
    continue;
  }
  let saved = false;
  for (const base of BASES) {
    const url = base.replace(/\/$/, "") + meta.url;
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn(`  ${res.status} from ${url}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      // Guard against an SPA fallback page being served instead of the image.
      if (buf.length < 100 || buf.slice(0, 15).toString().toLowerCase().includes("<!doct")) {
        console.warn(`  HTML/too-small response from ${url}`);
        continue;
      }
      writeFileSync(realFile, buf);
      const expected = meta.size ? ` (expected ${meta.size})` : "";
      console.log(`  saved ${buf.length} bytes${expected} -> ${realFile}`);
      saved = true;
      break;
    } catch (err) {
      console.warn(`  fetch failed for ${url}: ${err.message}`);
    }
  }
  if (!saved) { failures++; console.error(`  FAILED: ${realFile}`); }
}

if (failures > 0) {
  console.error(`\n${failures} asset(s) could not be downloaded — leaving imports untouched so the build keeps working.`);
  console.error(`Fix the base URL (--base https://<your-lovable-site>) and rerun.`);
  process.exit(1);
}

// Every binary is present — rewrite the imports and drop the placeholders.
console.log("\nAll binaries present. Rewriting imports...");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(entry.name) ? [p] : [];
  });
}

let rewrittenFiles = 0;
for (const file of walk(SRC_DIR)) {
  let text = readFileSync(file, "utf8");
  const importRe = /import\s+([A-Za-z0-9_$]+)\s+from\s+"(@\/assets\/[^"]+)\.asset\.json"/g;
  const idents = [];
  let match;
  while ((match = importRe.exec(text)) !== null) idents.push(match[1]);
  if (idents.length === 0) continue;

  text = text.replace(importRe, 'import $1 from "$2"');
  for (const id of idents) {
    text = text.replace(new RegExp(`\\b${id}\\.url\\b`, "g"), id);
  }
  writeFileSync(file, text);
  rewrittenFiles++;
  console.log(`  rewrote ${relative(".", file)} (${idents.join(", ")})`);
}

for (const { jsonFile } of placeholders) unlinkSync(jsonFile);

console.log(`\nDone: ${placeholders.length} images restored, ${rewrittenFiles} source files rewritten, placeholders removed.`);
console.log(`Now: npm run build   (sanity check), then commit and push.`);
