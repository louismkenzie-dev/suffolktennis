// Records what we sent so its fate can be looked up later.
//
// sendEmail returns Resend's message id; every caller used to throw it away,
// which meant that when a parent said "I never got it" there was nothing to
// check. Stamping one row per message — linked to the invitation it belongs
// to — lets email-delivery-sync fill in the outcome and the admin screens
// show Delivered or Bounced next to each parent.
//
// Never throws: a bookkeeping failure must not fail a send that succeeded.

type Admin = { from: (t: string) => any };

export type DeliveryRecord = {
  resendId: string;
  recipient: string;
  subject?: string;
  /** 'booking_invitation' | 'booking_reminder' | 'coach_invitation' | ... */
  purpose?: string;
  invitationId?: string | null;
  coachInvitationId?: string | null;
  eventId?: string | null;
};

export async function recordDelivery(admin: Admin, rec: DeliveryRecord): Promise<void> {
  if (!rec.resendId) return;
  try {
    await admin.from("email_deliveries").upsert(
      {
        resend_id: rec.resendId,
        recipient: rec.recipient,
        subject: rec.subject ?? null,
        purpose: rec.purpose ?? null,
        invitation_id: rec.invitationId ?? null,
        coach_invitation_id: rec.coachInvitationId ?? null,
        event_id: rec.eventId ?? null,
        status: "sent",
        status_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      },
      { onConflict: "resend_id" },
    );
  } catch (e) {
    console.error("recordDelivery failed", e instanceof Error ? e.message : String(e));
  }
}
