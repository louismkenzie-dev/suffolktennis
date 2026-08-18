
CREATE OR REPLACE FUNCTION public.get_parent_emails()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can access parent emails';
  END IF;
  RETURN QUERY SELECT u.id, u.email::text FROM auth.users u;
END;
$$;

REVOKE ALL ON FUNCTION public.get_parent_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_parent_emails() TO authenticated;
