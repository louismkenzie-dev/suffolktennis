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
`content.ts`. Nominations go to enquiries@suffolktennis.online (the
"Nominate a player" button opens a pre-filled email).

There is no sender yet: the recipient list is clubs, coaches and schools
rather than platform accounts, so it is sent by hand from the rendered HTML
or via a one-off send once the list is agreed.
