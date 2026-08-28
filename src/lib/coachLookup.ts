import { supabase } from "@/integrations/supabase/client";

/** A coach as the email tools need to see them: an address with a human label. */
export type CoachContact = {
  email: string;
  name: string;
  /** Clubs they coach at, for disambiguating two coaches with the same name. */
  clubs: string[];
};

// The generated Supabase types predate county_coaches; the admin panels all
// take this same escape hatch.
const db = supabase as unknown as { from: (t: string) => any };

/**
 * Every active coach in the county directory, keyed by lowercased email.
 *
 * The admin-email `recipients` action builds its names from player_roster
 * alone, so coaches showed up in the group picker as bare addresses with no
 * name to search for — and beyond its 500-row cap, not at all. Loading the
 * directory straight from the table (admin-only RLS) fixes both.
 */
export async function loadCoachContacts(): Promise<Map<string, CoachContact>> {
  const { data, error } = await db
    .from("county_coaches")
    .select("first_name, last_name, email, active, county_coach_affiliations(organisation)")
    .eq("active", true);
  if (error || !data) return new Map();

  const out = new Map<string, CoachContact>();
  for (const c of data as Array<{
    first_name: string; last_name: string; email: string;
    county_coach_affiliations: Array<{ organisation: string }> | null;
  }>) {
    const email = (c.email ?? "").trim().toLowerCase();
    if (!email) continue;
    out.set(email, {
      email,
      name: `${c.first_name} ${c.last_name}`.trim(),
      clubs: (c.county_coach_affiliations ?? []).map((a) => a.organisation),
    });
  }
  return out;
}

/** "Jane Smith (Coach — Ipswich Sports Club)" for pickers and tables. */
export function coachLabel(c: CoachContact): string {
  return c.clubs.length ? `${c.name} (Coach — ${c.clubs[0]})` : `${c.name} (Coach)`;
}
