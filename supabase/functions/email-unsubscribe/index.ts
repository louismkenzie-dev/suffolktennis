// One-click unsubscribe for campaign email.
//
// The token in the link is per-address and unguessable, so a link can only
// ever unsubscribe the person it was sent to — no email address is exposed in
// the URL, and nobody can unsubscribe anyone else.
//
// Two entry points, both required in practice:
//   GET  ?token=...  — the visible "Unsubscribe" link in the footer; returns
//                      a branded confirmation page with a resubscribe link.
//   POST ?token=...  — RFC 8058 one-click, used by the List-Unsubscribe-Post
//                      header that Gmail/Apple surface as their own button.
// GET ?token=...&resubscribe=1 undoes it (for the "clicked by mistake" case,
// and for link scanners that follow URLs without a human involved).
import { createClient } from "npm:@supabase/supabase-js@2";

const NAVY = "#0E1D39";
const PINK = "#E0298E";
const CYAN = "#00ACE6";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Suffolk Tennis</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Hanken+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body { margin:0; background:#EEF2F7; font-family:'Hanken Grotesk',system-ui,Arial,sans-serif; color:#1F2937; }
  .wrap { max-width:560px; margin:0 auto; padding:40px 16px; }
  .card { background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 10px rgba(15,23,42,.08); }
  .head { background:${NAVY}; padding:28px 24px; text-align:center; }
  .head img { width:220px; max-width:70%; display:block; margin:0 auto; }
  .rule { height:4px; background:${PINK}; }
  .body { padding:32px 30px 34px; }
  h1 { font-family:'Archivo',Arial,sans-serif; font-stretch:112%; text-transform:uppercase;
       font-size:22px; line-height:1.1; margin:0 0 14px; color:${NAVY}; }
  p { font-size:15px; line-height:1.65; color:#334155; margin:0 0 14px; }
  a.btn { display:inline-block; background:${CYAN}; color:${NAVY}; text-decoration:none;
          font-family:'Archivo',Arial,sans-serif; font-weight:700; font-stretch:112%;
          text-transform:uppercase; letter-spacing:.06em; font-size:14px;
          padding:14px 28px; border-radius:10px; margin-top:6px; }
  .muted { font-size:13px; color:#64748B; }
</style></head>
<body><div class="wrap"><div class="card">
  <div class="head"><img src="${SITE_URL}/email/logo.png" alt="LTA Suffolk Tennis Partnership"></div>
  <div class="rule"></div>
  <div class="body">${body}</div>
</div></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const resubscribe = url.searchParams.get("resubscribe") === "1";

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return page("Link not recognised", `
      <h1>This link isn't valid</h1>
      <p>We couldn't match this unsubscribe link to an email address. It may have been
      truncated by your email app.</p>
      <p class="muted">Email <a href="mailto:enquiries@suffolktennis.online">enquiries@suffolktennis.online</a>
      and we'll take you off the list by hand.</p>`, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pref } = await admin
    .from("email_preferences")
    .select("email, unsubscribed_at")
    .eq("unsub_token", token)
    .maybeSingle();

  if (!pref) {
    return page("Link not recognised", `
      <h1>This link isn't valid</h1>
      <p>We couldn't match this link to an email address.</p>
      <p class="muted">Email <a href="mailto:enquiries@suffolktennis.online">enquiries@suffolktennis.online</a>
      and we'll sort it out.</p>`, 404);
  }

  if (resubscribe) {
    await admin.from("email_preferences")
      .update({ unsubscribed_at: null, resubscribed_at: new Date().toISOString() })
      .eq("unsub_token", token);
    await admin.from("player_roster")
      .update({ marketing_opt_in: true })
      .eq("contact_email", pref.email);
    return page("You're back on the list", `
      <h1>You're back on the list</h1>
      <p>We'll keep sending you Suffolk county programme updates at
      <strong>${pref.email}</strong>.</p>
      <a class="btn" href="${SITE_URL}">Back to suffolktennis.online</a>`);
  }

  // Unsubscribe (idempotent — a second click just shows the same page).
  if (!pref.unsubscribed_at) {
    await admin.from("email_preferences")
      .update({ unsubscribed_at: new Date().toISOString(), resubscribed_at: null })
      .eq("unsub_token", token);
    await admin.from("player_roster")
      .update({ marketing_opt_in: false })
      .eq("contact_email", pref.email);
  }

  // RFC 8058 one-click: the mail client wants a bare 200, not a web page.
  if (req.method === "POST") {
    return new Response(JSON.stringify({ unsubscribed: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return page("Unsubscribed", `
    <h1>You've been unsubscribed</h1>
    <p>We won't send any more county programme updates to
    <strong>${pref.email}</strong>.</p>
    <p>You'll still receive anything you've specifically asked us for — booking
    confirmations, entry tickets and sign-in codes — because those aren't
    updates, they're your own bookings and account.</p>
    <p class="muted">Clicked this by mistake?
    <a href="${url.origin}${url.pathname}?token=${token}&amp;resubscribe=1">Put me back on the list</a>.</p>
    <a class="btn" href="${SITE_URL}">Back to suffolktennis.online</a>`);
});
