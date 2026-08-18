#!/usr/bin/env node
// Copy storage files out of the Lovable-owned (old) Supabase project WITHOUT
// its service keys, which Lovable never exposes.
//
// How it works: you temporarily make the old project's private buckets public
// (one SQL statement in Lovable's SQL editor), export a file manifest (another
// SQL query), then this script downloads every file via the public URL and
// uploads it into the new suffolk-tennis project with YOUR service_role key.
//
// Usage:
//   NEW_SERVICE_ROLE_KEY="<legacy service_role JWT of the NEW project>" \
//   node scripts/pull-storage-from-lovable.mjs manifest.json
//
// manifest.json = the JSON output of the manifest query in docs/SUPABASE.md
// (an array of {bucket_id, name, mimetype}).
//
// Remember to flip the old buckets back to private afterwards.

import { readFileSync } from "node:fs";

const OLD_URL = process.env.OLD_SUPABASE_URL?.replace(/\/$/, "") || "https://wbwhjhqfkailkumcxmcq.supabase.co";
const NEW_URL = process.env.NEW_SUPABASE_URL?.replace(/\/$/, "") || "https://twtmkvorzpvwnznqzcrw.supabase.co";
const NEW_KEY = process.env.NEW_SERVICE_ROLE_KEY;
const manifestPath = process.argv[2];

if (!NEW_KEY || !manifestPath) {
  console.error("Usage: NEW_SERVICE_ROLE_KEY=... node scripts/pull-storage-from-lovable.mjs manifest.json");
  process.exit(1);
}
if (!NEW_KEY.startsWith("eyJ")) {
  console.error('NEW_SERVICE_ROLE_KEY must be the legacy service_role JWT (starts "eyJ"):');
  console.error("new project dashboard -> Project Settings -> API Keys -> Legacy API Keys tab.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!Array.isArray(manifest)) {
  console.error("Manifest must be a JSON array of {bucket_id, name, mimetype}.");
  process.exit(1);
}
console.log(`${manifest.length} file(s) in manifest.`);

const newHeaders = { Authorization: `Bearer ${NEW_KEY}`, apikey: NEW_KEY };

let copied = 0, failed = 0;
for (const item of manifest) {
  const bucket = item.bucket_id ?? item.bucket;
  const path = item.name ?? item.path;
  const src = `${OLD_URL}/storage/v1/object/public/${bucket}/${path}`;
  try {
    const dl = await fetch(src);
    if (!dl.ok) throw new Error(`download ${dl.status} (is the bucket public right now?)`);
    const body = Buffer.from(await dl.arrayBuffer());
    const contentType = item.mimetype || dl.headers.get("content-type") || "application/octet-stream";
    const up = await fetch(`${NEW_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: { ...newHeaders, "Content-Type": contentType, "x-upsert": "true" },
      body,
    });
    if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 200)}`);
    copied++;
    console.log(`  copied ${bucket}/${path} (${body.length} bytes)`);
  } catch (err) {
    failed++;
    console.error(`  FAILED ${bucket}/${path}: ${err.message}`);
  }
}
console.log(`\nDone: ${copied} copied, ${failed} failed.`);
if (failed) console.log("For failures: check the old buckets are set public, then rerun (uploads are upserts).");
process.exit(failed ? 1 : 0);
