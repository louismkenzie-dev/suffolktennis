# Supabase Setup — Suffolk Tennis

This project runs on its own Supabase database, independent of Lovable.

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

Cost: $10/month, billed to the Nullshift org.

## Status

The project is provisioned and reachable, but **the database is still empty**.
The Suffolk Tennis schema currently lives in the Lovable-managed Supabase
project and has not been exported yet. Nothing here assumes a schema — no
speculative tables have been created, so the Lovable dump will apply cleanly.

## Local setup

```bash
cp .env.example .env          # publishable values are already filled in
npm install                   # once the app code is in the repo
npm install @supabase/supabase-js
```

Link the Supabase CLI to the remote project:

```bash
supabase link --project-ref twtmkvorzpvwnznqzcrw
```

## Keys

Two keys matter, and mixing them up is the usual way these projects leak:

- **Publishable** (`sb_publishable_...`) — safe in the browser, committed in
  `.env.example`. All access through it is filtered by Row Level Security.
- **Secret / `service_role`** — bypasses RLS entirely. Server-side only. Never
  commit it, never put it in a `VITE_`/`NEXT_PUBLIC_` variable. Read it from the
  dashboard when you need it.

## Importing the schema out of Lovable

Lovable's Supabase project is separate and this session has no access to it, so
this part is manual. From the Lovable project's dashboard, grab the connection
string (Project Settings → Database) and run:

```bash
# 1. Schema only — tables, types, functions, RLS policies, triggers
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  "postgresql://postgres:[LOVABLE_DB_PASSWORD]@db.[LOVABLE_REF].supabase.co:5432/postgres" \
  > supabase/migrations/00000000000000_initial_schema.sql

# 2. Data, if you want the existing rows carried across
pg_dump \
  --data-only \
  --no-owner \
  --schema=public \
  "postgresql://postgres:[LOVABLE_DB_PASSWORD]@db.[LOVABLE_REF].supabase.co:5432/postgres" \
  > lovable_data.sql
```

Rename the migration file to a real timestamp, then apply it:

```bash
mv supabase/migrations/00000000000000_initial_schema.sql \
   supabase/migrations/$(date +%Y%m%d%H%M%S)_initial_schema.sql
supabase db push
```

Things to check in the dump before pushing it:

- Strip any `CREATE SCHEMA`/`ALTER ... OWNER TO` lines that reference Lovable-specific roles.
- Confirm every table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` plus real policies. Lovable projects frequently ship tables with RLS off, which would make them world-readable through the publishable key.
- Auth users do **not** come across in a `public` schema dump. If members need to keep their logins, export `auth.users` separately or have them re-register.

Then regenerate the types:

```bash
supabase gen types typescript --project-id twtmkvorzpvwnznqzcrw > src/lib/database.types.ts
```

## Cutting the app over from Lovable

Lovable generates a hardcoded client at `src/integrations/supabase/client.ts`
with the URL and key inlined. To break the dependency:

1. Delete `src/integrations/supabase/client.ts`.
2. Repoint imports at `src/lib/supabase.ts`, which reads from env vars instead
   of hardcoded literals.
3. Grep for leftovers — the old project ref should appear nowhere:
   ```bash
   grep -rn "supabase.co" src/ | grep -v twtmkvorzpvwnznqzcrw
   ```
4. Update the auth redirect URLs in the new project's dashboard
   (Authentication → URL Configuration) to the real deployed domain.

## Migrations from here on

Schema changes go in `supabase/migrations/` as timestamped SQL files and are
applied with `supabase db push`. Don't edit the schema by hand in the dashboard —
it drifts from the repo and the next push will fight it.
