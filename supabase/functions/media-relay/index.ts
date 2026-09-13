// Outbound relay for the build environment, which has no route to the
// services this project depends on. It calls an allowed API on our behalf and
// parks the response in public.media_renders for the build to read over SQL.
//
// Guarded by app_settings.media_relay_guard (random, generated in the DB,
// never committed). Delete that row to switch the relay off. Keys live only
// in edge-function secrets and never leave this file.
//
// Services:
//   elevenlabs  api.elevenlabs.io   ELEVENLABS_API_KEY  (xi-api-key)
//   resend      api.resend.com      RESEND_API_KEY      (Authorization: Bearer)
//
// A `batch` of items is processed one after another, each stored as its own
// media_renders row.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SERVICES: Record<string, { host: string; secret: string; auth: (k: string) => Record<string, string> }> = {
  elevenlabs: { host: "api.elevenlabs.io", secret: "ELEVENLABS_API_KEY", auth: (k) => ({ "xi-api-key": k }) },
  resend: { host: "api.resend.com", secret: "RESEND_API_KEY", auth: (k) => ({ Authorization: `Bearer ${k}` }) },
};

type Item = {
  name?: string;
  service?: string;
  path?: string;
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
};
type Body = Item & { guard?: string; batch?: Item[] };

async function relay(admin: ReturnType<typeof createClient>, item: Item) {
  const svcName = (item.service ?? "elevenlabs").toLowerCase();
  const svc = SERVICES[svcName];
  if (!svc) return { error: `Unknown service ${svcName}` };
  const apiKey = Deno.env.get(svc.secret);
  if (!apiKey) return { error: `${svc.secret} is not set` };

  const path = String(item.path ?? "");
  // Read-and-send paths only; no admin surface of either API.
  if (!/^\/(v[12]\/)?[A-Za-z0-9_\-./]+$/.test(path)) return { error: "Path not allowed", path };
  const method = (item.method ?? (item.body === undefined ? "GET" : "POST")).toUpperCase();
  const url = new URL(`https://${svc.host}${path}`);
  for (const [k, v] of Object.entries(item.query ?? {})) url.searchParams.set(k, String(v));
  const name = String(item.name ?? path).slice(0, 200);

  let status = 0, contentType = "", payload: unknown = null, dataBase64: string | null = null, error: string | null = null;
  try {
    const res = await fetch(url, {
      method,
      headers: { ...svc.auth(apiKey), ...(item.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
    });
    status = res.status;
    contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      payload = await res.json();
    } else {
      const bytes = new Uint8Array(await res.arrayBuffer());
      // Chunked base64 so a multi-megabyte response does not blow the stack.
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      dataBase64 = btoa(bin);
    }
    if (!res.ok) error = `${svcName} ${status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const { data: row, error: dbError } = await admin
    .from("media_renders")
    .insert({ name, path, status, content_type: contentType, payload, data_base64: dataBase64, error })
    .select("id")
    .single();
  if (dbError) return { name, error: dbError.message };
  return { id: row.id, name, status, content_type: contentType, bytes: dataBase64 ? Math.floor(dataBase64.length * 3 / 4) : null, error };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "media_relay_guard").maybeSingle();
  if (!setting?.value || !body.guard || body.guard !== setting.value) return json({ error: "Forbidden" }, 403);

  if (Array.isArray(body.batch)) {
    const results = [];
    for (const item of body.batch.slice(0, 20)) {
      let r = await relay(admin, item);
      // One retry after a short wait if a plan's concurrency limit bit.
      if (r.status === 429) { await new Promise((res) => setTimeout(res, 4000)); r = await relay(admin, item); }
      results.push(r);
    }
    return json({ results });
  }
  return json(await relay(admin, body));
});
