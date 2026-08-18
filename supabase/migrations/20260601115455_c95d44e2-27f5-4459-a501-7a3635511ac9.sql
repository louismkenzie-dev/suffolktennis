-- 1. Role enum & table
CREATE TYPE public.app_role AS ENUM ('admin', 'parent');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. RLS for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Admin access policies on existing tables
-- profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- children
CREATE POLICY "Admins can view all children"
  ON public.children FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all children"
  ON public.children FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert children"
  ON public.children FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all children"
  ON public.children FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- player_reports
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_reports TO authenticated;

CREATE POLICY "Admins can view all reports"
  ON public.player_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert reports"
  ON public.player_reports FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports"
  ON public.player_reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reports"
  ON public.player_reports FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- tennis_goals
CREATE POLICY "Admins can view all goals"
  ON public.tennis_goals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert any goals"
  ON public.tennis_goals FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any goals"
  ON public.tennis_goals FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any goals"
  ON public.tennis_goals FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- sporting_schedule
CREATE POLICY "Admins can view all schedules"
  ON public.sporting_schedule FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert any schedules"
  ON public.sporting_schedule FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any schedules"
  ON public.sporting_schedule FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any schedules"
  ON public.sporting_schedule FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- events (manage)
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;
CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- suffolk_news (manage)
GRANT INSERT, UPDATE, DELETE ON public.suffolk_news TO authenticated;
CREATE POLICY "Admins can insert suffolk news"
  ON public.suffolk_news FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update suffolk news"
  ON public.suffolk_news FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete suffolk news"
  ON public.suffolk_news FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Event invitations table
CREATE TABLE public.event_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  invited_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, child_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invitations TO authenticated;
GRANT ALL ON public.event_invitations TO service_role;

ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own invitations"
  ON public.event_invitations FOR SELECT
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents update RSVP"
  ON public.event_invitations FOR UPDATE
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Admins manage invitations"
  ON public.event_invitations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_event_invitations_updated_at
  BEFORE UPDATE ON public.event_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Seed first admin (Sutski101@gmail.com)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE lower(email) = lower('Sutski101@gmail.com')
ON CONFLICT DO NOTHING;