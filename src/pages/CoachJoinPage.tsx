/**
 * Coach invitation landing page — the "Accept invitation" button in the
 * coach's email lands here. Deliberately the same shape as BookingPage's
 * account gates (sign in / wrong account / switch account) so a coach who is
 * also a parent meets one system, not two.
 *
 * The token is the credential for reading the invitation; the signed-in
 * user's email is the credential for accepting it. The server enforces the
 * email match — the client-side comparison only decides which panel to show.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, LogIn, UserPlus, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { EmptyState, FlowShell, SkeletonBlock, Surface } from "@/components/app";

type Invitation = {
  email: string;
  name: string | null;
  status: "invited" | "accepted";
  invited_by_name: string | null;
};

// Results carry their token so a link change cannot be accepted against the
// previous invitation's email while the new one is still loading.
type Peek =
  | { state: "loading" }
  | { state: "invalid"; token: string; reason: string | null }
  | { state: "ready"; token: string; invitation: Invitation };

type Accept =
  | { state: "idle" }
  | { state: "accepting" }
  | { state: "accepted" }
  | { state: "already" }
  | { state: "wrong_account" }
  | { state: "failed"; message: string };

/** The peek returns machine reasons; the coach reads a sentence. */
const invalidDescription = (reason: string | null) => {
  if (reason === "revoked") return "This invitation has been withdrawn. If you were expecting it, ask Suffolk Tennis to send a new one.";
  return "The link may be incomplete, or the invitation may no longer exist. Ask Suffolk Tennis to send a new one.";
};

const Notice = ({ icon: Icon, iconClassName, title, children, tone = "neutral" }: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  children?: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) => {
  const ring = { neutral: "bg-muted text-muted-foreground", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-red-50 text-red-700" }[tone];
  return (
    <Surface className="p-5 text-center md:p-6">
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${ring}`}><Icon className={`h-6 w-6 ${iconClassName ?? ""}`} strokeWidth={1.8} /></div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children && <div className="mt-2 space-y-3 text-sm text-muted-foreground">{children}</div>}
    </Surface>
  );
};

const CoachJoinPage = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const [peek, setPeek] = useState<Peek>({ state: "loading" });
  const [accept, setAccept] = useState<Accept>({ state: "idle" });
  // Accept is a write with side effects (the role is granted), so it runs
  // once per token however many times auth or the invitation re-render us.
  const acceptedFor = useRef<string | null>(null);
  // Bumped by "Try again" — the effect's other inputs are unchanged after a failure.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    // The route reuses this component for every token: a second link must
    // clear the first, or a stale "accepted" panel names the wrong email.
    let cancelled = false;
    setPeek({ state: "loading" });
    setAccept({ state: "idle" });
    supabase.functions
      .invoke("coach-invitation", { body: { action: "peek", token } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.ok) setPeek({ state: "invalid", token, reason: data?.error ?? null });
        else setPeek({ state: "ready", token, invitation: data as Invitation });
      })
      .catch(() => { if (!cancelled) setPeek({ state: "invalid", token, reason: null }); });
    return () => { cancelled = true; };
  }, [token]);

  const result = peek.state !== "loading" && peek.token === token ? peek : null;
  const invitation = result?.state === "ready" ? result.invitation : null;
  const invitedEmail = invitation?.email.toLowerCase() ?? null;
  const userEmail = user?.email?.toLowerCase() ?? null;
  const emailMatches = !!invitedEmail && invitedEmail === userEmail;

  useEffect(() => {
    // Auth resolves after first paint; until it does we cannot tell a
    // signed-out coach from one whose session is still being read, and an
    // accept without a JWT would only be refused.
    if (!token || authLoading || !user || !emailMatches) return;
    if (acceptedFor.current === token) return;
    acceptedFor.current = token;
    let cancelled = false;
    setAccept({ state: "accepting" });
    supabase.functions
      .invoke("coach-invitation", { body: { action: "accept", token } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setAccept({ state: "failed", message: "We couldn't reach Suffolk Tennis. Please try again." });
        else if (data.ok) setAccept({ state: data.already ? "already" : "accepted" });
        // The server's email check is the one that counts: honour its verdict
        // even when the session we compared against said otherwise.
        else if (data.error === "wrong_account") setAccept({ state: "wrong_account" });
        else setAccept({ state: "failed", message: "This invitation could not be accepted. Ask Suffolk Tennis to send a new one." });
      })
      .catch(() => { if (!cancelled) setAccept({ state: "failed", message: "We couldn't reach Suffolk Tennis. Please try again." }); });
    return () => { cancelled = true; };
    // user?.id rather than user: a token refresh swaps the user object hourly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authLoading, user?.id, emailMatches, attempt]);

  // Sign-in and sign-up both come back here, with the invited address already
  // in the email field so the account is created under the right one.
  const authUrl = `/auth?redirect=${encodeURIComponent(`/coach/join/${token ?? ""}`)}&email=${encodeURIComponent(invitation?.email ?? "")}`;

  const switchAccount = async () => {
    await signOut();
    window.location.assign(authUrl);
  };

  const retryAccept = () => {
    acceptedFor.current = null;
    setAccept({ state: "idle" });
    setAttempt((n) => n + 1);
  };

  const inviter = invitation?.invited_by_name?.trim() || "Suffolk Tennis";
  const firstName = invitation?.name?.trim().split(/\s+/)[0] ?? null;
  const wrongAccount = accept.state === "wrong_account" || (!!user && !!invitation && !emailMatches);
  const done = accept.state === "accepted" || accept.state === "already";

  return (
    <FlowShell back={{ label: "Suffolk Tennis", to: "/" }} maxWidth="max-w-lg">
      {!result ? (
        <div className="space-y-4" aria-busy>
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-48" />
        </div>
      ) : result.state === "invalid" ? (
        <EmptyState
          icon={AlertCircle}
          title="This invitation isn't valid"
          description={invalidDescription(result.reason)}
          action={<Button asChild variant="outline"><Link to="/">Back to Suffolk Tennis</Link></Button>}
        />
      ) : !invitation ? null : (
        <div className="space-y-5">
          {/* ---- The invitation itself ---- */}
          <Surface className="p-5 md:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Suffolk Tennis · Coach invitation</p>
            <h1 className="mt-1 font-display text-2xl font-semibold leading-tight md:text-3xl">
              {firstName ? `${firstName}, you're invited to coach` : "You're invited to coach"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              <strong className="text-foreground">{inviter}</strong> has invited you to coach with Suffolk Tennis. A coach account gives you
              session registers, QR check-in and session reports for every player on your programmes.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sent to <strong className="break-all text-foreground">{invitation.email}</strong>
            </p>
          </Surface>

          {/* ---- What happens next ---- */}
          {done ? (
            <Notice icon={CheckCircle2} title="You're a Suffolk Tennis coach" tone="success">
              <p>Ollie will assign you to your programmes; they appear in your Coach Hub.</p>
              <Button asChild size="lg">
                <Link to="/coach">Open the Coach Hub</Link>
              </Button>
            </Notice>
          ) : authLoading ? (
            <SkeletonBlock className="h-40" />
          ) : !user ? (
            /* Gate 1: an account is required — coaching is added to it. */
            <Notice icon={UserPlus} title="Sign in to accept this invitation">
              <p>
                Coaching runs through your Suffolk Tennis account, so your registers, check-in and session reports all live in one
                place. Sign up with the address above — or, if you already have a Suffolk Tennis parent account, sign in with it and
                coaching is added to it.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild size="lg">
                  <Link to={`${authUrl}&mode=signup`}><UserPlus className="w-4 h-4" /> Create free account</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to={authUrl}><LogIn className="w-4 h-4" /> Sign in</Link>
                </Button>
              </div>
              <p className="text-xs">You'll come straight back here to finish.</p>
            </Notice>
          ) : wrongAccount ? (
            /* Personal invitation: only the invited account can accept it. */
            <Notice icon={AlertCircle} title="This invitation isn't for this account" tone="warning">
              <p>
                It was sent to <strong className="text-foreground">{invitation.email}</strong>, but you're signed in as{" "}
                <strong className="text-foreground">{user.email}</strong>. Please switch to the invited account to accept.
              </p>
              <Button size="lg" onClick={switchAccount}>
                <LogIn className="w-4 h-4" /> Switch account
              </Button>
            </Notice>
          ) : accept.state === "failed" ? (
            <Notice icon={AlertCircle} title="Something went wrong" tone="danger">
              <p>{accept.message}</p>
              <Button size="lg" variant="outline" onClick={retryAccept}>Try again</Button>
            </Notice>
          ) : (
            <Notice icon={Loader2} iconClassName="animate-spin" title="Setting up your coach account">
              <p aria-live="polite">One moment — adding coaching to {user.email}.</p>
            </Notice>
          )}
        </div>
      )}
    </FlowShell>
  );
};

export default CoachJoinPage;
