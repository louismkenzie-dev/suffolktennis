import { describe, it, expect } from "vitest";
import {
  DEFAULT_PLATFORM_FEE_PERCENT,
  platformFeePence,
} from "../../supabase/functions/_shared/platformFee";

// The platform fee is a commercial term (2.5% of gross to Nullshift, agreed
// with Suffolk Tennis), so it is pinned here: a change to the rate should have
// to be a deliberate edit to this test, not a silent edit to a constant.
describe("platform fee", () => {
  it("is 2.5%", () => {
    expect(DEFAULT_PLATFORM_FEE_PERCENT).toBe(2.5);
  });

  it("takes 2.5% of the gross amount", () => {
    expect(platformFeePence(1500)).toBe(38); // £15.00 -> 37.5p, rounded half-up
    expect(platformFeePence(1000)).toBe(25); // £10.00 monthly programme
    expect(platformFeePence(4000)).toBe(100); // £40.00 -> exactly £1
  });

  it("never returns zero for a real charge", () => {
    // Stripe rejects application_fee_amount: 0, so tiny charges still owe 1p.
    expect(platformFeePence(1)).toBe(1);
    expect(platformFeePence(20)).toBe(1);
  });

  it("returns nothing when there is nothing to charge", () => {
    expect(platformFeePence(0)).toBe(0);
    expect(platformFeePence(-500)).toBe(0);
    expect(platformFeePence(Number.NaN)).toBe(0);
  });

  it("honours an explicit override", () => {
    expect(platformFeePence(1500, 1)).toBe(15);
    expect(platformFeePence(1500, 0)).toBe(0);
  });
});
