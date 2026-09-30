-- Ollie wants the full date of birth on a nomination, not just the year: a
-- January child and a December child in the same year group are nearly a
-- year apart in growth and maturity. birth_year stays (older rows, and it
-- is still what the age group is worked out from) and is filled from the
-- date when one is given.
alter table public.talent_nominations
  add column if not exists date_of_birth date;

comment on column public.talent_nominations.date_of_birth is
  'Full date of birth when the nominator gave one; birth_year is derived from it.';
