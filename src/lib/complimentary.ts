// What a complimentary place is called, and why, in front of a parent.
//
// `booking_invitations.complimentary_reason` records how the free place came
// about. Until now every complimentary place was described the same way —
// "because your child is already on one of our programmes" — which was true
// of the only case that existed then: a child already paying for a programme
// gets any other programme free.
//
// An admin can also grant a free place outright, and for a different reason
// entirely (Ollie made the whole 18U Girls squad free of charge on 19 Sep
// 2026). Telling those parents their place was included with another
// programme would be a plain untruth, so the reason now chooses the words.
//
// Mirrors supabase/functions/_shared/complimentary.ts — keep the two in step.

/** The value written by send-booking-invitations when a child qualifies. */
export const AUTO_REASON = "already on a paid programme";
/** The value written when an admin grants the place by hand. */
export const ADMIN_REASON = "granted by admin";

export type ComplimentaryWords = {
  /** Where a price is displayed large, on its own. */
  shortPrice: string;
  /** The longer form for a details row in an email. */
  price: string;
  /** A badge beside the price. */
  badge: string;
  /** One sentence to a parent; `child` is a first name. */
  sentence: (child: string) => string;
};

/** "Alana Amoy Austin" -> "Alana"; empty or missing -> "your daughter"'s stand-in. */
export function firstNameOf(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "your child";
}

export function complimentaryWords(reason: string | null | undefined): ComplimentaryWords {
  if (reason === AUTO_REASON) {
    return {
      shortPrice: "No extra charge",
      price: "No extra charge — included with your existing programme place",
      badge: "Included",
      sentence: (child) =>
        `Because ${child} is already on one of our programmes, this place is included at no extra charge — just confirm it below.`,
    };
  }
  // Granted by an admin, or granted before reasons were recorded: say only
  // what is certainly true — there is nothing to pay.
  return {
    shortPrice: "No charge",
    price: "No charge",
    badge: "Free place",
    sentence: (child) =>
      `There is no charge for this place — Suffolk Tennis is covering the cost, so ${child} just needs it confirming below.`,
  };
}
