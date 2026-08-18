
CREATE TABLE public.tennis_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'technical',
  target_date date,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  set_by text DEFAULT 'coach',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tennis_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own children goals" ON public.tennis_goals FOR SELECT USING (auth.uid() = parent_user_id);
CREATE POLICY "Parents can insert goals" ON public.tennis_goals FOR INSERT WITH CHECK (auth.uid() = parent_user_id);
CREATE POLICY "Parents can update goals" ON public.tennis_goals FOR UPDATE USING (auth.uid() = parent_user_id);
CREATE POLICY "Parents can delete goals" ON public.tennis_goals FOR DELETE USING (auth.uid() = parent_user_id);

CREATE TRIGGER update_tennis_goals_updated_at BEFORE UPDATE ON public.tennis_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
