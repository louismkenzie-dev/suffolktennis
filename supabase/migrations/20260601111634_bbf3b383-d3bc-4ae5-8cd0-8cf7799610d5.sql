ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS has_medical_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS medical_details text,
  ADD COLUMN IF NOT EXISTS has_send_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS send_details text;