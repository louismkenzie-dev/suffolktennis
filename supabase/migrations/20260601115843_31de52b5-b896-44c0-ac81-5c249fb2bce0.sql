ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_phone text,
  ADD COLUMN IF NOT EXISTS secondary_phone text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_postcode text,
  ADD COLUMN IF NOT EXISTS plays_tennis boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS playing_ability text,
  ADD COLUMN IF NOT EXISTS parent_notes text;