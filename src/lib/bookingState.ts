// What a booking row actually represents.
//
// Starting a checkout writes a `pending` booking before the card is touched,
// so a parent who closes the tab — or whose card is declined — leaves a row
// behind that never becomes a place and never takes a penny. Those are kept
// (the attempt is part of the history) but they are not bookings, and showing
// them alongside real ones makes the admin screens read as though something is
// owed or broken when nothing is.

/**
 * How long a checkout may sit unfinished before it counts as abandoned rather
 * than in flight. A real payment flips the booking to paid within seconds of
 * the card being confirmed, so anything still pending after this was a parent
 * who stopped.
 */
export const ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000;

/** A checkout that was started and never completed — no money was taken. */
export function isAbandoned(b: { status: string; created_at?: string | null }): boolean {
  if (b.status === "cancelled") return true;
  if (b.status !== "pending") return false;
  if (!b.created_at) return false;
  return Date.now() - new Date(b.created_at).getTime() > ABANDONED_AFTER_MS;
}
