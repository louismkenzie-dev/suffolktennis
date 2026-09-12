// A fake Supabase at the network layer for the showcase recording: the same
// technique as the QA harness. The app's real bundle runs unchanged; every
// call to the project host is answered from fixtures.mjs, Google Fonts are
// allowed through (the brand type must load), and any other non-local host
// gets a fast 204 so nothing external ever appears in a frame.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { REF, STORAGE_KEY, T, USERS, authSession, functionResponse, rpcResponse } from "./fixtures.mjs";

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT_CACHE = path.join(HERE, "out", "fonts-cache");

const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range, x-supabase-api-version" };

/* ------------------------------------------------------------------ */
/* Google Fonts                                                         */
/* ------------------------------------------------------------------ */

// Chromium's TLS handshake to fonts.googleapis.com is reset by the build
// environment's egress proxy, while curl gets through. So font requests are
// relayed through curl (which honours HTTPS_PROXY) and cached on disk under
// out/fonts-cache, keyed by URL + user agent (Google serves woff2 CSS only to
// a browser UA). A re-record therefore needs no network at all for fonts.
async function relayFont(route) {
  const req = route.request();
  const url = req.url();
  const ua = req.headers()["user-agent"] ?? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
  const key = createHash("sha1").update(`${url}|${ua}`).digest("hex");
  const bin = path.join(FONT_CACHE, `${key}.bin`);
  const meta = path.join(FONT_CACHE, `${key}.json`);
  const serve = (contentType, body) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=31536000", "content-type": contentType }, body });
  try {
    if (existsSync(bin) && existsSync(meta)) return await serve(JSON.parse(readFileSync(meta, "utf8")).contentType, readFileSync(bin));
  } catch { /* fall through to a fresh fetch */ }
  const tmp = path.join(tmpdir(), `font-${key}-${process.pid}.tmp`);
  try {
    const { stdout } = await execFileAsync("curl", ["-sS", "-L", "--max-time", "30", "-A", ua, "-H", "accept: */*", "-o", tmp, "-w", "%{http_code} %{content_type}", url], { maxBuffer: 50e6 });
    const [code, ...ct] = stdout.trim().split(" ");
    const contentType = ct.join(" ") || (url.includes("/css") ? "text/css; charset=utf-8" : "font/woff2");
    if (code !== "200") throw new Error(`curl ${code} for ${url}`);
    const body = readFileSync(tmp);
    mkdirSync(FONT_CACHE, { recursive: true });
    writeFileSync(bin, body);
    writeFileSync(meta, JSON.stringify({ url, contentType, fetched_at: new Date().toISOString() }));
    return await serve(contentType, body);
  } catch (e) {
    console.warn(`[mock] font relay failed: ${e instanceof Error ? e.message : e}`);
    return route.fulfill({ status: 204, body: "" });
  } finally {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/* PostgREST                                                            */
/* ------------------------------------------------------------------ */

// Foreign keys the pages embed with `select=..., events(title)` style joins.
const FK = { events: "event_id", children: "child_id", event_sessions: "session_id", bookings: "booking_id", profiles: "user_id" };
const FK_TARGET_KEY = { profiles: "user_id" };

/** Split a select list on top-level commas: "a, b(c,d), e" → ["a", "b(c,d)", "e"]. */
function splitSelect(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Project one row onto a PostgREST select, resolving embedded relations. */
function project(row, select) {
  if (!select || select.trim() === "*") return row;
  const out = {};
  for (const tok of splitSelect(select)) {
    const m = tok.match(/^(?:([\w]+):)?([\w]+)(!inner|!left)?\((.*)\)$/s);
    if (m) {
      const alias = m[1] ?? m[2];
      const rel = m[2];
      const inner = m[4].trim();
      if (Array.isArray(row[rel]) || (row[rel] && typeof row[rel] === "object")) { out[alias] = row[rel]; continue; }
      const fk = FK[rel];
      const target = T[rel] ?? [];
      const key = FK_TARGET_KEY[rel] ?? "id";
      const hit = fk ? target.find((r) => r[key] === row[fk]) : null;
      out[alias] = hit ? project(hit, inner || "*") : null;
      continue;
    }
    if (tok === "*") { Object.assign(out, row); continue; }
    const cm = tok.match(/^(?:([\w]+):)?([\w]+)$/);
    if (cm) out[cm[1] ?? cm[2]] = row[cm[2]];
  }
  return out;
}

const cmp = (a, b) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);

function matches(row, col, op) {
  const v = row[col];
  const neg = op.startsWith("not.");
  const o = neg ? op.slice(4) : op;
  let r;
  if (o === "is.null") r = v == null;
  else if (o === "is.true") r = v === true;
  else if (o === "is.false") r = v === false;
  else if (o.startsWith("eq.")) r = String(v) === o.slice(3);
  else if (o.startsWith("neq.")) r = String(v) !== o.slice(4);
  else if (o.startsWith("gte.")) r = v != null && String(v) >= o.slice(4);
  else if (o.startsWith("gt.")) r = v != null && String(v) > o.slice(3);
  else if (o.startsWith("lte.")) r = v != null && String(v) <= o.slice(4);
  else if (o.startsWith("lt.")) r = v != null && String(v) < o.slice(3);
  else if (o.startsWith("in.(")) r = o.slice(4, -1).split(",").map((x) => x.trim().replace(/^"|"$/g, "")).includes(String(v));
  else if (o.startsWith("cs.")) r = Array.isArray(v) && o.slice(4, -1).split(",").every((x) => v.includes(x.replace(/^"|"$/g, "")));
  else if (o.startsWith("ilike.")) r = new RegExp("^" + o.slice(6).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*|%/g, ".*") + "$", "i").test(String(v ?? ""));
  else r = true;
  return neg ? !r : r;
}

/** Apply the query string of a PostgREST GET to a table's rows. */
export function applyQuery(rows, params) {
  let out = rows.slice();
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    if (k === "or") {
      const parts = v.replace(/^\(|\)$/g, "").split(",");
      out = out.filter((r) => parts.some((p) => { const i = p.indexOf("."); return matches(r, p.slice(0, i), p.slice(i + 1)); }));
      continue;
    }
    out = out.filter((r) => matches(r, k, v));
  }
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((o) => { const [col, ...mods] = o.split("."); return { col, desc: mods.includes("desc"), nullsFirst: mods.includes("nullsfirst") }; });
    out.sort((a, b) => {
      for (const { col, desc, nullsFirst } of keys) {
        const av = a[col], bv = b[col];
        if (av == null && bv == null) continue;
        if (av == null) return nullsFirst ? -1 : 1;
        if (bv == null) return nullsFirst ? 1 : -1;
        const c = cmp(av, bv);
        if (c) return desc ? -c : c;
      }
      return 0;
    });
  }
  const offset = Number(params.get("offset") ?? 0);
  if (offset) out = out.slice(offset);
  const limit = params.get("limit");
  if (limit) out = out.slice(0, Number(limit));
  const select = params.get("select");
  return out.map((r) => project(r, select));
}

/* ------------------------------------------------------------------ */
/* Route handler                                                        */
/* ------------------------------------------------------------------ */

function handleSupabase(route, user) {
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname;
  const method = req.method();
  const json = (body, status = 200, headers = {}) =>
    route.fulfill({ status, contentType: "application/json", headers: { ...CORS, ...headers }, body: JSON.stringify(body) });
  if (method === "OPTIONS") {
    return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  }
  const session = authSession(user);

  if (p.startsWith("/auth/v1/user")) return json(session.user);
  if (p.startsWith("/auth/v1/token")) return json(session);
  if (p.startsWith("/auth/v1/logout")) return json({}, 204);
  if (p.startsWith("/auth/v1/")) return json({}, 200);

  if (p.startsWith("/functions/v1/")) {
    const name = p.split("/")[3];
    let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch { /* not JSON */ }
    const res = functionResponse(name, body, session.user);
    return json(res, res && res.error ? 400 : 200);
  }

  if (p.startsWith("/rest/v1/rpc/")) {
    const fn = p.split("/")[4];
    let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch { /* not JSON */ }
    return json(rpcResponse(fn, body, session.user));
  }

  if (p.startsWith("/rest/v1/")) {
    const table = p.split("/")[3];
    const accept = req.headers()["accept"] ?? "";
    const prefer = req.headers()["prefer"] ?? "";
    if (method === "GET" || method === "HEAD") {
      const rows = applyQuery(T[table] ?? [], url.searchParams);
      const range = rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0";
      if (accept.includes("pgrst.object")) {
        if (rows.length === 0) return json({ code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" }, 406, { "content-range": "*/0" });
        return json(rows[0], 200, { "content-range": "0-0/1" });
      }
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...CORS, "content-range": range }, body: "" });
      return json(rows, 200, { "content-range": range });
    }
    // Writes: the recording never depends on one, but keep the client happy.
    let body = null; try { body = JSON.parse(req.postData() || "null"); } catch { /* not JSON */ }
    if (method === "POST" && T[table]) {
      const rows = (Array.isArray(body) ? body : [body]).filter(Boolean).map((r) => ({ id: `77777777-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, "0")}`, created_at: new Date().toISOString(), ...r }));
      T[table].push(...rows);
      if (prefer.includes("return=representation")) return json(accept.includes("pgrst.object") ? rows[0] : rows, 201);
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (method === "PATCH" && T[table] && body) {
      const hit = applyQuery(T[table], new URLSearchParams([...url.searchParams].filter(([k]) => k !== "select")));
      for (const r of T[table]) if (hit.some((h) => h.id === r.id)) Object.assign(r, body);
      return prefer.includes("return=representation") ? json(hit.map((h) => ({ ...h, ...body }))) : route.fulfill({ status: 204, headers: CORS, body: "" });
    }
    if (method === "DELETE" && T[table]) {
      const hit = applyQuery(T[table], new URLSearchParams([...url.searchParams].filter(([k]) => k !== "select")));
      T[table] = T[table].filter((r) => !hit.some((h) => h.id === r.id));
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    }
    return json([], 201);
  }

  if (p.startsWith("/storage/")) return json({ error: "not found", statusCode: "404" }, 404);
  if (p.startsWith("/realtime/")) return route.fulfill({ status: 404, headers: CORS, body: "" });
  return json({}, 404);
}

/* ------------------------------------------------------------------ */
/* Install                                                              */
/* ------------------------------------------------------------------ */

/**
 * Wire a Playwright BrowserContext to the fixtures.
 *   user: "coach" (Sam Reid) | "parent" (Hannah Barker)
 *   dismissBanners: pre-dismiss the Parent Hub's WhatsApp banner (default true)
 *   fonts: "relay" (curl + disk cache, default) | "continue" (let the browser fetch) | "block"
 */
export async function installMock(context, { user = "coach", dismissBanners = true, fonts = "relay" } = {}) {
  if (!USERS[user]) throw new Error(`installMock: unknown user "${user}"`);
  const session = authSession(user);

  await context.addInitScript(({ key, session, dismiss }) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(session));
      if (dismiss) window.localStorage.setItem("whatsapp-banner-dismissed", "true");
    } catch { /* storage unavailable */ }
  }, { key: STORAGE_KEY, session, dismiss: dismissBanners });

  // Playwright checks routes newest-first, so: catch-all 204 first (lowest
  // priority), then the fonts pass-through, then the Supabase host on top.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.fulfill({ status: 204, body: "" }));
  if (fonts !== "block") {
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => (fonts === "continue" ? route.continue() : relayFont(route)));
  }
  await context.route(`**/${REF}.supabase.co/**`, (route) => handleSupabase(route, user));
}

export { T, USERS, STORAGE_KEY, authSession };
