// Public endpoint behind every coach join link (/coach/join/:token).
//
// Two actions. `peek` is anonymous and only reveals what the email already
// told the recipient (who invited them, to which address). `accept` is the
// one that hands out the coach role, so it insists on a signed-in user whose
// email matches the invitation — the token alone is NOT enough, because a
// forwarded link would otherwise make anyone a coach. That comparison is
// the whole security model; see docs/COACH-INVITATIONS-SPEC.md.
//
// verify_jwt is off (the join page is visited signed out) and the bearer, if
// any, is resolved here with the anon client exactly as requireRole does.
//
// Every outcome is HTTP 200 with { ok, ... } except a malformed body, because
// supabase-js's functions.invoke swallows the body of a non-2xx response and
// the page would only ever see "Edge Function returned a non-2xx status code"
// — not "wrong_account" and the email it should tell the user to sign in with.
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serviceClient, CORS, json } from "../_shared/adminAuth.ts";

const Body = z.object({
  action: z.enum(["peek", "accept"]),
  token: z.string().regex(/^[a-f0-9]{16,}$/),
});

type Row = {
  id: string; email: string; name: string | null; status: string;
  invited_by: string; opened_at: string | null; accepted_user_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid invitation link" }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = serviceClient();
  const { data: invitation } = await admin
    .from("coach_invitations")
    .select("id, email, name, status, invited_by, opened_at, accepted_user_id")
    .eq("token", body.token)
    .maybeSingle();
  const row = (invitation ?? null) as Row | null;

  // A revoked token is treated the same as an unknown one for both actions:
  // it cannot be peeked (the page shows "isn't valid") and cannot be accepted.
  if (!row) return json({ ok: false, error: "not_found" });
  if (row.status === "revoked") return json({ ok: false, error: "revoked" });

  if (body.action === "peek") {
    let invitedByName = "Suffolk Tennis";
    const { data: inviter } = await admin
      .from("profiles").select("first_name, last_name").eq("user_id", row.invited_by).maybeSingle();
    const full = [inviter?.first_name, inviter?.last_name]
      .map((x: string | null | undefined) => (x ?? "").trim()).filter(Boolean).join(" ");
    if (full) invitedByName = full;

    if (!row.opened_at) {
      await admin.from("coach_invitations")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("opened_at", null);
    }

    return json({ ok: true, email: row.email, name: row.name, status: row.status, invited_by_name: invitedByName });
  }

  // accept: who is asking?
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "sign_in" });
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authError } = await anon.auth.getUser(authHeader.slice("Bearer ".length));
  if (authError || !user) return json({ ok: false, error: "sign_in" });
  // The email match below is only proof of anything if the address has been
  // verified. Independent of the project's "confirm email" toggle: a forwarded
  // link plus a sign-up under the invited address must never be enough.
  if (!user.email_confirmed_at) return json({ ok: false, error: "sign_in" });

  if (row.status === "accepted") {
    // Revisiting the link after accepting is fine — as long as they are still
    // a coach. After "Remove coach access" the link must not say otherwise.
    if (row.accepted_user_id === user.id) {
      const { data: role } = await admin.from("user_roles").select("id")
        .eq("user_id", user.id).eq("role", "coach").limit(1).maybeSingle();
      return role ? json({ ok: true, already: true }) : json({ ok: false, error: "revoked" });
    }
    return json({ ok: false, error: "already_accepted" });
  }

  // THIS is the check that stops a forwarded link handing out the role: the
  // signed-in account must be the address the admin invited. The email is
  // returned so the page can say which account to switch to.
  if ((user.email ?? "").trim().toLowerCase() !== row.email) {
    return json({ ok: false, error: "wrong_account", email: row.email });
  }

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: user.id, role: "coach" });
  // 23505 on user_roles_user_id_role_key: they already held the role (granted
  // by SQL, or an earlier accept that didn't get as far as stamping the row).
  if (roleError && roleError.code !== "23505") {
    return json({ ok: false, error: roleError.message });
  }

  await admin.from("coach_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_user_id: user.id })
    .eq("id", row.id)
    .eq("status", "invited");

  return json({ ok: true });
});
