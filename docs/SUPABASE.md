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
platform application fee (default 1%, override with `PLATFORM_FEE_PERCENT`).
The sandbox/live switch is server-side in `app_settings.payments_mode`
(currently `sandbox`; flip with
`update app_settings set value='live' where key='payments_mode';`).

Schema: `20260820120000_booking_system.sql` — event visibility
(public/private) + pricing, `event_sessions`, tokenized
`booking_invitations`, `bookings`, `memberships` (monthly programmes as
Stripe subscriptions committed to `programme_months` payments), `tickets`
(QR) and `ticket_scans`.

Edge functions (all deployed): `get-invitation`, `create-booking-checkout`,
`booking-payments-webhook`, `get-booking-status`, `send-booking-invitations`
(admin), `scan-ticket` (admin).

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
| `STRIPE_LIVE_CONNECTED_ACCOUNT_ID` | `acct_...` of the client's live connected account (Karen's) |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | signing secret of the sandbox webhook endpoint |
| `PAYMENTS_LIVE_WEBHOOK_SECRET` | signing secret of the live webhook endpoint |
| `RESEND_API_KEY` | Resend key (invitation + confirmation emails) |
| `SITE_URL` | `https://suffolktennis.vercel.app` (later suffolktennis.online) |

Stripe webhook endpoints (platform account, `connect=true` so direct-charge
events from the connected account are delivered; **pin `api_version` to
`2025-02-24.acacia`** — the handler reads `invoice.subscription`, which newer
API versions removed):

- URL: `https://twtmkvorzpvwnznqzcrw.supabase.co/functions/v1/booking-payments-webhook?env=sandbox` (and `?env=live`)
- Events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`

**Sandbox endpoint created 21 Aug 2026**: `we_1U6qmgE0aLvInrlqpuWFwsap`
(acacia-pinned, connect). Its `whsec_…` signing secret was handed to Louis to
paste as `PAYMENTS_SANDBOX_WEBHOOK_SECRET`. Sandbox connected account:
`acct_1TnJ2NE0aLUyRazc` ("Test account", fully onboarded, charges enabled —
replaced `acct_1U6qXsE0aLYAntjY`, which never completed onboarding). The
live endpoint still needs creating when live keys arrive. A temporary `stripe-bootstrap` edge function (guard-token
protected form-encoding relay for pg_net → Stripe API calls) is deployed for
sandbox setup — **delete it once testing is done**.

Verified without keys: `get-invitation` serves private events by token
(HTTP 200 end-to-end), and `create-booking-checkout` fails cleanly when
Stripe is unconfigured (booking rolled back to cancelled — no capacity
leak). With keys set, the same call returns the hosted checkout URL.

### Player roster (added 21 Aug 2026)

`player_roster` (migration `20260821110000`) holds the county's player
database — 716 players imported from the LTA RCP report (checksum-verified),
admin-only RLS. The admin Bookings tab's invite picker draws from the roster
merged with registered families, filterable by age group (8U–Open) and
gender, and a CSV re-import button accepts future RCP exports (upsert on LTA
number). `booking_invitations.roster_id` anchors re-invite dedupe for roster
players. Parents see their invitations, bookings and tickets in the Parent
Hub's "Bookings & Invitations" tab.
