# Invite a coach

Status: shipped 11 Sep 2026. Migration applied; send-coach-invitations v1 and coach-invitation v1 deployed. Louis: "I need the ability to invite a coach to
sign up to this system under people and coaches, so that they can sign up with
coach permissions and then Ollie (admin) can assign to a programme".

## Today

A coach account is a `user_roles` row with role `coach`. Nothing in the app
creates one: Test Coach Louis was granted by SQL. The programme form's
"Coaches" checklist (`event_coaches`) only lists users who already hold the
role, so Ollie has no way to bring a new coach in. Parents have an invitation
flow (`booking_invitations` → `/book/:token`) that this mirrors deliberately,
so the two feel like one system.

## The flow

1. Admin → People → Coaches → **Invite a coach** (name + email).
2. The coach gets a branded email: "You're invited to coach with Suffolk
   Tennis", button **Accept invitation** → `/coach/join/<token>`.
3. The join page shows who invited them and the email it was sent to.
   - Not signed in → "Create free account" / "Sign in", both to
     `/auth?redirect=/coach/join/<token>&email=<email>`. Auth prefills the
     email. After the 6-digit code, Auth honours `redirect` and lands back here.
   - Signed in with a different email → the switch-account panel, same copy
     as `BookingPage`'s.
   - Signed in with the invited email → accept runs automatically; success
     shows "You're a Suffolk Tennis coach" and a **Open the Coach Hub** button.
4. The Coach Hub's venues page already explains that programmes appear once
   assigned. Ollie assigns from the programme form's Coaches checklist, which
   now lists the new coach. Nothing else to build there.

## Migration `20260911190000_coach_invitations.sql`

```sql
create table public.coach_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'invited' check (status in ('invited','accepted','revoked')),
  invited_by uuid not null,
  sent_at timestamptz,
  reminded_at timestamptz,
  opened_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid,
  created_at timestamptz not null default now()
);
create unique index coach_invitations_email_key on public.coach_invitations (lower(email));
alter table public.coach_invitations enable row level security;
-- Admins manage; nobody else reads. The join page and the accept step go
-- through edge functions with the service role, the token being the credential.
create policy "Admins manage coach invitations" on public.coach_invitations
  for all using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));
```

Email is stored lowercased and trimmed. One row per email: re-inviting
reuses the row and its token (like `send-booking-invitations`), and a revoked
row can be re-invited by flipping it back to `invited` with a fresh token.

## Edge functions

### `send-coach-invitations` (admin JWT, `verify_jwt = true`)

Mirror `send-booking-invitations`: `requireAdmin`, zod body
`{ invitees?: [{ name?, email }], remind_invitation_ids?: uuid[] }`.

- Find-or-create the row by `lower(email)`. If it exists and is `accepted`,
  return `{ sent: false, error: "already a coach" }` for that address. If
  `revoked`, set `status = 'invited'` and a new token, then send.
- Send with `brandedEmail`: title "You're invited to coach", preheader
  "Suffolk Tennis coach invitation", body: Hi {first name or "there"},
  {inviter's name from profiles, else "Suffolk Tennis"} has invited you to
  coach with Suffolk Tennis. What the account gives them (registers, QR
  check-in, session reports for every player on their programmes). Button
  **Accept invitation** to `${SITE_URL}/coach/join/${token}`.
  `emailNote`: personal link; sign up with this email address; if they
  already have a Suffolk Tennis parent account, sign in with it and coaching
  is added to it. `idempotency_key: coach-invite-${id}` (reminders:
  `coach-invite-${id}-r${reminded count or timestamp}` so a reminder is not
  deduped against the original). Unsubscribe token as the booking invite does.
- Stamp `sent_at` / `reminded_at`. Return `{ sent, total, results }`.

### `coach-invitation` (`verify_jwt = false`, does its own auth)

Body `{ action: "peek" | "accept", token }`. Token must match
`/^[a-f0-9]{16,}$/`. Every outcome is a 200 with `{ ok, ... }` except a
malformed body (400) — supabase-js swallows non-2xx bodies.

- `peek` (anonymous): returns `{ ok: true, email, name, status, invited_by_name }`
  for `invited` or `accepted` rows; `{ ok: false, error }` for unknown or
  revoked. Stamps `opened_at` on first peek.
- `accept` (needs `Authorization: Bearer <user JWT>`; resolve the user with
  the anon client's `auth.getUser` exactly as `requireRole` does):
  1. Row must exist and be `invited` (an `accepted` row whose
     `accepted_user_id` is this user returns `{ ok: true, already: true }`).
  2. `lower(user.email) === row.email`, else `{ ok: false, error: "wrong_account", email }`.
     THIS is the check that stops a forwarded link handing out the role.
  3. Insert `user_roles (user_id, 'coach')`; a 23505 on
     `user_roles_user_id_role_key` is fine (already had it).
  4. Update the row: `status = 'accepted'`, `accepted_at`, `accepted_user_id`.
  5. Return `{ ok: true }`.

Both functions import from `../_shared/` as the others do.
`supabase/config.toml` gains both entries.

## Front end

### `src/pages/CoachJoinPage.tsx` (NEW), route `/coach/join/:token` in `App.tsx`

`FlowShell` with `back={{ label: "Suffolk Tennis", to: "/" }}`. States:
loading (SkeletonBlock), invalid (EmptyState "This invitation isn't valid"),
signed-out (the two buttons), wrong account (panel + "Switch account" which
signs out and returns to `/auth?redirect=...`), accepting (spinner), accepted
("You're a Suffolk Tennis coach", what happens next: "Ollie will assign you to
your programmes; they appear in your Coach Hub", button to `/coach`), already
(same as accepted). Use `useAuth` for `user`/`loading`/`signOut`. Do not call
accept until auth has finished loading.

Auth.tsx: read `email` from the query string and prefill the email field
when it is empty. Nothing else changes there.

### `src/components/admin/CoachesPanel.tsx` + `src/components/admin/CoachInviteSheet.tsx` (NEW)

A new **Coach accounts** section at the TOP of CoachesPanel, above "Website
coaches" (which is the public-site team and stays as it is):

- Header action **Invite a coach** → `CoachInviteSheet` (Dialog, bottom sheet
  on phones): name, email, submit calls `send-coach-invitations`. Toast the
  result; reload the section.
- Rows for every user holding the coach role: name from `profiles`, email
  from the `get_parent_emails` RPC (admin-only; it returns every auth user),
  subtitle listing their assigned programmes from `event_coaches` joined to
  `events.title` (or "Not assigned to a programme yet — assign from the
  programme's form"). Overflow action **Remove coach access**: confirm, delete
  the `user_roles` row AND their `event_coaches` rows (both admin-manageable
  under RLS), reload.
- Rows for pending invitations (`coach_invitations` where status `invited`,
  readable by admins under RLS): name/email, "Invited {date}" or "Reminded
  {date}", actions **Resend** (calls `send-coach-invitations` with
  `remind_invitation_ids`) and **Revoke** (update status, client-side).
- The People search (`search` prop) filters this section too, on name and email.
- Empty state when there are no coach accounts and no invitations: one line
  saying invite the first coach.

Use the app primitives (Section, ListGroup, ListRow, StatusBadge, EmptyState,
Dialog) like the rest of the panel. `coach_invitations` is not in the
generated types: use the `db = supabase as any` convention.

### Copy

Suffolk Tennis is named in the email, the join page and the section. British
English. Button labels: "Invite a coach", "Accept invitation", "Open the
Coach Hub", "Remove coach access", "Resend", "Revoke".

## Out of scope

- Linking the new account to a `coaches` website profile (`linked_user_id`);
  Ollie does that from the website coach form's existing user picker.
- Coach self-service profile editing.
- Assigning programmes from the coach row (the programme form already does it).

## Verification

- tsc + build clean.
- Security: a signed-in user whose email differs from the invitation cannot
  gain the role; an anonymous caller cannot accept; a revoked token cannot be
  accepted; a non-admin cannot call `send-coach-invitations`.
- Mocked Playwright at 390 and 1280: the Coaches page shows the section with
  one coach account and one pending invitation, the invite dialog opens and
  submits, the join page renders all three signed-in/out states.
