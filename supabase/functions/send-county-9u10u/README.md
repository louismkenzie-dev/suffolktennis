# 9U & 10U programme update

`content.ts` builds the email; `npm run email:9u10u` (see below) renders it to
`public/email/county-9u10u.html`, which Vercel then serves.

Sending is done by the generic `send-branded-html` function, which fetches that
published URL, substitutes each recipient's unsubscribe link for the
`{{UNSUB_URL}}` placeholder, and sends via Resend. Keeping the markup on the
site rather than inside the function means the email can be reviewed in a
browser, and the sender stays small enough to read in one go.

Render locally:

    npx esbuild supabase/functions/send-county-9u10u/content.ts \
      --bundle --format=esm --platform=node --outfile=/tmp/bundle.mjs
    node -e 'globalThis.Deno={env:{get:k=>k==="SITE_URL"?"https://suffolktennis.online":undefined}};
      import("/tmp/bundle.mjs").then(async m=>{const{html}=m.build("{{UNSUB_URL}}");
      await (await import("node:fs/promises")).writeFile("public/email/county-9u10u.html",html)})'
