// Booking fulfilment: mark paid, close the invitation, issue the QR ticket and
// email the parent. Shared by the Stripe webhook (card payments) and the
// checkout function itself (free events and complimentary programme places,
// which never touch Stripe).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "./resend.ts";
import { brandedEmail, emailButton, emailDetails, emailNote, emailParagraph } from "./emailLayout.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "./emailPrefs.ts";

const SITE_URL = () => (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

const gbp = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

/**
 * Idempotent: a booking that is already paid is left alone, so repeated
 * webhooks (or a webhook arriving after a free booking settled inline) can't
 * double-issue tickets or emails.
 */
export async function settleBooking(
  admin: SupabaseClient,
  bookingId: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, event_id, invitation_id, parent_name, parent_email, child_name, session_slot, amount_pence, complimentary")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) {
    console.warn("settle for unknown booking:", bookingId);
    return;
  }
  if (booking.status === "paid") return;

  await admin
    .from("bookings")
    .update({ status: "paid", paid_at: new Date().toISOString(), ...extra })
    .eq("id", booking.id);

  if (booking.invitation_id) {
    await admin
      .from("booking_invitations")
      .update({ status: "booked" })
      .eq("id", booking.invitation_id);
  }

  // Unique per booking; validity is re-checked at scan time.
  const { data: ticket } = await admin
    .from("tickets")
    .upsert(
      { booking_id: booking.id, event_id: booking.event_id },
      { onConflict: "booking_id" },
    )
    .select("qr_token")
    .single();

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !ticket) return;

  const { data: eventRow } = await admin
    .from("events")
    .select("title, location, event_date, programme_type")
    .eq("id", booking.event_id)
    .maybeSingle();

  const isProgramme = eventRow?.programme_type === "programme";
  const costLabel = booking.complimentary
    ? "No extra charge — included with an existing programme place"
    : booking.amount_pence > 0 ? gbp(booking.amount_pence) : "Free";
  const ticketUrl = `${SITE_URL()}/ticket/${ticket.qr_token}`;
  const firstName = (booking.parent_name ?? "there").split(" ")[0];
  const unsubToken = await unsubscribeTokenFor(admin, booking.parent_email, "booking");

  try {
    await sendEmail({
      to: booking.parent_email,
      subject: `${isProgramme ? "Place confirmed" : "Booking confirmed"} — ${eventRow?.title ?? "Suffolk Tennis"}`,
      unsubscribe_token: unsubToken ?? undefined,
      idempotency_key: `booking-confirmed-${booking.id}`,
      html: brandedEmail({
        unsubscribeUrl: unsubscribeUrlFor(unsubToken),
        title: isProgramme ? "Your place is confirmed" : "Booking confirmed",
        preheader: `${booking.child_name} is booked on ${eventRow?.title ?? "the session"}`,
        body:
          emailParagraph(`Hi ${firstName},`) +
          emailParagraph(
            `<strong>${booking.child_name}</strong> is booked on <strong>${eventRow?.title ?? "the session"}</strong>.` +
            (isProgramme ? " Every session in the programme is included." : "") +
            " Your entry ticket is ready.",
          ) +
          emailDetails([
            ["Player", booking.child_name],
            [isProgramme ? "Programme" : "Event", eventRow?.title ?? ""],
            ["Session", booking.session_slot ?? ""],
            ["Venue", eventRow?.location ?? ""],
            ["Cost", costLabel],
          ]) +
          emailButton(ticketUrl, "View your entry ticket") +
          emailNote(
            "Please have the QR code on that page ready to be scanned when you arrive — a coach will check your child in with it. " +
            "After each session, your child's coach writes a short performance report, which you'll find in your Parent Hub.",
          ),
      }),
    }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
  } catch (e) {
    console.error("confirmation email failed:", e);
  }
}
