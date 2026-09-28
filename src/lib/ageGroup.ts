// County age groups run on age at the end of the calendar year, which is
// why a child born in December 2017 is 9U all through 2026 even before
// their birthday.
export const AGE_GROUPS = [8, 9, 10, 11, 12, 14, 16, 18];

export const ageGroupOf = (dob: string | null | undefined): string | null => {
  if (!dob) return null;
  const year = new Date(dob).getFullYear();
  if (Number.isNaN(year)) return null;
  const ageAtYearEnd = new Date().getFullYear() - year;
  const g = AGE_GROUPS.find((n) => ageAtYearEnd <= n);
  return g ? `${g}U` : "Open";
};
