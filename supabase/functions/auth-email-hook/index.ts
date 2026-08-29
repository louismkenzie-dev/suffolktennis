// Supabase Auth "Send Email" hook: GoTrue calls this instead of sending its
// own emails, and we deliver branded messages via Resend. Signups and magic
// links get BOTH a one-tap button and a typed code; password recovery and
// invites get an action link only.
//
// The button matters: a parent was locked out for days because her browser
// was serving a cached build whose code box still capped at six characters,
// so an eight-digit code could not be typed at all. A link cannot be
// mistyped, truncated, or affected by a stale bundle, so it is now the
// primary route and the code is the fallback.
//
// Setup (dashboard): Authentication → Hooks → Send Email → this function,
// and paste the generated secret into Edge Function secrets as
// SEND_EMAIL_HOOK_SECRET.
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { sendEmail } from "../_shared/resend.ts";
import { brandedEmail, emailButton, emailCode, emailNote, emailParagraph } from "../_shared/emailLayout.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";

const codeEmail = (title: string, intro: string, code: string, unsubscribeUrl?: string) =>
  brandedEmail({
    unsubscribeUrl,
    title,
    preheader: `Your verification code is ${code}`,
    body: emailParagraph(intro) + emailCode(code) +
      emailNote("The code expires shortly. If you didn\u2019t request it, you can safely ignore this email."),
  });

/** Both routes in one email: tap the button, or type the code. */
const codeAndLinkEmail = (
  title: string, intro: string, code: string, url: string, cta: string, unsubscribeUrl?: string,
) =>
  brandedEmail({
    unsubscribeUrl,
    title,
    preheader: `Your verification code is ${code}`,
    body: emailParagraph(intro) + emailButton(url, cta) +
      emailParagraph("Or enter this code on the website:") + emailCode(code) +
      emailNote("The code and the button both expire shortly. If you didn\u2019t request this, you can safely ignore this email."),
  });

const linkEmail = (title: string, intro: string, url: string, cta: string, unsubscribeUrl?: string) =>
  brandedEmail({
    unsubscribeUrl,
    title,
    preheader: intro,
    body: emailParagraph(intro) + emailButton(url, cta) +
      emailNote("If you didn\u2019t request this, you can safely ignore this email."),
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!hookSecret || !resendKey) {
    console.error("auth-email-hook missing SEND_EMAIL_HOOK_SECRET or RESEND_API_KEY");
    return new Response(JSON.stringify({ error: "Hook not configured" }), { status: 500 });
  }

  let payload: HookPayload;
  try {
    const raw = await req.text();
    const headers = Object.fromEntries(req.headers.entries());
    const wh = new Webhook(hookSecret.replace(/^v1,whsec_/, "").replace(/^whsec_/, ""));
    payload = wh.verify(raw, headers) as HookPayload;
  } catch (e) {
    console.error("auth-email-hook signature verification failed:", e);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const { user, email_data } = payload;
  const action = email_data.email_action_type;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://suffolktennis.online";

  /**
   * GoTrue's one-click verify endpoint. redirect_to is empty unless the client
   * passed emailRedirectTo, so fall back to the site root rather than sending
   * someone to a blank page.
   */
  const verifyLink = (type: string, hash = email_data.token_hash) =>
    `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=${type}` +
    `&redirect_to=${encodeURIComponent(email_data.redirect_to || siteUrl)}`;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const unsubToken = await unsubscribeTokenFor(admin, user.email, "auth");
  const unsubUrl = unsubscribeUrlFor(unsubToken);

  let subject: string;
  let html: string;

  switch (action) {
    case "signup":
      subject = "Confirm your Suffolk Tennis account";
      html = codeAndLinkEmail(
        "Confirm your email",
        "Welcome to Suffolk Tennis! Tap the button to confirm your email address — then sign in with the password you chose.",
        email_data.token,
        verifyLink("signup"),
        "Confirm my email",
        unsubUrl,
      );
      break;
    case "magic_link":
    case "magiclink":
      subject = "Sign in to Suffolk Tennis";
      html = codeAndLinkEmail(
        "Sign in to Suffolk Tennis",
        "Tap the button to sign in.",
        email_data.token,
        verifyLink("magiclink"),
        "Sign me in",
        unsubUrl,
      );
      break;
    case "email_change":
      subject = "Confirm your new email address";
      html = codeEmail(
        "Confirm your new email",
        "Enter this code to confirm the change to your Suffolk Tennis account email:",
        email_data.token_new ?? email_data.token,
        unsubUrl,
      );
      break;
    case "reauthentication":
      subject = "Your Suffolk Tennis verification code";
      html = codeEmail("Verify it's you", "Enter this code to continue:", email_data.token, unsubUrl);
      break;
    case "recovery": {
      const verifyUrl = verifyLink("recovery");
      subject = "Reset your Suffolk Tennis password";
      html = linkEmail(
        "Reset your password",
        "Click the button below to choose a new password for your Suffolk Tennis account.",
        verifyUrl,
        "Reset password",
        unsubUrl,
      );
      break;
    }
    case "invite": {
      const verifyUrl = verifyLink("invite");
      subject = "You've been invited to Suffolk Tennis";
      html = linkEmail(
        "You're invited",
        "You've been invited to join Suffolk Tennis. Click below to set up your account.",
        verifyUrl,
        "Accept invitation",
        unsubUrl,
      );
      break;
    }
    default:
      subject = "Your Suffolk Tennis verification code";
      html = codeEmail("Verification code", "Enter this code to continue:", email_data.token, unsubUrl);
  }

  try {
    await sendEmail(
      { to: user.email, subject, html, unsubscribe_token: unsubToken ?? undefined },
      { apiKey: resendKey, unsubscribeBaseUrl: unsubscribeBaseUrl() },
    );
  } catch (e) {
    console.error("auth email send failed:", e);
    return new Response(JSON.stringify({ error: "Email send failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });
});

interface HookPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    token_new?: string;
    redirect_to: string;
    email_action_type: string;
  };
}
