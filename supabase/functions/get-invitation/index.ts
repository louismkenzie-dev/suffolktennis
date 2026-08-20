// Public (token-authorized) endpoint behind every invitation link.
// The token is the credential: it resolves the invitation plus the event and
// its sessions, even for private events an anonymous visitor could never
// select directly. Marks the invitation as opened on first view.
import { serviceClient, CORS, json } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let token: unknown;
  try {
    ({ token } = await req.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (typeof token !== "string" || !/^[a-f0-9]{16,}$/.test(token)) {
    return json({ error: "Invalid invitation link" }, 400);
  }

  const admin = serviceClient();
  const { data: invitation } = await admin
    .from("booking_invitations")
    .select("id, event_id, status, child_id, child_name, parent_name, parent_email, parent_user_id")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) return json({ error: "Invitation not found" }, 404);
  if (invitation.status === "revoked" || invitation.status === "expired") {
    return json({ error: "This invitation is no longer valid — please contact Suffolk Tennis." }, 410);
  }

  const { data: event } = await admin
    .from("events")
    .select("id, title, description, event_date, end_date, location, age_group, capacity, cost, poster_url, session_slots, visibility, programme_type, price_pence, monthly_amount_pence, programme_months, sign_up_enabled")
    .eq("id", invitation.event_id)
    .maybeSingle();
  if (!event) return json({ error: "Event not found" }, 404);

  const { data: sessions } = await admin
    .from("event_sessions")
    .select("id, session_date, start_time, end_time, venue, notes")
    .eq("event_id", event.id)
    .order("session_date");

  // Existing booking for this invitation (so revisits show the ticket, not a
  // second checkout).
  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, stripe_checkout_session_id")
    .eq("invitation_id", invitation.id)
    .in("status", ["pending", "paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invitation.status === "invited") {
    await admin
      .from("booking_invitations")
      .update({ status: "opened", opened_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .eq("status", "invited");
  }

  return json({
    invitation: {
      id: invitation.id,
      status: invitation.status,
      child_name: invitation.child_name,
      parent_name: invitation.parent_name,
      parent_email: invitation.parent_email,
    },
    event,
    sessions: sessions ?? [],
    existing_booking: booking ?? null,
  });
});
