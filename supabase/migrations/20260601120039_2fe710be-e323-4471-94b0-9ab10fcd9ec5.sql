ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS home_club text,
  ADD COLUMN IF NOT EXISTS current_coach text;