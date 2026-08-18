
CREATE TABLE public.sporting_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'tennis_training',
  event_date date NOT NULL,
  start_time time,
  end_time time,
  duration_minutes integer NOT NULL DEFAULT 60,
  location text,
  notes text,
  is_tournament boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sporting_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own schedule" ON public.sporting_schedule FOR SELECT USING (auth.uid() = parent_user_id);
CREATE POLICY "Parents can insert own schedule" ON public.sporting_schedule FOR INSERT WITH CHECK (auth.uid() = parent_user_id);
CREATE POLICY "Parents can update own schedule" ON public.sporting_schedule FOR UPDATE USING (auth.uid() = parent_user_id);
CREATE POLICY "Parents can delete own schedule" ON public.sporting_schedule FOR DELETE USING (auth.uid() = parent_user_id);

CREATE TRIGGER update_sporting_schedule_updated_at BEFORE UPDATE ON public.sporting_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
