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

### Edge functions are not deployed

None of the 14 functions in `supabase/functions/` exist on the new project.
Deploy them with:

```bash
supabase link --project-ref twtmkvorzpvwnznqzcrw
supabase functions deploy
```

They need these secrets set (`supabase secrets set NAME=value`):

| Secret | Used by |
|---|---|
| `LOVABLE_API_KEY` | auth-email-hook, compose-news, handle-email-suppression, nearest-clubs, parse-report, preview-transactional-email, process-email-queue |
| `LOVABLE_SEND_URL` | process-email-queue (optional override) |
| `GOOGLE_MAPS_API_KEY` | postcode-lookup / nearest-clubs |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically by the platform — do not set those by hand.

### The email pipeline still runs through Lovable

This is the one place the app is not yet independent. Seven edge functions call
Lovable's API: transactional and auth email sending goes through Lovable's mail
service, and `compose-news`, `parse-report` and `nearest-clubs` use Lovable's AI
gateway. The database no longer depends on Lovable; these functions still do.

To fully cut the cord, those call sites need repointing at direct providers
(e.g. Resend for mail, a model provider key for the AI features). Until then,
keep `LOVABLE_API_KEY` valid or email will silently stop working.

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

## Migrations from here on

Schema changes go in `supabase/migrations/` as timestamped SQL files, applied
with `supabase db push`. Don't edit schema by hand in the dashboard — it drifts
from the repo and the next push will fight it.
