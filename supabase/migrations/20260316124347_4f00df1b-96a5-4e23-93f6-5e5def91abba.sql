
ALTER TABLE public.sporting_schedule
  ADD COLUMN recurrence_rule text DEFAULT NULL,
  ADD COLUMN recurrence_end_date date DEFAULT NULL,
  ADD COLUMN recurrence_group_id uuid DEFAULT NULL;
