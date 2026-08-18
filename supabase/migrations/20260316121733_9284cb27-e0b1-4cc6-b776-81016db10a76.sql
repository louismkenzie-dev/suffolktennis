
-- Children table
CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  date_of_birth date,
  description text,
  medical_needs text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own children" ON public.children FOR SELECT USING (auth.uid() = parent_user_id);
CREATE POLICY "Parents can insert own children" ON public.children FOR INSERT WITH CHECK (auth.uid() = parent_user_id);
CREATE POLICY "Parents can update own children" ON public.children FOR UPDATE USING (auth.uid() = parent_user_id);
CREATE POLICY "Parents can delete own children" ON public.children FOR DELETE USING (auth.uid() = parent_user_id);

CREATE TRIGGER update_children_updated_at BEFORE UPDATE ON public.children FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Player reports table (admins upload, parents view)
CREATE TABLE public.player_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  report_title text NOT NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  programme text,
  national_coach text,
  individual_coach text,
  region text,
  county text,
  talent_characteristics jsonb DEFAULT '[]'::jsonb,
  programme_review jsonb DEFAULT '[]'::jsonb,
  coach_comments text,
  weekly_schedule text,
  competitive_schedule text,
  report_pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;

-- Parents can view reports for their own children
CREATE POLICY "Parents can view own children reports" ON public.player_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.children WHERE children.id = player_reports.child_id AND children.parent_user_id = auth.uid())
);

CREATE TRIGGER update_player_reports_updated_at BEFORE UPDATE ON public.player_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for child photos
INSERT INTO storage.buckets (id, name, public) VALUES ('child-photos', 'child-photos', true);

CREATE POLICY "Parents can upload child photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'child-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Anyone can view child photos" ON storage.objects FOR SELECT USING (bucket_id = 'child-photos');
CREATE POLICY "Parents can delete own child photos" ON storage.objects FOR DELETE USING (bucket_id = 'child-photos' AND auth.role() = 'authenticated');
