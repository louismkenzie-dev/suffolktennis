# Suffolk Tennis

Web app for Suffolk Tennis — county pathway information, venues and coaches, news
and events, plus a parent hub for managing children, schedules, goals and player
reports.

## Tech stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn-ui
- Supabase (Postgres, Auth, Storage, Edge Functions)

## Getting started

Requires Node.js and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
git clone https://github.com/louismkenzie-dev/suffolktennis
cd suffolktennis
npm install
cp .env.example .env   # Supabase values are pre-filled; add the maps keys
npm run dev
```

Other scripts:

```sh
npm run build      # production build
npm run lint       # eslint
npx vitest run     # tests
```

## Backend

The app runs on its own Supabase project (`suffolk-tennis`, Nullshift org,
eu-west-2), independent of Lovable. Schema lives in `supabase/migrations/` and
edge functions in `supabase/functions/`.

See [docs/SUPABASE.md](docs/SUPABASE.md) for project details, deployment steps
for the edge functions, and the outstanding items — including the email pipeline,
which still routes through Lovable's API.
