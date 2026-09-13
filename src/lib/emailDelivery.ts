// How a sent email is described in the admin screens.
//
// public.email_deliveries carries Resend's own verdict for every message we
// send, refreshed every ten minutes by the email-delivery-sync function.
// "Delivered" means the recipient's mail server accepted it — it does not
// promise the inbox over the junk folder, which is what the wording below is
// careful to say.
import type { StatusTone } from "@/components/app";

export type DeliveryStatus =
  | "sent" | "scheduled" | "delivery_delayed" | "delivered"
  | "opened" | "clicked" | "bounced" | "complained" | "failed";

export type Delivery = {
  id: string;
  invitation_id: string | null;
  coach_invitation_id: string | null;
  recipient: string;
  subject: string | null;
  purpose: string | null;
  status: string;
  status_at: string;
  detail: string | null;
  sent_at: string;
};

/** Later news wins, so one parent's newest message decides the badge. */
const RANK: Record<string, number> = {
  scheduled: 1, sent: 2, delivery_delayed: 3, delivered: 4,
  opened: 5, clicked: 6, complained: 7, bounced: 8, failed: 9,
};

/** The worst outcome among a parent's messages — a bounce always shows. */
export function worstOf(rows: Delivery[]): Delivery | null {
  if (rows.length === 0) return null;
  return rows.reduce((a, b) => ((RANK[b.status] ?? 0) > (RANK[a.status] ?? 0) ? b : a));
}

export function deliveryLabel(status: string): { tone: StatusTone; label: string; help: string } {
  switch (status) {
    case "delivered":
    case "opened":
    case "clicked":
      return {
        tone: "success", label: "Delivered",
        help: "Their email provider accepted it. If they can't find it, ask them to check junk.",
      };
    case "bounced":
      return {
        tone: "danger", label: "Bounced",
        help: "Their email provider rejected it — the address is usually wrong or closed. Check it and invite them again.",
      };
    case "complained":
      return {
        tone: "danger", label: "Marked as spam",
        help: "They reported this as spam, so we should not email this address again.",
      };
    case "delivery_delayed":
      return {
        tone: "warning", label: "Delayed",
        help: "Their provider is holding it and retrying. This usually clears by itself.",
      };
    case "failed":
      return { tone: "danger", label: "Failed", help: "The message could not be sent." };
    case "sent":
    case "scheduled":
      return {
        tone: "info", label: "Sending",
        help: "Sent to our email provider; the delivery result lands within a few minutes.",
      };
    default:
      return { tone: "neutral", label: status.replace(/_/g, " "), help: "" };
  }
}

/** "Delivered · 3 Sept" for a list row's detail line. */
export function deliveryDetail(d: Delivery): string {
  const when = new Date(d.status_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${deliveryLabel(d.status).label} ${when}`;
}
