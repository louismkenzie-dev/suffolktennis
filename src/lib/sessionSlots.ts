// Rising Stars session labels carry the birth years they are for, as typed
// on the Events page: "14.00 - 15.30 Players Born - 2020/2021". These read
// the years back out so the form and the admin list can spot a child put in
// the wrong age session.

/** Birth years named in a session label (empty if it names none). */
export function slotYears(slot: string | null | undefined): number[] {
  const after = String(slot ?? "").split(/born/i)[1] ?? String(slot ?? "");
  return [...after.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1]));
}

/** True when the session names birth years and this child's isn't one of them. */
export function slotMismatch(slot: string | null | undefined, birthYear: number | null | undefined): boolean {
  if (!slot || !birthYear) return false;
  const years = slotYears(slot);
  return years.length > 0 && !years.includes(birthYear);
}

/** The one session on a day that fits this birth year, if exactly one does. */
export function slotFor(slots: string[], birthYear: number | null | undefined): string | null {
  if (!birthYear) return null;
  const fits = slots.filter((s) => slotYears(s).includes(birthYear));
  return fits.length === 1 ? fits[0] : null;
}
