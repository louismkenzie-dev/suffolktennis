# Supabase Setup — Suffolk Tennis

This app runs on its own Supabase project, separate from the Lovable-managed one.

## Project details

| | |
|---|---|
| Project name | `suffolk-tennis` |
| Project ref | `twtmkvorzpvwnznqzcrw` |
| Organization | Nullshift (`mdvywzqisezocwkbvpow`) |
| Region | `eu-west-2` (London) |
| Postgres | 17 |
| API URL | `https://twtmkvorzpvwnznqzcrw.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/twtmkvorzpvwnznqzcrw |

Cost: $10/month on the Nullshift org.

The previous Lovable project ref was `wbwhjhqfkailkumcxmcq`. It no longer appears
anywhere in this repo.

## What is already done

- All 29 migrations in `supabase/migrations/` have been replayed onto the new
  database, in timestamp order.
- 19 tables, all with Row Level Security enabled.
- 4 storage buckets: `child-photos` (private), `report-pdfs` (private),
  `news-media` (public), `player-watch-media` (public).
- Extensions `pg_net`, `pg_cron`, `supabase_vault`, `pgmq`, and the four email
  queues (`auth_emails`, `transactional_emails`, and their DLQs).
- `supabase_migrations.schema_migrations` has been backfilled with all 29
  migration versions, so `supabase db push` is a no-op rather than trying to
  replay everything.
- `supabase/config.toml` and `.env.example` point at the new project.

Schema fidelity was verified by comparing the new database's column signature
against the `types.ts` Lovable generated from the old database: 235 columns
across 19 tables, identical on both sides. `src/integrations/supabase/types.ts`
therefore needs no regeneration.

## What is NOT done yet

### Edge functions: partially deployed, Lovable removal in progress

Four functions are live on the new project (see the deployment status section
at the end). The rest are being converted off Lovable's APIs — email is moving
to Resend, the AI features to the Anthropic API — and deploy as each conversion
lands. Secrets they need (`supabase secrets set NAME=value`, or dashboard →
Edge Functions → Secrets):

| Secret | Used by |
|---|---|
| `RESEND_API_KEY` | process-email-queue, send-transactional-email, auth-email-hook |
| `ANTHROPIC_API_KEY` | compose-news, parse-report |
| `GOOGLE_MAPS_API_KEY` | nearest-clubs |
| `SEND_EMAIL_HOOK_SECRET` | auth-email-hook (from Auth → Hooks when enabling the send-email hook) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically by the platform — do not set those by hand.

### Data migration: COMPLETE (18 Aug 2026)

All data has been migrated from the Lovable project and verified by checksum:
17 auth users (bcrypt password hashes byte-identical, so logins carry over),
17 profiles, 13 children, 1,340 sporting_schedule rows, 2 player reports,
site content (4 coaches, 9 venues, 2 events, 10 news articles, 3 player watch),
and all 49 storage files across the four buckets. Every stored URL now points
at this project or the site's own /migrated-assets/ paths; no reference to the
old Lovable project remains in the data.

### Vault secret and cron job

`20260713100622_email_infra.sql` documents two post-migration steps that are not
static SQL and have not been applied:

1. A vault secret `email_queue_service_role_key` holding the service_role key.
2. A `pg_cron` job `process-email-queue` on a 5-second interval that calls the
   `process-email-queue` edge function via `net.http_post`.

Neither exists on the new project yet (`vault.secrets` and `cron.job` are both
empty). Apply them after the edge functions are deployed, or the cron job will
fire against a function that isn't there.

### There is no admin user

`auth.users` is empty, so nobody has the `admin` role. Two of the migrations try
to seed admins and were no-ops for that reason. The trigger from
`20260720185903` is live though: when `cmelsa@me.com` signs up, that account is
granted `admin` automatically.

To promote anyone else after they have registered:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::app_role from auth.users where lower(email) = lower('someone@example.com')
on conflict do nothing;
```

### Auth redirect URLs

Set these in the dashboard under Authentication → URL Configuration before
going live, otherwise password resets and magic links will point at the wrong
host.

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

The publishable values in `.env.example` are already filled in. The Google Maps
and Mapbox placeholders still need real values.

## Keys

- **Publishable** (`sb_publishable_...`) — safe in the browser, committed in
  `.env.example`. Filtered by RLS.
- **Secret / `service_role`** — bypasses RLS entirely. Server-side only. Never
  commit it, never put it behind a `VITE_` prefix.

## Known issues carried over from Lovable

These came across with the migrations and are worth fixing, but were left as-is
so the new database matches the old one:

1. **The email queue RPCs are callable by anonymous users.**
   `20260713100622_email_infra.sql` intends to lock `enqueue_email`,
   `read_email_batch`, `delete_email` and `move_to_dlq` to `service_role`, but
   `REVOKE EXECUTE ... FROM PUBLIC` does not remove Supabase's default grants to
   `anon` and `authenticated`. All four are currently reachable via
   `/rest/v1/rpc/...` without signing in — `enqueue_email` in particular is a
   spam vector. Fix:
   ```sql
   revoke execute on function public.enqueue_email(text, jsonb) from anon, authenticated;
   revoke execute on function public.read_email_batch(text, int, int) from anon, authenticated;
   revoke execute on function public.delete_email(text, bigint) from anon, authenticated;
   revoke execute on function public.move_to_dlq(text, text, bigint, jsonb) from anon, authenticated;
   ```

2. **A plaintext password sits in the migration history.**
   `20260601130746_...sql` contains `crypt('Tennis26!', ...)` against a hardcoded
   user id. It was a no-op here (that user does not exist in this database), but
   the password is in the git history of a public repo and should be treated as
   compromised wherever it was reused.

3. **Four functions have a mutable `search_path`** (`enqueue_email`,
   `read_email_batch`, `delete_email`, `move_to_dlq`). Add
   `SET search_path = public` to each.

Run `supabase db lint` or check Advisors in the dashboard for the current list.

## Migrating data from Lovable

Three separate things need to come across, because they live in three places:

### 1. Repo image assets (logo, coach photos, tour artwork)

Lovable's repo export replaced 30 images under `src/assets/` with
`*.asset.json` placeholders whose URLs only resolve on Lovable's hosting —
which is why they 404 on Vercel. On a machine with normal internet, from the
repo root:

```bash
node scripts/fetch-lovable-assets.mjs
npm run build          # sanity check
git add -A && git commit -m "Restore image assets from Lovable" && git push
```

The script downloads every missing binary from the live Lovable site, rewrites
the imports to use the real files, and deletes the placeholders. If the live
site is not at suffolktennis.online, pass `--base https://<your-site>`.

### 2. Database rows and users

Produce a data-only dump of the old project (ref `wbwhjhqfkailkumcxmcq`).
Preferred: from the old project's Supabase dashboard get the connection string
(Settings → Database), then locally:

```bash
npx supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.wbwhjhqfkailkumcxmcq.supabase.co:5432/postgres" \
  --data-only -s public -f lovable_public_data.sql
npx supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.wbwhjhqfkailkumcxmcq.supabase.co:5432/postgres" \
  --data-only -s auth -f lovable_auth_data.sql
```

No-CLI fallback: in the old project's SQL editor, run `select * from <table>`
per table and use Download CSV — including `select * from auth.users` and
`select * from auth.identities` (the SQL editor can read the auth schema;
the table UI cannot). `encrypted_password` is a bcrypt hash, so existing
users keep their passwords after import.

**Lovable Cloud projects** (the project is owned by Lovable — no dashboard, no
database password, no service keys): everything still comes out through
Lovable's own SQL editor. Run `json_agg` export queries there and hand over
the JSON output; the data imports from those directly. For storage files,
export a manifest (`select bucket_id, name, metadata->>'mimetype' as mimetype
from storage.objects`), temporarily set the private buckets public
(`update storage.buckets set public = true where id in
('child-photos','report-pdfs');`), run
`scripts/pull-storage-from-lovable.mjs manifest.json` locally (needs only the
NEW project's legacy service_role key), then flip the buckets back private.

**Never commit these dumps — this repo is public and they contain user PII
and password hashes.** Hand them over privately.

Import order on the new project (disable the two `auth.users` triggers first —
`on_auth_user_created` and `on_auth_user_created_grant_cmelsa_admin` — so the
imported `profiles` rows don't collide with trigger-created ones; re-enable
after): `auth.users`, `auth.identities`, then public tables parents-first:
`profiles`, `user_roles`, `children`, `coaches`, `venues`, `events`,
`suffolk_news`, `player_watch`, `news_posts`, `player_progress`,
`player_reports`, `tennis_goals`, `sporting_schedule`, `event_invitations`,
`event_signups`. Afterwards rewrite stored URLs:

```sql
-- repoint uploaded-image URLs at the new project
update public.coaches      set photo_url      = replace(photo_url,      'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw') where photo_url      like '%wbwhjhqfkailkumcxmcq%';
update public.venues       set image_url      = replace(image_url,      'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw') where image_url      like '%wbwhjhqfkailkumcxmcq%';
update public.venues       set logo_url       = replace(logo_url,       'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw') where logo_url       like '%wbwhjhqfkailkumcxmcq%';
update public.suffolk_news set image_url      = replace(image_url,      'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw') where image_url      like '%wbwhjhqfkailkumcxmcq%';
update public.suffolk_news set media          = replace(media::text,    'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw')::jsonb where media::text like '%wbwhjhqfkailkumcxmcq%';
update public.player_watch set main_image_url = replace(main_image_url, 'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw') where main_image_url like '%wbwhjhqfkailkumcxmcq%';
update public.player_watch set gallery        = replace(gallery::text,  'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw')::jsonb where gallery::text like '%wbwhjhqfkailkumcxmcq%';
update public.children     set photo_url      = replace(photo_url,      'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw') where photo_url      like '%wbwhjhqfkailkumcxmcq%';
update public.player_reports set report_pdf_url = replace(report_pdf_url, 'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw') where report_pdf_url like '%wbwhjhqfkailkumcxmcq%';
update public.events       set poster_url     = replace(poster_url,     'wbwhjhqfkailkumcxmcq', 'twtmkvorzpvwnznqzcrw') where poster_url     like '%wbwhjhqfkailkumcxmcq%';
```

### 3. Storage files (admin-uploaded photos, news media, report PDFs)

The bucket contents (child-photos, report-pdfs, news-media,
player-watch-media). On a machine with normal internet:

```bash
OLD_SUPABASE_URL="https://wbwhjhqfkailkumcxmcq.supabase.co" \
OLD_SERVICE_ROLE_KEY="<old service_role key>" \
NEW_SUPABASE_URL="https://twtmkvorzpvwnznqzcrw.supabase.co" \
NEW_SERVICE_ROLE_KEY="<new service_role key>" \
node scripts/migrate-storage.mjs
```

service_role keys come from each project's dashboard → Project Settings → API
keys. Do not commit them, and rotate any key that gets pasted anywhere public.

## Migrations from here on

Schema changes go in `supabase/migrations/` as timestamped SQL files, applied
with `supabase db push`. Don't edit schema by hand in the dashboard — it drifts
from the repo and the next push will fight it.

## Vercel

The site is deployed from this repo's `main` branch to the Vercel project
`suffolktennis` (team: Louis McKenzie's projects, `prj_zUtaqd6JIKPLakM1ndPhS1JSAZ3l`),
live at https://suffolktennis.vercel.app.

Vite inlines `VITE_*` variables at **build** time, so these must be set in
Vercel → Settings → Environment Variables or the app white-screens: the Supabase
client is constructed at module scope and throws `supabaseUrl is required` before
React mounts.

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://twtmkvorzpvwnznqzcrw.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | `twtmkvorzpvwnznqzcrw` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the project's legacy anon key (a JWT) |
| `VITE_MAPBOX_TOKEN` | your Mapbox public token |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | your Google Maps browser key |

Changing an environment variable does not rebuild on its own — trigger a
redeploy afterwards.

## Edge function deployment status

Deployed to the new project so far:

| Function | verify_jwt | Notes |
|---|---|---|
| `postcode-lookup` | true | works now |
| `manage-reports` | true | works now |
| `lta-news` | true | works now |
| `submit-rising-stars-signup` | false | inserts fine; its confirmation emails need `send-transactional-email` |

Still to deploy: `auth-email-hook`, `compose-news`, `handle-email-suppression`,
`handle-email-unsubscribe`, `lta-events`, `lta-rankings`, `nearest-clubs`,
`parse-report`, `preview-transactional-email`, `process-email-queue`,
`send-transactional-email`.

Seven of those read `LOVABLE_API_KEY`, so they are worth deploying only once you
have decided whether to keep Lovable as the mail/AI provider or move to a direct
one.

## Booking system (added 20 Aug 2026)

Invitational booking portal with Stripe payments, mirroring The Dance
Exclusive's payments architecture: Stripe Connect **direct charges** on the
client's connected account using the Nullshift platform's API keys, with a
platform application fee (**2.5% of gross**, the agreed commercial rate,
overridable with `PLATFORM_FEE_PERCENT`). Stripe's own processing fees come
off the connected account, so Suffolk Tennis receives the amount paid less
Stripe's fee less our 2.5%. The rate is pinned by `src/test/platformFee.test.ts`
so it cannot be changed silently.
The sandbox/live switch is server-side in `app_settings.payments_mode`
(currently `live`; flip with
`update app_settings set value='sandbox' where key='payments_mode';`).

Schema: `20260820120000_booking_system.sql` — event visibility
(public/private) + pricing, `event_sessions`, tokenized
`booking_invitations`, `bookings`, `memberships` (monthly programmes as
Stripe subscriptions committed to `programme_months` payments), `tickets`
(QR) and `ticket_scans`.

Edge functions (all deployed): `get-invitation`, `create-booking-checkout`,
`booking-payments-webhook`, `get-booking-status`, `send-booking-invitations`
(admin), `scan-ticket` (admin), `refund-booking` (admin), `coach-session`
(staff; also `notify_report`), `cancel-session` (admin), `register-alerts`
(cron, guard token).

**Refunds (10 Sep 2026)**: `refund-booking` issues the refund on the connected
account with `refund_application_fee: true`, so our 2.5% goes back to Suffolk
Tennis rather than being absorbed by them — Ollie refunding from his own Stripe
dashboard would NOT return the fee, so refunds should be done from the admin
Bookings tab. It voids the entry ticket, and for a monthly programme cancels
the subscription so no further payments are taken. The environment comes from
the booking row, not the current `payments_mode`, so sandbox bookings stay
refundable after go-live.

Frontend: `/book/:token` (invitation booking page), `/booking/return`,
`/ticket/:qrToken` (QR entry ticket), `/admin/scan` (camera scanner), and
the Bookings tab in `/admin` (create events, invite players by age-group
filter, dashboard of invited/booked/paid, failed-payment chase list).

### Secrets to set when the Stripe/Resend accounts are ready

Dashboard → Edge Functions → Secrets:

| Secret | Value |
|---|---|
| `STRIPE_SANDBOX_API_KEY` | Platform account **test** secret key |
| `STRIPE_LIVE_API_KEY` | Platform account **live** secret key |
| `STRIPE_SANDBOX_CONNECTED_ACCOUNT_ID` | `acct_...` of the client's test connected account |
| `STRIPE_LIVE_CONNECTED_ACCOUNT_ID` | `acct_1UE6iZE7yIm0GTnR` (Suffolk Tennis's live connected account) |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | signing secret of the sandbox webhook endpoint |
| `PAYMENTS_LIVE_WEBHOOK_SECRET` | signing secret of the live webhook endpoint |
| `RESEND_API_KEY` | Resend key (invitation + confirmation emails) |
| `SITE_URL` | `https://suffolktennis.vercel.app` (later suffolktennis.online) |

Stripe webhook endpoints (platform account, `connect=true` so direct-charge
events from the connected account are delivered; **pin `api_version` to
`2025-02-24.acacia`** — the handler reads `invoice.subscription`, which newer
API versions removed):

- URL: `https://twtmkvorzpvwnznqzcrw.supabase.co/functions/v1/booking-payments-webhook?env=sandbox` (and `?env=live`)
- Events: `payment_intent.succeeded`, `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`

**Embedded checkout (21 Aug 2026)**: the parent-facing payment moved from
Stripe-hosted Checkout to an embedded Payment Element on `/book/:token`
(brand-themed, no redirect — same as The Dance Exclusive). Server:
`create-booking-checkout` now returns a `client_secret` (+`environment`) —
one-offs are PaymentIntents, programmes are `default_incomplete`
subscriptions whose first-invoice PaymentIntent is confirmed inline; the
membership row is created at subscription-creation time. Fulfilment:
one-offs settle via `payment_intent.succeeded` (bookingId metadata),
programmes via `invoice.payment_succeeded` — the old
`checkout.session.completed` handler remains for the legacy hosted flow.
Client key pairs (publishable key + connected account per env) live in
`src/lib/stripe.ts`; the live connected account is set, but the live
publishable key is still empty, so live mode fails closed until it is filled in.

**Sandbox endpoint created 21 Aug 2026**: `we_1U6qmgE0aLvInrlqpuWFwsap`
(acacia-pinned, connect). Its `whsec_…` signing secret was handed to Louis to
paste as `PAYMENTS_SANDBOX_WEBHOOK_SECRET`. Sandbox connected account:
`acct_1TnJ2NE0aLUyRazc` ("Test account", fully onboarded, charges enabled —
replaced `acct_1U6qXsE0aLYAntjY`, which never completed onboarding). **Live endpoint created 10 Sep 2026**: `we_1UE9jS2QyV8RYLwsxENhbH4Q`
(acacia-pinned, connect, four events) → `?env=live`; its signing secret is
`PAYMENTS_LIVE_WEBHOOK_SECRET`. Live connected account `acct_1UE6iZE7yIm0GTnR`
("Suffolk Tennis", Standard) verified charges- and payouts-enabled with card
payments and transfers active. The live publishable key is in
`src/lib/stripe.ts`.

**Live end-to-end test passed 10 Sep 2026**: a £1 private demo event, real card,
webhook settled the booking and issued the ticket; PaymentIntent
`pi_3UE9qPE7yIm0GTnR0jmJZg2r` on the connected account with a 3p application
fee (2.5% of £1, rounded up — the smallest possible fee); refunded in full
with `refund_application_fee: true` (`re_3UE9qPE7yIm0GTnR00cRYkay`). Demo rows
removed. `payments_mode` is now **live**, and bookings are **open site-wide**
(`20260911120000_open_bookings.sql`): the `bookings_status` pre-launch wall was
only ever there to keep parents away from a sandbox payment form, so with
Stripe live it has been removed from `paymentsMode.ts`, `get-invitation`,
`create-booking-checkout` and the booking page. Nothing reads the
`bookings_status` key any more. Applied live on 11 Sep: the row reads `open`,
`get-invitation` (v17) and `create-booking-checkout` (v21) are redeployed
without the wall, and both were smoke-tested through pg_net — get-invitation
returns 200 with no `bookings_status` field, create-booking-checkout reaches
its 401 sign-in gate instead of the old 503. The booking page itself only
stops showing "Booking opens soon" once the front-end change reaches `main`,
since Vercel builds production from that branch. A temporary `stripe-bootstrap` edge function (guard-token
protected form-encoding relay for pg_net → Stripe API calls) is deployed for
sandbox setup — **delete it once testing is done**.

Verified without keys: `get-invitation` serves private events by token
(HTTP 200 end-to-end), and `create-booking-checkout` fails cleanly when
Stripe is unconfigured (booking rolled back to cancelled — no capacity
leak). With keys set, the same call returns the hosted checkout URL.

### Events, programmes and free places (10 Sep 2026)

Ollie's pricing model replaced the monthly subscriptions
(`20260910120000_event_programme_model.sql`):

- `events.programme_type` is now `event` (a session or camp) or `programme`
  (a season squad). Old values were migrated (`one_off` → `event`,
  `monthly_programme` → `programme`).
- A **programme is one up-front payment** of `price_pence` (£250 by default)
  covering every session; `meeting_cadence` (`weekly` | `monthly`) is display
  only. Programmes have no capacity. No new subscriptions are created — the
  `memberships` table and the invoice webhook handlers remain for the two
  legacy sandbox rows only.
- An **event** can be free (`is_free`), in which case booking never touches
  Stripe.
- **Complimentary places**: a child with a paid programme booking is included
  on any other programme at no extra charge. `send-booking-invitations` checks
  `child_has_paid_programme(child_id)` (roster players resolve through
  `player_roster.linked_child_id`) and flags the invitation
  `complimentary`; admins can also tick "free place" in the invite picker to
  grant one on any event. `create-booking-checkout` settles free and
  complimentary bookings immediately through `_shared/fulfilment.ts` (the
  same ticket + confirmation path the webhook uses), returning `{ free: true }`
  so the booking page skips the Payment Element.
- Invitation emails now mention the bespoke per-session coach report and the
  "other programmes at no extra charge once your own is paid" rule.

**Coach reports**: the Coach Hub shows every previous session report on a
player (any event, any coach — staff RLS on `session_reports` already allowed
it), and the first save of a report calls `coach-session` `notify_report`,
which emails the parent a summary with a link to their hub. Edits don't
re-notify.

**People tab** (`src/components/admin/PeoplePanel.tsx`): the county database
in one place — search/filter the roster, add/edit/remove players, bulk age
group / tag / email-group changes, and link registered children to their
roster row. Children with no roster row ("Registered, not on database") can
be added and linked in one click. 11 children were auto-linked on 10 Sep by
parent email + name (Freddie and Noah Sutton among them); Ollie couldn't find
Freddie because there was no roster page at all, only the invite picker.

### Additions from the dance-platform handover (10 Sep 2026)

Purely additive; nothing existing was removed
(`20260910150000_session_changes_and_register_alerts.sql`).

- **Duplicate-booking guard** — `create-booking-checkout` returns 409
  `already_booked` when the child already has a paid place on the event,
  before any Stripe object is created. Cancelled events return 410.
- **Session cancel / move, event cancel** — `cancel-session` (admin).
  A cancelled session keeps its row (`cancelled_at`, `cancel_reason`) so
  reports and scans stay attached; a moved session keeps `moved_from_date` /
  `moved_from_start`. `events.cancelled_at` cancels a whole one-off event.
  Every parent with a paid place is emailed once per change (idempotent on
  the change timestamp). **No money moves** — refunds stay on the per-booking
  Refund button, and the admin dialog says so. Cancelled sessions drop out of
  the Coach Hub, the ticket page's upcoming list and the register watcher;
  parents see them struck through with a reason on the booking page.
  Admin controls are on the session chips in the Bookings tab (move / cancel
  / delete-silently) plus a "Cancel event" button.
- **Register watcher** — `register-alerts`, guard-token protected, run by
  `pg_cron` job `register-alerts` every 10 minutes via `pg_net`. A session
  that started 15–75 minutes ago (Europe/London) with paid players and no
  admitted scans gets one email to `ADMIN_NOTIFY_EMAIL`. The claim table
  `register_alerts (session_id, kind)` is written BEFORE the send and deleted
  on failure, so a retry can't double-send and a success can't repeat.
- **Report-notification claim** — `session_reports.notified_at` is stamped by
  `coach-session notify_report` before the email (matching only unstamped
  rows) and cleared if Resend fails.
- **12-hour times** on parent-facing screens via `src/lib/timeFormat.ts`
  ("1.30–3.30pm"); 24-hour stays everywhere values are stored or compared.
- **Add-to-calendar** (Google / Outlook links) per upcoming session on the
  ticket page.
- **Mobile foundation** in `src/index.css`: `overflow-x: clip`, 16px inputs
  on phones, `touch-action: manipulation`, and `.max-h-dialog` / `.h-dialog`
  (dvh with vh fallback) on every tall dialog.

### Player roster (added 21 Aug 2026)

`player_roster` (migration `20260821110000`) holds the county's player
database — 716 players imported from the LTA RCP report (checksum-verified),
admin-only RLS. The admin Bookings tab's invite picker draws from the roster
merged with registered families, filterable by age group (8U–Open) and
gender, and a CSV re-import button accepts future RCP exports (upsert on LTA
number). `booking_invitations.roster_id` anchors re-invite dedupe for roster
players. Parents see their invitations, bookings and tickets in the Parent
Hub's "Bookings & Invitations" tab.

## Registers and session reports (added 11 Sep 2026)

Contract: `docs/REGISTERS-SPEC.md`. Migration
`20260911100000_registers_and_session_reports.sql` (already applied) adds
`event_coaches`, `session_attendance`, the nine-area columns on
`session_reports` (`ratings`, `area_notes`, `complete`, `sent_at`) and the
end stamps `event_sessions.ended_at/ended_by`, `events.register_closed_at`.

**`coach-session`** (verify_jwt true; coach or admin) gains the actions
`venues`, `programmes`, `sessions`, `register`, `attendance`, `save_report`
and `end_session`, alongside the older `events`/`roster`/`mark`/
`notify_report`. Every action is scoped: admins see everything, coaches only
events they are assigned to in `event_coaches` (403 otherwise). Attendance
and report writes go through the service role here because both tables use
partial unique indexes (`session_id` null vs not) that a PostgREST upsert
can't target — the shared `upsertAttendance` in `_shared/reportEmails.ts`
does find-then-update/insert with a 23505 retry. `end_session` marks the
listed bookings absent (source `auto`, only where nothing is recorded),
stamps the end, then calls `sendDueForSession`.

**`scan-ticket`** now also writes `session_attendance` (`arrived`, source
`scan`) on the admitted path only; a `duplicate` result never touches it. It
is scoped like `coach-session` (coaches only for their `event_coaches`
assignments; admins anything), checks the `session_id` belongs to the
ticket's event, and answers every outcome with a 200 `{ok, result, message,
player}` (`unknown`, `forbidden`, `wrong_event`, `rejected_*`, `duplicate`,
`admitted`) because supabase-js swallows non-2xx bodies.

**`_shared/reportEmails.ts`** — `sendReportReadyEmail(admin, reportId)`
("View report" → `/report/:id`, idempotency `report-sent-<id>`) and
`sendAbsenceEmail(admin, attendanceId)` (idempotency `absence-<id>`). Both
claim before sending (`update … where <stamp> is null … select`), return
`already_sent` if nothing was claimed, and clear the stamp if Resend fails.
`sendDueForSession(admin, {event_id, session_id|null})` sends every complete
unsent report (any coach) and every un-notified absence for one session,
spacing sends 600 ms apart to stay under Resend's 2 req/s limit.

**`session-reports-dispatch`** (verify_jwt false; guard token
`sr_9b2e7c1d4f8a3e6b0c5d7f2a9e1b4c8d` in the JSON body). Every 10 minutes it
starts from what is still pending — complete reports with `sent_at` null and
absent rows with `absence_notified_at` null — groups them by session, and
sends for every session whose end (`end_time`, else `start_time` + 2h, else
12:00 + 2h, Europe/London) passed at least 2 hours ago; session-less events
count from `register_closed_at`, else `event_date` + 2h. Being driven by the
pending rows rather than the calendar, a report written a week after its
session still goes out on the next run. Capped at 80 emails per run
(`truncated: true` when it stops early). Returns `{checked, sessions_due,
events_due, reports_sent, absence_emails, truncated, errors}`.

Cron job (added 11 Sep 2026 as jobid 2, mirrors `register-alerts`):

```sql
select cron.schedule(
  'session-reports-dispatch',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://twtmkvorzpvwnznqzcrw.supabase.co/functions/v1/session-reports-dispatch',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"guard":"sr_9b2e7c1d4f8a3e6b0c5d7f2a9e1b4c8d"}'::jsonb
  );
  $$
);
```

Deployed 11 Sep 2026: `coach-session` v13 and `scan-ticket` v15 (verify_jwt
true), `session-reports-dispatch` v1 (verify_jwt false). `RESEND_API_KEY` and
`SITE_URL` are the only secrets involved and already exist.

## Per-session QR tickets (added 11 Sep 2026)

Contract: `docs/SESSION-TICKETS-SPEC.md`. Migration
`20260911140000_session_tickets.sql` (already applied) adds
`session_tickets(id, booking_id, event_id, session_id|null, child_id,
qr_token, status, reminder_12h_sent_at, reminder_1h_sent_at, created_at)` —
one entry code per child per session, `session_id` null for a one-off event
with no session rows. Uniqueness is two PARTIAL indexes (per
`(booking_id, session_id)`, and per `booking_id` where `session_id is null`),
so a PostgREST `.upsert()` cannot target them: `ensureSessionTicket` in
`_shared/sessionTickets.ts` does find-then-insert with a 23505 retry, the
same shape as `upsertAttendance`. RLS: staff read all, a parent reads their
own bookings' tickets, admins manage. Rows are minted **lazily** by
`session-reminders` about 12 hours before the session, so a 30-week programme
does not sit on thousands of unused codes. `public.tickets` (the old
one-per-booking season ticket) is untouched and every code already emailed
keeps working.

**`_shared/sessionTickets.ts`** — `ensureSessionTicket(admin, {booking,
event_id, session_id})`, `resolveScanTarget(admin, {token, hintSessionId})`,
and the Europe/London wall-clock helpers (`londonInstant`, `sessionStart`,
`sessionEnd`, `minutesUntil`, `londonDateOf`, `londonTimeLabel`,
`timeRangeLabel`), because every "which session is running" and "how long
until it starts" decision is a wall-clock one and Deno runs in UTC.

**Resolution order** (`resolveScanTarget`, and the same first-then-second
order in `get-booking-status`):

1. `session_tickets.qr_token` → booking **and** session, authoritative;
   `resolved_from: "qr"`.
2. `tickets.qr_token` (legacy season ticket) → booking and event, then the
   session from the clock: the event's uncancelled session whose window
   `[start − 2h, end + 2h]` spans now, nearest start first
   (`resolved_from: "clock"`). An event with **no session rows at all** is a
   one-off day — a null session is the right answer, not an error. If the
   event has sessions but none is running, the caller's open register is used
   as a hint when it belongs to that event (`resolved_from: "hint"`),
   otherwise `result: "no_session"`.
3. No match in either table → `result: "unknown"`.

**`scan-ticket`** no longer needs a session from the client: `session_id` in
the body is only the hint for step 2. Scope, the void / unpaid / past-due
gates, the duplicate check (now against the **resolved** session, and never
overwriting the original arrival time) and the `session_attendance` upsert on
admission are unchanged. Every outcome is still a 200, now with
`{ok, result, message, player: {…, age_group, medical_notes}, session, event,
booking_id, resolved_from}`; `age_group` uses the same LTA year-group rule as
the register (age on 1 January) and `medical_notes` the same
booking-then-child-profile order. `ticket_scans.result` is CHECK-constrained
to `admitted|rejected_unpaid|rejected_void|duplicate`, so `no_session`,
`wrong_event`, `forbidden` and `unknown` are returned but never logged there;
the audit row hangs off the booking's season ticket (`ticket_scans.ticket_id`
is NOT NULL against `public.tickets`), and a booking that somehow has none
falls back to its attendance row for the duplicate test.

**`get-booking-status`** matches `session_tickets` first, then `tickets`. A
session token returns `session: {id, session_date, start_time, end_time,
venue}`, `ticket.scope: "session"` and an empty `upcoming_sessions` (the page
is about one session); a season token or a checkout return is unchanged apart
from the added `ticket.scope: "season"` and `session: null`.

**`session-reminders`** (verify_jwt false; guard token
`st_7c4e9a1f6b2d8e3a5c0f9b4d7e1a6c2f` in the JSON body). Every 10 minutes it
finds uncancelled sessions starting within the next 12h45m (London) plus
one-off events with no session rows whose `event_date` falls in the same
window, ensures a `session_tickets` row for every **paid** booking on them,
then emails the parent: the 12-hour reminder when the session starts in
60–765 minutes and `reminder_12h_sent_at` is null, the 1-hour reminder when
it starts in 0–75 minutes and `reminder_1h_sent_at` is null (the 1-hour one
wins the overlap, so a late-minted ticket never sends both at once). Claim
before send — the column is stamped first and only where still null, cleared
if Resend throws — so overlapping runs can't double-send. Sessions with no
`start_time` are skipped: there is no hour to remind against and guessing one
would put a wrong time in the subject. Capped at 80 emails per run
(`truncated: true` when it stops early). Returns `{sessions_due,
tickets_created, reminders_12h, reminders_1h, truncated, errors}`.

Subjects: `{Child}'s tennis session tomorrow` (or `… today` when the session
is on the same London date as the send) and `{Child}'s session starts at
{1.30pm}`. The body names the event, date, time range and venue, then a
**Show entry QR code** button → `${SITE_URL}/ticket/${qr_token}`. The QR
image is deliberately **not** in the email: Gmail strips data-URI images and
blocks remote ones, so the button opens the ticket page, which draws the code
locally. Idempotency keys `reminder-12h-<ticket id>` /
`reminder-1h-<ticket id>`; unsubscribe source `reminder`.

Cron job (mirrors `register-alerts` and `session-reports-dispatch`):

```sql
select cron.schedule(
  'session-reminders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://twtmkvorzpvwnznqzcrw.supabase.co/functions/v1/session-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"guard":"st_7c4e9a1f6b2d8e3a5c0f9b4d7e1a6c2f"}'::jsonb
  );
  $$
);
```

`RESEND_API_KEY` and `SITE_URL` are the only secrets involved and already
exist.

---

## Email delivery tracking (13 Sep 2026)

A parent reported never receiving his invitation. Nothing in the system could
answer the question: `sendEmail` returned Resend's message id and every caller
threw it away, and `email_send_log` was never written to. Checking meant
reading Resend's dashboard by hand.

Now every send is recorded and its outcome is shown next to the parent.

### `public.email_deliveries`

One row per message, keyed by Resend's own id:

| column | meaning |
| --- | --- |
| `resend_id` | Resend's message id (unique) — the join key when we poll |
| `recipient`, `subject`, `purpose` | who, what, and which flow sent it |
| `invitation_id` | `booking_invitations` row, when it was an invitation |
| `coach_invitation_id` | `coach_invitations` row, for coach invitations |
| `event_id` | the programme, for filtering |
| `status` | Resend's `last_event`: `sent`, `delivered`, `delivery_delayed`, `bounced`, `complained` |
| `status_at`, `detail` | when that status landed, and the bounce reason if given |

RLS: admins read, service role writes. Verified — admin 160 rows, coach 0,
anon 0.

`public.email_delivery_rank(status)` orders the states so later news always
wins: a delivered message that later bounces stays bounced, and a stale
`sent` never drags a settled row backwards. `email-delivery-sync` and
`src/lib/emailDelivery.ts` mirror the same ranking.

### Writing the rows

`supabase/functions/_shared/emailDeliveries.ts` exports `recordDelivery`,
called by `send-booking-invitations` (invitations and reminders) and
`send-coach-invitations`. It never throws: a bookkeeping failure must not fail
a send that succeeded.

### `email-delivery-sync`

Guard-token protected, `verify_jwt = false`, run every 10 minutes by pg_cron
(jobid 4). Two passes, cheapest first:

1. One call to `GET /emails?limit=100` covers the last 100 messages on the
   account — everything recent in the normal case.
2. Anything still unsettled after 15 minutes is fetched by id, capped at 25
   per run.

A hard bounce or spam complaint is also written to `suppressed_emails`.

```sql
select cron.schedule(
  'email-delivery-sync',
  '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://twtmkvorzpvwnznqzcrw.supabase.co/functions/v1/email-delivery-sync',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"guard":"ed_2f7a9c4e1b6d8035af2c7e9b1d4a6f83"}'::jsonb,
       timeout_milliseconds := 55000
     ) $$
);
```

Note the Resend account is shared across several Nullshift projects, so the
list pass sees other projects' messages too; matching is by `resend_id`, never
by position in the list.

### What the admin sees

`BookingsPanel` shows an **Email** column on the invitation list —
Delivered / Bounced / Marked as spam / Delayed / Sending — plus a red banner
naming every parent whose invitation was rejected. `CoachesPanel` shows the
same badge on pending coach invitations. A parent invited and then reminded
has two messages; the worst outcome is the one shown, so a bounce is never
hidden behind a later "delivered".

### Backfill, 11–13 Sep 2026

160 messages were reconstructed from the Resend list endpoint, with all 107
booking invitations linked to their rows. Result: 106 delivered, 1 bounced
(`msimpson46@googlemail.co.uk` — the domain has no MX record at all, so it is
a typo and could never receive), plus one bounced coach invitation
(`conor.mcdonald@culford.co.uk`).

### Still outstanding: DMARC

`_dmarc.suffolktennis.online` returns NXDOMAIN. DKIM, SPF and the return-path
MX are all correct, but Yahoo (who run BT Internet) and Microsoft have
required DMARC from bulk senders since early 2024, and 62 of the 107
invitation addresses are at one of those two. Add at IONOS:

```
TXT  _dmarc  v=DMARC1; p=none; rua=mailto:enquiries@suffolktennis.online; adkim=r; aspf=r
```

Monitor-only, so it cannot block anything — it just tells the big providers we
are an authenticated sender.

---

## Monthly programme payments (13 Sep 2026)

Ollie's model, confirmed deliberate: a programme costs **£275 paid in full**, or
**£25 a month for 12 months — £300**. The monthly total is higher on purpose,
so paying up front carries a £25 discount and spreading the cost carries a
small premium for the flexibility. Every screen states that difference rather
than presenting two prices as if they were equal.

Monthly is a **commitment**, not a rolling subscription.

### Where the numbers live

`events.price_pence` (up front), `events.monthly_amount_pence` and
`events.programme_months`. Leave the monthly price blank and the programme is
pay-in-full only — nothing else changes. One module computes and words all of
it: `src/lib/programmePricing.ts`, mirrored for Deno at
`supabase/functions/_shared/programmePricing.ts`. Keep the two in step.

`commitmentSentence()` is used verbatim on the booking page, in the invitation
email and in the confirmation email, so a parent reads the same sentence
everywhere.

### Making Stripe charge twelve times, and only twelve

`create-booking-checkout` creates a subscription on the connected account:

| parameter | why |
| --- | --- |
| `payment_behavior: "default_incomplete"` | nothing is charged until the parent confirms the first invoice on our own page |
| `save_default_payment_method: "on_subscription"` | the card is kept, so months 2–12 are taken automatically with nothing for the parent to do |
| `cancel_at` = start + N months − 1 hour | pinned just inside the final billing period: after the twelfth invoice is raised, before a thirteenth ever could be |
| `application_fee_percent` | the platform's 2.5%, same as one-off charges |
| `price_data.product` | a real Product id. **`product_data` is a Checkout-Session convenience and the Subscriptions API rejects it** — one product per programme, addressed by the deterministic id `suffolk_prog_<eventId>` |

The month arithmetic (`addMonthsClamped`) reproduces Stripe's own rule —
same day of month, clamped to the target month's length — so the cancel date
lands on Stripe's schedule to the hour. 31 Jan walks 28 Feb, 31 Mar, 30 Apr …
and back to 31 Jan.

Two independent guarantees against a thirteenth charge: `cancel_at` on the
subscription, and the webhook cancelling once `months_paid` reaches
`months_total`. Either alone is sufficient.

`memberships.paid_invoice_ids` makes `invoice.payment_succeeded` idempotent.
Stripe can redeliver an event, and counting one month twice would end a
twelve-month commitment after eleven real payments.

The membership row is written by the checkout function, not a webhook: the
embedded Payment Element flow has no Checkout Session to hang it off.

### Recording the parent's consent

`bookings.payment_plan` ('full' | 'monthly') and
`bookings.commitment_accepted_at`, with a CHECK constraint that a monthly
booking cannot exist without an acceptance timestamp. The server refuses
`payment_plan: "monthly"` unless the programme offers it **and**
`commitment_accepted: true` came with the request — a client that skips either
gets the up-front price, never a silent subscription.

### What the parent sees

Two radio options with the saving on one and the total on the other; choosing
monthly opens an amber panel (charged today then the same date each month, 12
payments, £300, card saved, payments due whether or not every session is
attended) and a tick box restating it, which the Continue button is disabled
until they accept. The commitment is repeated above the card form and in the
confirmation email.

### Verified, 13 Sep 2026

`stripe-selftest` (guard-token protected, sandbox only, creates and destroys
its own objects) built a subscription with the production parameters and read
back what Stripe actually stored:

```
interval month · unit_amount 2500 · collection_method charge_automatically
save_default_payment_method on_subscription · application_fee_percent 2.5
start 2026-09-13T12:49:27Z · first period end 2026-10-13 · cancel_at 2027-09-13T11:49:26Z
cancel_at_matches_requested true · first invoice £25 with a client secret · status incomplete
```

It also caught the `product_data` rejection before any parent could hit it.

Webhook endpoints, both environments, checked the same way: enabled, pinned to
`2025-02-24.acacia`, subscribed to `payment_intent.succeeded`,
`checkout.session.completed`, `invoice.payment_succeeded`,
`invoice.payment_failed`. Live is `we_1UE9jS2QyV8RYLwsxENhbH4Q`, sandbox
`we_1U6qmgE0aLvInrlqpuWFwsap`.

### Live to parents, 13 Sep 2026

Switched on across all twelve County Training programmes at Louis's
instruction: `monthly_amount_pence = 2500`, `programme_months = 12` against
the £275 up-front price. Verified afterwards through the real chain — a live
invitation token posted to the deployed `get-invitation` came back with
£275 / £25 / 12 months — with no side effect on the invitation (a row already
marked `opened`, whose update is guarded on `status = 'invited'`).

Because the invitations already in inboxes quote £275 and nothing else, the
booking page marks the monthly option **New** and says it is a new financing
option added because parents asked for it. The invitation email does not yet
carry that wording; it states both prices plainly, which is enough for anyone
invited from now on.

`app_settings.payments_mode` is **live**. The monthly path is proved against
Stripe's API but the first real card through it will be a parent's. If that
matters, put one £25 booking through and refund it (the refund button cancels
the plan too). Then delete `stripe-selftest`.

### The `product_data` failure, 13 Sep 2026 — and the fix

Between roughly 14:30 and 17:35 London, **every** attempt to pay monthly
failed at the last step. The Subscriptions API rejects
`items[0].price_data.product_data` (a Checkout Session convenience), so
`subscriptions.create` returned

> Received unknown parameter: items[0][price_data][product_data]. Did you mean product?

and `create-booking-checkout` returned "payment setup failed". Eleven
attempts were lost this way: eight by one parent across two children, three
by another. **No money moved** — every one of those bookings is `cancelled`
with `stripe_payment_intent_id = null`, and no `memberships` row was written
(the membership is only created after Stripe returns a subscription).

Cause of the outage: the defect was found and fixed in the source, but only
`stripe-selftest` was redeployed. The live checkout stayed on v23 for three
hours while the monthly option was switched on for parents.

The fix creates a real Product per programme, addressed by a deterministic id
(`suffolk_prog_<event id without dashes>`) with retrieve-or-create so the
second parent on a programme reuses it, and passes `product: product.id`.
Deployed as `create-booking-checkout` **v24**.

Verified afterwards on the **live** connected account (`acct_1UE6iZE7yIm0GTnR`),
not just in sandbox: `stripe-selftest` gained an opt-in live build
(`live_verify: true` plus `env: "live"`) which creates the subscription with
production's exact parameters and removes everything it made. It returned
`status: incomplete`, `interval: month`, `unit_amount: 2500`,
`application_fee_percent: 2.5`, `cancel_at` exactly twelve months less an
hour, and a client secret on the first invoice. Nothing was charged: an
incomplete subscription with no payment method attached takes no money and
Stripe expires it within a day.

Lesson recorded because it cost parents their time: a fix is not live until
the function that serves parents has been redeployed and the deployed source
has been read back.

### Signup confirmation: the localhost link, 13 Sep 2026

A parent (Brad Warwick) reported that confirming his account was impossible:
the button in the email went to `localhost`, typing the code gave "Token has
expired or is invalid", and asking for a new code produced no email. All
three symptoms, one cause chain — and his account was confirmed the whole
time (`auth.users.email_confirmed_at` 20:09:36, four seconds after the link
was tapped).

1. `auth-email-hook` builds the button as
   `<SUPABASE_URL>/auth/v1/verify?...&redirect_to=<email_data.redirect_to || SITE_URL>`.
   The client never passed `emailRedirectTo`, so GoTrue filled `redirect_to`
   from the project's **Site URL**, which is still `http://localhost:3000`.
   The verify endpoint confirmed him and then bounced him to localhost, where
   Safari said it could not connect. The confirmation had already happened;
   the failure was only the landing.
2. The code was then spent. A signup token is consumed by whichever route is
   used first, so typing it after tapping the button always says expired.
3. `supabase.auth.resend({ type: "signup" })` will not resend to an address
   GoTrue has already confirmed, so nothing arrived.

`Auth.tsx` now passes `emailRedirectTo` explicitly
(`<origin>/auth?confirmed=1`, carrying any `redirect` target through), so the
button's destination no longer depends on a dashboard setting. That page says
"Your email is confirmed — sign in with the password you chose". A spent code
and a refused resend both now say the same thing rather than reading as dead
ends.

Still worth doing in the dashboard: Authentication → URL Configuration → set
**Site URL** to `https://suffolktennis.online` and keep
`https://suffolktennis.online/**` in the redirect allow-list. Every auth email
sent before this deploy still carries a localhost landing.

Note for later: auth emails are sent through `auth-email-hook`, which does not
yet call `recordDelivery`, so signup and reset mail is absent from
`email_deliveries`. Invitations and reminders are covered; account mail is not.

### Account emails join the delivery record

`auth-email-hook` now calls `recordDelivery` with `purpose: auth_<action>`
(`auth_signup`, `auth_recovery`, `auth_magic_link`, …), so confirmations and
password resets sit in `email_deliveries` beside invitations and reminders and
are picked up by `email-delivery-sync` like anything else. Deployed as v13;
the live function still answers an unsigned request with 401, which is the
check that its imports resolve.

The admin Email panel gains a **Delivery** tab: search any address and see
every message sent to it with Resend's verdict, or leave the box empty for the
sixty most recent. "Problems only" narrows to bounces, delays and spam
reports. `purposeLabel()` in `src/lib/emailDelivery.ts` turns the stored code
into words — a purpose it has never seen is tidied rather than hidden, so a
new kind of email is readable the day it is added.

Existing rows were reclassified from `other` by subject (20 signup
confirmations, 3 password resets, 12 booking confirmations).

**Careful with any backfill from Resend: the Resend account is shared with
The Dance Exclusive.** A pass over `/emails` pulled 29 of their messages into
this project's table before the mistake was spotted; they were deleted within
the minute. Every Resend-derived insert must filter on
`from ilike '%suffolktennis.online%'` — the Dance Exclusive sends as
`bookings@nullshift.co.uk`. `email-delivery-sync` is safe by construction: it
only ever updates rows already keyed to a message this project sent.

### The false "payment failed" alert, 13 Sep 2026

Both monthly sign-ups tonight sent Ollie a "Monthly payment failed" alert
reading "Paid so far: 0 of 12 months" — while the payment was in fact fine.

A subscription created with `payment_behavior: "default_incomplete"` has its
first invoice raised before any card is attached, so Stripe's own opening
attempt fails and fires `invoice.payment_failed` about twenty seconds before
the parent has confirmed anything. The sequence in the logs is identical both
times:

```
17:58:57Z  subscription created (membership incomplete)
17:59:50Z  invoice.payment_failed     <- Stripe's opening attempt, no card yet
18:01:04Z  invoice.payment_succeeded  <- the parent confirms; membership active
```

`handleInvoiceFailed` treated that as dunning: it marked the membership
`past_due`, emailed the admins, and was then overwritten by the success a
minute later. Both memberships ended up correct (`active`, 1 of 12 paid) — but
only because the events arrived in that order. Reversed, a paid-up child's QR
code would have refused to admit them.

The handler now ignores a failure when `billing_reason` is
`subscription_create` or the membership is still `incomplete`, ignores one for
an invoice already in `paid_invoice_ids`, and only ever demotes a membership
that is `active` or already `past_due`. A genuine decline at sign-up needs no
alert either: the parent sees it in the payment form, no place is created and
nothing is owed. Only months two to twelve are the club's to chase. Deployed
as booking-payments-webhook **v21**, deployed source read back to confirm.

Unrelated but worth knowing: the platform webhook endpoint has `connect=true`,
so it receives events from **every** connected account on the Nullshift
platform — The Dance Exclusive's included. Those log as "invoice for unknown
subscription" and are correctly ignored, because every handler resolves the
membership by subscription id first.

### Parents locked out by Supabase's email rate limit, 14 Sep 2026

A parent (Anna Campbell, Archie's mother) wrote that she kept "getting errors
on the page" and could not reset her password before Wednesday's deadline. The
auth logs show it was never her:

```
over_email_send_rate_limit  /signup    11
over_email_send_rate_limit  /recover    6
hook_timeout                /recover    1
```

in 24 hours, across **seven different parents** — aliceowen82@hotmail.com,
info@suffolkwedding.com, katiewitherley@hotmail.com, peter_biven@hotmail.com,
handbaghannah@yahoo.co.uk, annaprus2508@gmail.com and m.prus82@gmail.com.
Supabase Auth caps how many account emails the whole project may send per
hour, and that cap is enforced BEFORE the Send Email hook runs, so Resend
never sees the message. The parent is told "email rate limit exceeded", which
reads as though their address is at fault, so they try again immediately —
which is the only thing that cannot work.

**Fix, dashboard only:** Authentication → Rate Limits → *Rate limit for sending
emails*. It must be raised well above the sign-up rate (a sign-up weekend puts
fifty-plus accounts through in two days, and every confirmation, resend and
reset counts).

Two code-side fixes shipped alongside:

1. `auth-email-hook` was also timing out. GoTrue abandons the hook after
   **five seconds** and then refuses the request, so a parent gets an error and
   no email at all — which is what happened to Anna's 13:00 reset. The hook now
   does the minimum on that path: no supabase-js import (it dominated the cold
   start), no unsubscribe-token lookup (two round trips, and account mail is
   transactional so an unsubscribe never applied to it), and one plain REST
   write to record the send. Deployed as v14.
2. The sign-in page no longer shows GoTrue's raw wording. A send-limit refusal
   now says the email service is busy, that nothing is wrong with their
   address, to wait about fifteen minutes, and gives them
   enquiries@suffolktennis.online.

### "Sign up again" is a silent dead end, 14 Sep 2026

Peter Biven reported sign-up still broken after the rate limit was raised. He
was not hitting the limit: at 12:56:24Z his request logged as
`user_repeated_signup`. His account has existed since 12 July and is
confirmed, so Supabase — which will not reveal that an address is already
registered, since that would let anyone test which parents have accounts —
accepted the request, sent nothing, and returned success. The page then told
him to check his email for a message that was never coming.

The tell is in the response: a repeated signup returns a user whose
`identities` array is empty. `Auth.tsx` now checks for that and says "You
already have an account", switches to the sign-in form and points at
"Forgot password?" instead of the code box.

His account was fine throughout — `recovery_sent_at` was null only because
every earlier reset attempt had been refused by the rate limit. One reset,
sent once the limit was raised, put him back in.

Worth knowing for the next one: `user_repeated_signup` in the auth logs means
a parent is trying to create an account they already have. It is not an error
and never appears as one.

### A programme's venue lives on its sessions, 14 Sep 2026

A season is often split between clubs — the 9U runs four Sundays at Culford
(Sept–Dec, 1.30–3.30pm) and then seven at David Lloyd Ipswich (Jan–Jul,
1–3pm) — while `events.location` holds one venue. For the 9U it holds
"Ipswich Sports Club", which is neither of them.

The booking page, the parent's booking detail and the invitation email already
derived their wording from the sessions via `venueRuns` / `venueLine` /
`venueRunsSentence`. Two places still quoted `events.location` on its own and
now do the same: the **booking confirmation email**
(`_shared/fulfilment.ts` — it also carries the "first 4 are at X, then the
remaining 7 are at Y" sentence) and the **whole-programme ticket header**
(`src/pages/TicketPage.tsx`; a per-session ticket already showed its own
venue).

The gap that remained was editing. Venues could only be set per generator run
when the sessions were created, or by "moving" a session — which requires a
new date and emails every parent. The programme screen now has a **Venues**
button opening one row per date with a venue picker, plus an arrow that copies
a venue down to every later session, which is how a season gets split in a few
taps. It saves only the rows that actually changed and is explicit that it
emails nobody; the Move action remains the route when parents have already
been told.

`events.location` stays as the default applied to newly generated sessions,
not as the thing parents read.

**Still to deploy:** `_shared/fulfilment.ts` is bundled into two functions.
`booking-payments-webhook` is on the new copy (**v22**, boot-checked), which
covers every paid booking. `create-booking-checkout` still carries the old
copy, so a **free or complimentary** booking's confirmation email quotes
`events.location` rather than the venue list. Narrow and harmless, but it is a
real divergence between this repo and production: redeploy that function —
carefully, it is the live payment path — to close it.

### Sending an invitation to the other parent, 16 Sep 2026

Ollie asked whether an invitation could be resent to a different address —
Mum's rather than Dad's — or whether that meant a second player profile. It
meant neither, and forwarding the link does not work either: the booking link
is personal. `create-booking-checkout` refuses it unless the signed-in
account matches `booking_invitations.parent_email` (or the linked
`parent_user_id`), with "This invitation was sent to a different email
address". So the invitation itself has to move.

An invitation row now has **Change email**: it writes the new
`parent_email`, clears `parent_user_id` — otherwise the first parent's linked
account still satisfies the ownership check and could book while the other is
locked out — and then sends through the existing reminder path, whose wording
("Your invitation is waiting") reads correctly to someone seeing it for the
first time. The place, the child and the token are untouched, so nothing
already booked is disturbed.

No edge function changed. Note for later: `send-booking-invitations` reuses an
existing invitation by `roster_id`/`child_id` and does **not** update
`parent_email` on reuse, so re-inviting a player at a new address through the
picker would still email the new address while leaving the row pointing at the
old one — which then fails at checkout. Changing the address here is the
supported route until that reuse branch is taught to update it.

**Follow-up, same day:** Ollie couldn't find Change email. He was in the right
place — the buttons were in the last table column, which on his laptop sat
beyond the right edge behind a horizontal scrollbar he had no reason to
notice. Adding a second button to that column is what pushed it off. Two
fixes: the row actions are compact icon buttons again (the column no longer
widens the table past the window), and **tapping an invitation row** — his
first instinct, which previously did nothing — opens a sheet naming the
player, where the invitation goes, its status and delivery, with both actions
as full-width buttons. Checked at 1280×720: the table fits its container and
the actions sit on screen.

## Calendar subscriptions (17 Sep 2026)

Gillian, a parent, asked: *"Is there a chance the sessions can be added to a
calendar subscription rather than to a specific Google / Outlook calendar?"*
The ticket page's per-session "Google / Outlook" links copy one date into a
diary and then know nothing more — a session that later moves stays wrong
forever, and an eleven-date programme means eleven taps.

**`supabase/functions/calendar-feed/index.ts`** (deployed v1) serves one
iCalendar feed per booking. It is deliberately self-contained (only
`npm:@supabase/supabase-js@2`, no `_shared` imports) so it can be redeployed
through the MCP without flattening anything.

- **URL**: `/functions/v1/calendar-feed?t=<qr_token>` — the same token that
  authorises the ticket page. Calendar clients send no headers of their own,
  so the token travels in the query string and `verify_jwt = false` is set for
  this function in `supabase/config.toml`.
- **One VEVENT per `event_sessions` row**, falling back to the event's single
  `event_date` when a programme has no dated sessions.
- **`UID: session-<sessionId>-<bookingId>@suffolktennis.online`** with
  `SEQUENCE` from `moved_at ?? created_at`, so a moved session updates in
  place instead of arriving as a duplicate.
- **Cancelled** sessions (or a cancelled event) are emitted as
  `STATUS:CANCELLED` + `TRANSP:TRANSPARENT` with a `CANCELLED — ` summary,
  rather than disappearing silently from the diary.
- **`LOCATION`** is the session's own venue, so a season split between clubs
  reads correctly date by date.
- `REFRESH-INTERVAL;VALUE=DURATION:PT12H` and `X-PUBLISHED-TTL:PT12H` (Apple
  reads the X- spelling), `Cache-Control: public, max-age=900`.
- Content lines are folded at 75 **octets**, not characters — folding by
  character would split a multi-byte character (the em dash in every title)
  across the break.

**Time zones.** Sessions are stored as a bare London date plus a local time;
the feed asks `Intl.DateTimeFormat` what Europe/London was doing at that
instant rather than assuming. Verified against Ben Sergent's real 9U season
ticket: 27 Sep 2026 13:30 BST → `20260927T123000Z`, 22 Nov 2026 13:30 GMT →
`20261122T133000Z`, and 28 Mar 2027 13:00 BST → `20270328T120000Z` — so the
clock changes either side of the season are both right.

**Where a parent finds it.** `src/components/parent/CalendarSubscribe.tsx`,
shown on `TicketPage` and in the parent's booking detail dialog, but only for
a paid, uncancelled, whole-programme ticket with upcoming dates — a
single-session code admits them to one date, so a subscription would mislead.
"Add to my calendar" is a `webcal://` link (iPhone, Mac, Outlook hand it
straight to the calendar app); "Copy link" gives the `https://` form, which is
what Google Calendar on a computer wants pasted into Other calendars → From
URL. `SUPABASE_URL` is now exported from
`src/integrations/supabase/client.ts` so the component can build the URL.

The feed link is worth the same care as the ticket link: anyone holding it can
read that booking's dates, player name and venues.

## Making a place free after the invitation has gone (19 Sep 2026)

Ollie: *"any way you can help me send invites to 18U girls who I've already
sent to but now remove their charges?.. or if I can recall and send again
FOC.. Need to do this morning if so.."*

**Nothing has to be recalled.** `create-booking-checkout` and the booking page
both read `booking_invitations.complimentary` at the moment the parent acts,
not when the email was written, so flipping that flag re-prices the link
already sitting in their inbox. What was missing was any way to flip it after
the invitation had been sent: the invite picker's free-place tick box only
applies to a new send, and `alreadyOn` deliberately hides anyone already
invited. `is_free` was no help either — the event form only offers it for
events, not programmes (`src/components/admin/BookingsPanel.tsx`,
`is_free: !isProgrammeForm && form.is_free`).

**The action.** Tapping an invitation row now offers *Make this place free of
charge* (and *Charge for this place again*). It writes `complimentary` plus a
reason and then resends the invitation, because the email they were sent
quoted a price.

**Why the reason matters.** Every complimentary place used to be described
with one sentence — "because your child is already on one of our programmes"
— which was true of the only case that existed: a child already paying for a
programme gets any other programme free. An admin grant is a different thing,
and that sentence would have been a plain untruth to ten 18U Girls families.
`supabase/functions/_shared/complimentary.ts` (mirrored at
`src/lib/complimentary.ts`) now turns `complimentary_reason` into the words:

| reason | price shown | sentence |
| --- | --- | --- |
| `already on a paid programme` | No extra charge | "…already on one of our programmes…" |
| `granted by admin`, or null | No charge | "Suffolk Tennis is covering the cost" |

Used by the booking page, the invitation email (`invitationEmail.ts`) and the
confirmation email (`fulfilment.ts`, which looks the reason up through
`bookings.invitation_id`).

## Refunding without taking the place away (19 Sep 2026)

A refund used to mean one thing: `bookings.status = 'refunded'` and a voided
ticket — right when a family withdraws, wrong when Suffolk Tennis stops
charging for a programme people have already paid for. Five 18U Girls
families had paid £875 between them by the time Ollie asked.

`refund-booking` now takes `keep_place`. With it, the money goes back, the
booking **stays `paid`** and becomes complimentary with `amount_pence = 0`,
its invitation is marked complimentary too, and the entry ticket, register
row and calendar feed are untouched. Without it, the old behaviour stands.
Either way a monthly plan is cancelled when `cancel_membership` is passed.

Because the status no longer carries the refund, `bookings` gained
`refunded_at`, `refunded_amount_pence` and `stripe_refund_id`
(`20260919090000_refund_keeping_the_place.sql`), and every refund writes them.
The ledger reads `refunded_at`, so a kept place shows "£275 refunded · place
kept, free of charge" and still counts toward the refunded total rather than
quietly filing itself under "no charge".

The refund dialog makes the choice explicit — *Keep their place, free of
charge* or *Give the place up* — defaulting to giving it up, since silently
dropping a child who only wanted their money back is the worse mistake.

**Monthly plans could not be refunded at all before this.** A subscription
booking has no `stripe_payment_intent_id` — each month is a Stripe invoice —
so the old guard rejected it with "No Stripe payment is recorded against this
booking". Both 18U Girls monthly bookings (Holly Fisher, Alev Warwick) were in
exactly that state. `refund-booking` now reads `memberships.paid_invoice_ids`,
resolves each invoice to its payment intent (which is why `stripe.ts` pins the
pre-Basil `2025-02-24.acacia` API — `invoice.payment_intent` was removed in
Basil) and refunds every month that was taken.

That also fixes a latent under-refund: `bookings.amount_pence` on a monthly
plan is ONE month, so a plan three months in would previously have handed back
a third of the money and called it a full refund. The invoices are now the
source of truth, and the response carries `amount_taken_pence` alongside
`amount_refunded_pence`. A part-refund against a multi-month plan is refused
rather than guessed at, and a refund that fails half way through reports how
far it got instead of claiming nothing happened.

**Deployed:** `refund-booking` v8, `send-booking-invitations` v28. Both
boot-checked (403 "Admin access required" through pg_net, which also proves no
email can escape the admin gate).

## Two coaches, two phones, one register (19 Sep 2026)

Ollie: *"can we get the reports to be live so when someone does one it updates
on someone else's?.. two coaches working off their own phones syncing… when
the session ends will it sync then and all reports send?"*

**What already worked.** The register re-reads every 5 seconds while the tab is
visible (`RegisterPage.tsx`, `POLL_MS`), so attendance marks already crossed
between phones. End session already sends **every** complete, unsent report for
the session whoever wrote it — `sendDueForSession` in
`_shared/reportEmails.ts` filters on `complete` and `sent_at is null`, never on
coach — and `session-reports-dispatch` (pg_cron, every 10 minutes, verified
active) sweeps up anything finished later, two hours after the session ended.
Sending is claim-before-send, so the two can never double-send a report.

**What did not.** A report is unique per `(booking, session, coach)`, and the
register only ever fetched `.eq("coach_id", staffId)`. So the red/green dot
meant "*have I* done this one", and a coach could not see that their colleague
had already written a player up — precisely the blind spot Ollie hit. The
"x/y reports" badge counted the same way.

**The change** (option (a) of two put to Ollie — he chose keeping both coaching
voices over merging them into one report):

- `coach-session`'s `register` action now reads every coach's reports for the
  booking in one query and splits them into `report` (the caller's, unchanged)
  and **`other_reports`**, replacing the separate `pending_reports` query.
- The dot is green once **anyone** has finished the player. Someone else's
  work reads as a green ring rather than a solid dot, so a coach can still see
  at a glance which ones are theirs, and the row names them: "Written up by
  Chris Daynes".
- The squad badge counts both coaches.
- Opening a player the other coach has already done shows a warning in the
  profile and again at the top of the report sheet — *"Chris Daynes has
  already written Cara up for this session. Reports are one per coach, so if
  you write one too the parent gets both."* It does not block: two coaches
  giving two views of a player is the point of a two-coach session.

The 5-second poll already in place carries all of this between phones; nothing
new was needed for the "live" part.

**Deployed:** `coach-session` v15, boot-checked, and every deployed file verified byte-identical to the repo. Six Playwright checks cover the
dot, the row, the badge, both warnings, and that an unfinished report by the
other coach does not count as done.

## DMARC aggregate reports flooding the enquiries inbox (20 Sep 2026)

Ollie: *"How do I stop all these reports coming in?.."* — a screenshot of
`noreply@dmarc.yahoo.com` and friends arriving several times an hour.

**Nothing in the platform sends these.** They are DMARC aggregate reports, and
they arrive because of one DNS record. Current state, read live via DoH
(the sandbox proxy blocks DNS hosts, so the queries go out through pg_net):

| record | value |
| --- | --- |
| `_dmarc.suffolktennis.online` TXT | `v=DMARC1; p=none; rua=mailto:enquiries@suffolktennis.online; adkim=r; aspf=r` |
| `suffolktennis.online` TXT | `v=spf1 include:_spf-eu.ionos.com ~all` |
| `send.suffolktennis.online` TXT | `v=spf1 include:amazonses.com ~all` (Resend's return path) |
| `resend._domainkey.suffolktennis.online` TXT | DKIM public key, present |

`rua=` is the reporting address: every mailbox provider that receives mail
claiming to be from the domain posts it a daily XML report. It points at
`enquiries@`, which is Ollie's inbox.

**The mail itself is fine.** Resend signs as `d=suffolktennis.online` (DKIM
aligned) and its return path has its own SPF, so with `aspf=r`/`adkim=r` the
platform's mail passes DMARC on both counts. The reports are confirming that,
not warning about it.

**To stop them, edit the `_dmarc` TXT record at IONOS:**

- Silence: `v=DMARC1; p=none; adkim=r; aspf=r` — drop `rua` entirely.
- Keep them, elsewhere: `rua=mailto:dmarc@suffolktennis.online`. **Must be an
  address on the same domain** — RFC 7489 §7.1 requires the receiving domain
  to publish an authorisation record for an external one, so pointing `rua` at
  a gmail.com address would simply be ignored by most reporters.
- Digest: a free DMARC service (Postmark, dmarcian, URIports) issues an
  address it has already authorised and sends one readable weekly summary.

`p=none` means DMARC is currently monitoring only and enforcing nothing. Since
alignment is already good, the domain could move to `p=quarantine` and stop
anyone spoofing suffolktennis.online at parents — that is the reason to keep
some form of reporting rather than deleting it outright.

## "I have done 4 but it says only 2 parents will get reports" (20 Sep 2026)

Ollie, ending the 14U Boys (B) session of 19 Sep a day late: the register said
**4/6 reports**, End session said **2 complete reports will be sent**. He asked
whether it was an error or something he had done wrong.

**Neither. All four parents got their report.** What the dialog counted was
reports still *waiting to be sent*, and by then two had already gone on their
own. The session's scheduled end was 13:00 on 19 Sep, so every report he wrote
the next afternoon was more than two hours past it and
`session-reports-dispatch` (every 10 minutes) picked each one up almost as soon
as he finished it:

| London time, 20 Sep | what happened |
| --- | --- |
| 17:30 | Archie Hatch's report sent automatically |
| 17:40 | George Armstrong's sent automatically |
| **17:47** | **Ollie's screenshot: 4/6 written, 2 still to send** |
| 17:50 | Hugo Hetherington's and Leon Prus's sent automatically |
| 17:51 | Ollie pressed End session — nothing left to do |

Verified after the fact: 4 complete reports on that session, 0 still unsent.

**The wording was the bug.** "2 complete reports will be sent to parents" is
true but reads as "two of your four didn't count". `EndSessionDialog` now keeps
the two numbers apart — what it has written versus what is left to send:

- none sent yet → unchanged: "4 complete reports will be sent to parents."
- some sent → "2 reports go to parents now; 2 have already gone."
- all sent → "Nothing left to send — 4 reports have already gone to parents,"
  with a line explaining that reports finished after a session go on their own.

Front-end only: `pending_reports` was already counted across both coaches, and
`other_reports` arrived with the 19 Sep register change, so the dialog can work
out both figures without another `coach-session` deploy.
