
-- Grant admin role to primary account and reset password
INSERT INTO public.user_roles (user_id, role)
VALUES ('4ea4cd8c-1c2c-4f28-9922-6781741a48a4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE auth.users
SET encrypted_password = crypt('Tennis26!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = '4ea4cd8c-1c2c-4f28-9922-6781741a48a4';
