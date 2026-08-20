// Platform (Nullshift) application-fee calculation for Stripe Connect direct
// charges. Pure module — no Deno APIs — so the frontend test suite can import
// and verify it.

export const DEFAULT_PLATFORM_FEE_PERCENT = 1;

/**
 * Application fee in pence for a charge of `amountInPence`.
 * Rounds half-up; never returns less than 1p for a non-zero percentage
 * (Stripe rejects application_fee_amount of 0).
 */
export function platformFeePence(
  amountInPence: number,
  percent: number = DEFAULT_PLATFORM_FEE_PERCENT,
): number {
  if (!Number.isFinite(amountInPence) || amountInPence <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.max(1, Math.round((amountInPence * percent) / 100));
}
