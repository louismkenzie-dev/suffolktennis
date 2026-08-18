ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sponsorship_interest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sponsorship_company text,
  ADD COLUMN IF NOT EXISTS sponsorship_details text;