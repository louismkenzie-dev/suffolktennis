#!/usr/bin/env node
// Copy every storage object from the old Lovable-managed Supabase project to
// the new suffolk-tennis project, preserving bucket names and paths.
//
// Run locally (needs open internet + Node 18+). NEVER commit the keys.
//
//   OLD_SUPABASE_URL="https://wbwhjhqfkailkumcxmcq.supabase.co" \
//   OLD_SERVICE_ROLE_KEY="<old project service_role key>" \
//   NEW_SUPABASE_URL="https://twtmkvorzpvwnznqzcrw.supabase.co" \
//   NEW_SERVICE_ROLE_KEY="<new project service_role key>" \
//   node scripts/migrate-storage.mjs
//
// service_role keys: Supabase dashboard -> Project Settings -> API keys.
// Idempotent: uploads use x-upsert, so rerunning just overwrites.

const OLD_URL = process.env.OLD_SUPABASE_URL?.replace(/\/$/, "");
const OLD_KEY = process.env.OLD_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEW_SUPABASE_URL?.replace(/\/$/, "");
const NEW_KEY = process.env.NEW_SERVICE_ROLE_KEY;

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error("Set OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY, NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const oldHeaders = { Authorization: `Bearer ${OLD_KEY}`, apikey: OLD_KEY };
const newHeaders = { Authorization: `Bearer ${NEW_KEY}`, apikey: NEW_KEY };

async function listBuckets() {
  const res = await fetch(`${OLD_URL}/storage/v1/bucket`, { headers: oldHeaders });
  if (!res.ok) throw new Error(`list buckets: ${res.status} ${await res.text()}`);
  return res.json();
}

// The list endpoint is per-folder; recurse into folder entries (id === null).
async function listObjects(bucket, prefix = "") {
  const objects = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${OLD_URL}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...oldHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
    const entries = await res.json();
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        objects.push(...(await listObjects(bucket, path)));
      } else {
        objects.push({ path, contentType: entry.metadata?.mimetype });
      }
    }
    if (entries.length < 100) break;
    offset += 100;
  }
  return objects;
}

async function ensureBucket(bucket) {
  const res = await fetch(`${NEW_URL}/storage/v1/bucket/${bucket.id}`, { headers: newHeaders });
  if (res.ok) return;
  const create = await fetch(`${NEW_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...newHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ id: bucket.id, name: bucket.name, public: bucket.public }),
  });
  if (!create.ok) throw new Error(`create bucket ${bucket.id}: ${create.status} ${await create.text()}`);
  console.log(`  created bucket ${bucket.id} (public=${bucket.public})`);
}

async function copyObject(bucket, obj) {
  const dl = await fetch(`${OLD_URL}/storage/v1/object/${bucket}/${obj.path}`, { headers: oldHeaders });
  if (!dl.ok) throw new Error(`download ${bucket}/${obj.path}: ${dl.status}`);
  const body = Buffer.from(await dl.arrayBuffer());
  const contentType = obj.contentType || dl.headers.get("content-type") || "application/octet-stream";
  const up = await fetch(`${NEW_URL}/storage/v1/object/${bucket}/${obj.path}`, {
    method: "POST",
    headers: { ...newHeaders, "Content-Type": contentType, "x-upsert": "true" },
    body,
  });
  if (!up.ok) throw new Error(`upload ${bucket}/${obj.path}: ${up.status} ${await up.text()}`);
  return body.length;
}

let total = 0, bytes = 0, failed = 0;
for (const bucket of await listBuckets()) {
  console.log(`Bucket: ${bucket.id}`);
  await ensureBucket(bucket);
  const objects = await listObjects(bucket.id);
  console.log(`  ${objects.length} object(s)`);
  for (const obj of objects) {
    try {
      const size = await copyObject(bucket.id, obj);
      total++; bytes += size;
      console.log(`  copied ${obj.path} (${size} bytes)`);
    } catch (err) {
      failed++;
      console.error(`  FAILED ${obj.path}: ${err.message}`);
    }
  }
}
console.log(`\nDone: ${total} objects copied (${(bytes / 1024 / 1024).toFixed(1)} MB), ${failed} failed.`);
process.exit(failed ? 1 : 0);
