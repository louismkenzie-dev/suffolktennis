CREATE OR REPLACE FUNCTION public.grant_admin_to_cmelsa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'cmelsa@me.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_cmelsa_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_cmelsa_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_to_cmelsa();

-- Also grant retroactively if the user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'cmelsa@me.com'
ON CONFLICT (user_id, role) DO NOTHING;