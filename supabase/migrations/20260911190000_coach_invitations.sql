-- Invite a coach (docs/COACH-INVITATIONS-SPEC.md).
--
-- A coach account is a user_roles row with role 'coach', and until now
-- nothing in the app created one — the only coach was granted by SQL. This
-- table is the admin's way in: one row per invited email, a personal token
-- in the email link, and the accept step (coach-invitation edge function)
-- grants the role only to a signed-in user whose email matches the row.
--
-- Deliberately shaped like booking_invitations so the two flows feel like
-- one system: same token format, same invited/opened/accepted stamps, and
-- re-inviting reuses the row rather than minting a second link.

create table if not exists public.coach_invitations (
  id uuid primary key default gen_random_uuid(),
  -- Stored lowercased and trimmed; the accept step compares lower(user.email).
  email text not null,
  name text,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'revoked')),
  invited_by uuid not null,
  sent_at timestamptz,
  reminded_at timestamptz,
  opened_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid,
  created_at timestamptz not null default now()
);

-- One row per address whatever the casing, so a re-invite finds the row and
-- a revoked one can be flipped back rather than duplicated.
create unique index if not exists coach_invitations_email_key
  on public.coach_invitations (lower(email));

alter table public.coach_invitations enable row level security;

-- Admins manage; nobody else reads. The join page and the accept step go
-- through edge functions with the service role, the token being the credential.
drop policy if exists "Admins manage coach invitations" on public.coach_invitations;
create policy "Admins manage coach invitations" on public.coach_invitations
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

comment on table public.coach_invitations is
  'Admin invitations to join as a coach. The token is the link credential; coach-invitation grants the coach role only when the signed-in user''s email matches the row. Sent by send-coach-invitations.';
