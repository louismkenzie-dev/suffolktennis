// The two ways to pay for a programme, and the words that describe them.
//
// A programme has one price paid up front (`price_pence`) and, optionally, a
// monthly plan (`monthly_amount_pence` × `programme_months`). Ollie's model
// is deliberate: the monthly total is HIGHER than the up-front price, so
// paying in full carries a discount and spreading the cost carries a small
// premium for the flexibility. Every screen must show that difference rather
// than quietly present two prices as equal.
//
// Monthly is a commitment, not a rolling subscription: the card is charged
// every month until all `programme_months` payments are made, and Stripe is
// set up so it can neither stop early nor run on past the last one.
//
// Deno copy for the emails and edge functions:
// supabase/functions/_shared/programmePricing.ts — keep the two in step.

export type ProgrammePricingInput = {
  programme_type?: string | null;
  price_pence?: number | null;
  monthly_amount_pence?: number | null;
  programme_months?: number | null;
  is_free?: boolean | null;
};

export type ProgrammePricing = {
  /** Both ways to pay are available on this programme. */
  offersMonthly: boolean;
  /** One payment, in pence. */
  upFrontPence: number;
  monthlyPence: number;
  months: number;
  /** What the monthly plan costs in total. */
  monthlyTotalPence: number;
  /** What paying up front saves against the monthly total; 0 when it saves nothing. */
  savingPence: number;
};

export const gbp = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

export function programmePricing(ev: ProgrammePricingInput): ProgrammePricing {
  const upFrontPence = ev.price_pence ?? 0;
  const monthlyPence = ev.monthly_amount_pence ?? 0;
  const months = ev.programme_months ?? 0;
  const monthlyTotalPence = monthlyPence * months;
  return {
    offersMonthly:
      ev.programme_type === "programme" &&
      !ev.is_free &&
      upFrontPence > 0 &&
      monthlyPence > 0 &&
      months >= 2,
    upFrontPence,
    monthlyPence,
    months,
    monthlyTotalPence,
    savingPence: Math.max(0, monthlyTotalPence - upFrontPence),
  };
}

/** "£25 a month for 12 months" — the plan in one phrase. */
export function monthlyPlanLabel(p: ProgrammePricing): string {
  return `${gbp(p.monthlyPence)} a month for ${p.months} months`;
}

/**
 * The commitment, spelled out. Used verbatim on the booking page, in the
 * invitation email and in the confirmation email, so a parent reads the same
 * sentence everywhere and can never say they were not told.
 */
export function commitmentSentence(p: ProgrammePricing): string {
  return `This is a ${p.months}-month commitment: your card is charged ${gbp(p.monthlyPence)} today and then on the same date each month until all ${p.months} payments have been made — ${gbp(p.monthlyTotalPence)} in total.`;
}

/** The tick box a parent must accept before a monthly plan can start. */
export function commitmentConsentLabel(p: ProgrammePricing): string {
  return `I understand this is a ${p.months}-month commitment and I authorise Suffolk Tennis to charge my card ${gbp(p.monthlyPence)} each month for ${p.months} months (${gbp(p.monthlyTotalPence)} in total).`;
}
