-- Coach role: can scan tickets at venues (scan-ticket edge function and the
-- /admin/scan page) but has no access to the wider admin dashboard or data.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coach';
