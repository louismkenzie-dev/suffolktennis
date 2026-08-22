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

const NAVY = "#0e1d39";
const CYAN = "#00a8e0";

type HookPayload = {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

function codeEmail(title: string, intro: string, code: string): string {
  return `
  <div style="font-family: 'Hanken Grotesk', system-ui, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
    <div style="background:${NAVY}; border-radius: 16px 16px 0 0; padding: 28px 32px; text-align:center;">
      <div style="color:#ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">Suffolk Tennis</div>
      <div style="color:${CYAN}; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 4px;">Partnership</div>
    </div>
    <div style="border:1px solid #e2e8f0; border-top:none; border-radius: 0 0 16px 16px; padding: 32px;">
      <h1 style="font-size: 20px; margin: 0 0 8px; color:${NAVY};">${title}</h1>
      <p style="color:#475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">${intro}</p>
      <div style="background:#f1f5f9; border-radius: 12px; padding: 20px; text-align:center; margin-bottom: 20px;">
        <div style="font-size: 34px; font-weight: 700; letter-spacing: 0.3em; color:${NAVY};">${code}</div>
      </div>
      <p style="color:#94a3b8; font-size: 12px; line-height: 1.6; margin: 0;">
        The code expires shortly. If you didn't request it, you can safely ignore this email.
      </p>
    </div>
  </div>`;
}

function linkEmail(title: string, intro: string, url: string, cta: string): string {
  return `
  <div style="font-family: 'Hanken Grotesk', system-ui, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
    <div style="background:${NAVY}; border-radius: 16px 16px 0 0; padding: 28px 32px; text-align:center;">
      <div style="color:#ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">Suffolk Tennis</div>
      <div style="color:${CYAN}; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 4px;">Partnership</div>
    </div>
    <div style="border:1px solid #e2e8f0; border-top:none; border-radius: 0 0 16px 16px; padding: 32px;">
      <h1 style="font-size: 20px; margin: 0 0 8px; color:${NAVY};">${title}</h1>
      <p style="color:#475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">${intro}</p>
      <a href="${url}" style="display:inline-block; background:${CYAN}; color:${NAVY}; font-weight: 700; padding: 13px 26px; border-radius: 10px; text-decoration: none;">${cta}</a>
      <p style="color:#94a3b8; font-size: 12px; line-height: 1.6; margin: 20px 0 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>`;
}

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
