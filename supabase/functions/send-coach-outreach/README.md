# Connecting Suffolk's 10U Pathway — email to clubs, coaches and schools

`content.ts` builds the email. Render it to `public/email/coach-outreach.html`
(which Vercel then serves, so it can be reviewed in a browser and its images
load from suffolktennis.online/email/):

    npx esbuild supabase/functions/send-coach-outreach/content.ts \
      --bundle --format=esm --platform=node --outfile=/tmp/bundle.mjs
    node -e 'globalThis.Deno={env:{get:k=>k==="SITE_URL"?"https://suffolktennis.online":undefined}};
      import("/tmp/bundle.mjs").then(async m=>{const{html}=m.build();
      await (await import("node:fs/promises")).writeFile("public/email/coach-outreach.html",html)})'

The Talent ID dates and the nomination deadline are constants at the top of
`content.ts`. The "Nominate a player" button links to /nominate (the form
feeds People → Nominations); enquiries@suffolktennis.online is the fallback.

Sending: `index.ts` is the `send-coach-outreach` edge function.

    { "action": "test", "to": "someone@example.com" }   one copy, subject [TEST] …
    { "action": "send", "to": ["a@…", "b@…"] }           the real send (max 200 per call)

Both need an admin session; a test may instead carry `guard`, matched against
`app_settings.coach_outreach_guard` (random, generated in the DB, never
committed) so a proof can be sent from SQL via pg_net. Delete that row when
it is not in use. Every send skips unsubscribed addresses, carries a
per-recipient unsubscribe link, and is recorded in `email_deliveries` with
purpose `coach_outreach`.
