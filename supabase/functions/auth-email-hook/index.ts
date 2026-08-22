// Supabase Auth "Send Email" hook: GoTrue calls this instead of sending its
// own emails, and we deliver branded messages via Resend. Signups (and magic
// links / email changes) get a 6-digit verification CODE the user types into
// the site; password recovery gets an action link back to /reset-password.
//
// Setup (dashboard): Authentication → Hooks → Send Email → this function,
// and paste the generated secret into Edge Function secrets as
// SEND_EMAIL_HOOK_SECRET.
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { sendEmail } from "../_shared/resend.ts";
import { brandedEmail, emailButton, emailCode, emailNote, emailParagraph } from "../_shared/emailLayout.ts";

const codeEmail = (title: string, intro: string, code: string) =>
  brandedEmail({
    title,
    preheader: `Your verification code is ${code}`,
    body: emailParagraph(intro) + emailCode(code) +
      emailNote("The code expires shortly. If you didn\u2019t request it, you can safely ignore this email."),
  });

const linkEmail = (title: string, intro: string, url: string, cta: string) =>
  brandedEmail({
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

  let subject: string;
  let html: string;

  switch (action) {
    case "signup":
      subject = "Your Suffolk Tennis verification code";
      html = codeEmail(
        "Confirm your email",
        "Welcome to Suffolk Tennis! Enter this code on the sign-up page to verify your email address:",
        email_data.token,
      );
      break;
    case "magic_link":
    case "magiclink":
      subject = "Your Suffolk Tennis sign-in code";
      html = codeEmail("Sign in to Suffolk Tennis", "Enter this code to sign in:", email_data.token);
      break;
    case "email_change":
      subject = "Confirm your new email address";
      html = codeEmail(
        "Confirm your new email",
        "Enter this code to confirm the change to your Suffolk Tennis account email:",
        email_data.token_new ?? email_data.token,
      );
      break;
    case "reauthentication":
      subject = "Your Suffolk Tennis verification code";
      html = codeEmail("Verify it's you", "Enter this code to continue:", email_data.token);
      break;
    case "recovery": {
      const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(email_data.token_hash)}&type=recovery&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;
      subject = "Reset your Suffolk Tennis password";
      html = linkEmail(
        "Reset your password",
        "Click the button below to choose a new password for your Suffolk Tennis account.",
        verifyUrl,
        "Reset password",
      );
      break;
    }
    case "invite": {
      const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(email_data.token_hash)}&type=invite&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;
      subject = "You've been invited to Suffolk Tennis";
      html = linkEmail(
        "You're invited",
        "You've been invited to join Suffolk Tennis. Click below to set up your account.",
        verifyUrl,
        "Accept invitation",
      );
      break;
    }
    default:
      subject = "Your Suffolk Tennis verification code";
      html = codeEmail("Verification code", "Enter this code to continue:", email_data.token);
  }

  try {
    await sendEmail({ to: user.email, subject, html }, { apiKey: resendKey });
  } catch (e) {
    console.error("auth email send failed:", e);
    return new Response(JSON.stringify({ error: "Email send failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });
});
