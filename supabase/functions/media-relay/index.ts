// Media relay: calls the ElevenLabs API on behalf of the build environment,
// which cannot reach api.elevenlabs.io directly, and parks the response in
// public.media_renders for the build to read back over SQL.
//
// Guarded by app_settings.media_relay_guard (random, generated in the DB,
// never committed). Delete that row to switch the relay off. The API key
// lives only in the ELEVENLABS_API_KEY secret. Only paths under /v1/ and
// /v2/ of api.elevenlabs.io are allowed; the response is stored as JSON
// when the API returns JSON and as base64 otherwise (audio).
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Body = {
  guard?: string;
  name?: string;
  path?: string;
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "media_relay_guard").maybeSingle();
  if (!setting?.value || !body.guard || body.guard !== setting.value) return json({ error: "Forbidden" }, 403);

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return json({ error: "ELEVENLABS_API_KEY is not set" }, 500);

  const path = String(body.path ?? "");
  if (!/^\/v[12]\/[A-Za-z0-9_\-./]+$/.test(path)) return json({ error: "Path not allowed" }, 400);
  const method = (body.method ?? (body.body === undefined ? "GET" : "POST")).toUpperCase();
  const url = new URL(`https://api.elevenlabs.io${path}`);
  for (const [k, v] of Object.entries(body.query ?? {})) url.searchParams.set(k, String(v));
  const name = String(body.name ?? path).slice(0, 200);

  let status = 0, contentType = "", payload: unknown = null, dataBase64: string | null = null, error: string | null = null;
  try {
    const res = await fetch(url, {
      method,
      headers: { "xi-api-key": apiKey, ...(body.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body.body !== undefined ? JSON.stringify(body.body) : undefined,
    });
    status = res.status;
    contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      payload = await res.json();
    } else {
      const bytes = new Uint8Array(await res.arrayBuffer());
      // Chunked base64 so a multi-megabyte audio file does not blow the stack.
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      dataBase64 = btoa(bin);
    }
    if (!res.ok) error = `ElevenLabs ${status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const { data: row, error: dbError } = await admin
    .from("media_renders")
    .insert({ name, path, status, content_type: contentType, payload, data_base64: dataBase64, error })
    .select("id")
    .single();
  if (dbError) return json({ error: dbError.message }, 500);
  return json({ id: row.id, status, content_type: contentType, bytes: dataBase64 ? Math.floor(dataBase64.length * 3 / 4) : null, error });
});
