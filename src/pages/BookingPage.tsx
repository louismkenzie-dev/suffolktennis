import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Appearance, Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStripeFor, type PaymentsEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Loader2, Ticket, AlertCircle, ArrowLeft, Lock, ShieldCheck, UserPlus, LogIn, RefreshCcw, ChevronDown, type LucideIcon } from "lucide-react";
import { formatTimeRange } from "@/lib/timeFormat";
import { FlowShell, Field, StatusBadge, SkeletonBlock } from "@/components/app";

type InvitationPayload = {
  invitation: {
    id: string; status: string; child_name: string | null; parent_name: string | null; parent_email: string;
    /** No charge — a child already paying for a programme, or an admin-granted free place. */
    complimentary: boolean; complimentary_reason: string | null;
  };
  event: {
    id: string; title: string; description: string | null; event_date: string | null;
    location: string | null; poster_url: string | null; session_slots: string[] | null;
    programme_type: string; price_pence: number | null; is_free: boolean;
    meeting_cadence: string | null; capacity: number | null; cancelled_at?: string | null;
  };
  sessions: Array<{ id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null; cancelled_at?: string | null; moved_from_date?: string | null }>;
  existing_booking: { id: string; status: string } | null;
};

type PaymentSetup = {
  clientSecret: string;
  bookingId: string;
  environment: PaymentsEnvironment;
  mode: "payment";
  amountPence: number;
  isProgramme: boolean;
};

const gbp = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

// Stripe Payment Element theming — matches the app's light surfaces so the
// card form reads as part of the page, not an embedded third party.
const appearance: Appearance = {
  theme: "stripe",
  labels: "floating",
  variables: {
    colorPrimary: "#0a67b8",
    colorBackground: "#ffffff",
    colorText: "#15202e",
    colorTextSecondary: "#5f6b7a",
    colorTextPlaceholder: "#98a2b3",
    colorDanger: "#dc2626",
    colorIcon: "#5f6b7a",
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
    fontSizeBase: "16px",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #d5dbe3",
      boxShadow: "none",
      padding: "12px 14px",
    },
    ".Input:focus": {
      border: "1px solid #0a67b8",
      boxShadow: "0 0 0 2px rgba(10, 103, 184, 0.25)",
    },
    ".Label": { color: "#5f6b7a", fontSize: "13px" },
    ".Tab": { border: "1px solid #d5dbe3" },
    ".Tab--selected": { border: "1px solid #0a67b8", boxShadow: "0 0 0 1px #0a67b8" },
    ".Error": { fontSize: "13px" },
  },
};

const PaymentStep = ({ setup, priceLabel, onBack }: {
  setup: PaymentSetup;
  priceLabel: string;
  onBack: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnUrl = `${window.location.origin}/booking/return?booking_id=${setup.bookingId}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    // `redirect: "if_required"` lets card payments complete inline; only
    // redirect-based methods (3DS challenge pages etc.) leave the site.
    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }
    if (paymentIntent) {
      navigate(
        `/booking/return?booking_id=${setup.bookingId}` +
          `&redirect_status=${paymentIntent.status === "succeeded" ? "succeeded" : "processing"}`,
      );
    }
    // Otherwise Stripe is mid-redirect — do nothing.
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-card md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Payment</h2>
        <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">
          <ArrowLeft size={14} /> Back to details
        </button>
      </div>
      {setup.isProgramme && (
        <p className="text-sm text-muted-foreground">
          One payment of {gbp(setup.amountPence)} covers the whole programme — every session included.
        </p>
      )}
      <PaymentElement options={{ layout: { type: "tabs", defaultCollapsed: false } }} />
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={!stripe || !elements || submitting} className="w-full">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay ${priceLabel}`}
      </Button>
      <div className="flex items-center justify-center gap-4 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Secure payment</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Powered by Stripe</span>
      </div>
    </form>
  );
};

type ChildOption = { id: string; name: string };

const BookingPage = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const [data, setData] = useState<InvitationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [children, setChildren] = useState<ChildOption[] | null>(null);
  const [childId, setChildId] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [sessionSlot, setSessionSlot] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [photoConsent, setPhotoConsent] = useState(false);

  const [setup, setSetup] = useState<PaymentSetup | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.functions
      .invoke("get-invitation", { body: { token } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setError(data?.error || "This invitation link could not be opened.");
        } else {
          setData(data as InvitationPayload);
          setParentName((prev) => prev || (data.invitation.parent_name ?? ""));
        }
      })
      .catch(() => setError("Something went wrong loading your invitation."))
      .finally(() => setLoading(false));
  }, [token]);

  // The signed-in parent's registered children — booking requires picking one.
  const loadChildren = () => {
    if (!user) return;
    (supabase as any)
      .from("children")
      .select("id, name")
      .eq("parent_user_id", user.id)
      .order("name")
      .then(({ data: kids }: { data: ChildOption[] | null }) => setChildren(kids ?? []));
  };
  useEffect(() => {
    if (!user) { setChildren(null); return; }
    loadChildren();
    setParentName((prev) => prev || ((user.user_metadata?.full_name as string | undefined) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Preselect the invited child when the names line up.
  useEffect(() => {
    if (!children || childId) return;
    const invited = data?.invitation.child_name?.trim().toLowerCase();
    const match = invited ? children.find((c) => c.name.trim().toLowerCase() === invited) : null;
    setChildId(match?.id ?? (children.length === 1 ? children[0].id : ""));
  }, [children, data, childId]);

  const handleContinue = async () => {
    if (!data) return;
    if (!childId) {
      setError("Please choose which child this booking is for.");
      return;
    }
    if (!parentName.trim()) {
      setError("Please fill in your name.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("create-booking-checkout", {
        body: {
          invitation_token: token,
          child_id: childId,
          parent_name: parentName.trim(),
          parent_phone: parentPhone.trim(),
          session_slot: sessionSlot,
          medical_notes: medicalNotes.trim(),
          photo_consent: photoConsent,
        },
      });
      if (error || res?.error || (!res?.client_secret && !res?.free)) {
        // supabase-js hides the function's JSON body behind error.context —
        // surface the server's message (capacity, invitation-only, …).
        let message = res?.error || "Payment setup failed";
        const ctx = (error as { context?: Response } | null)?.context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) message = body.error;
          } catch { /* keep generic message */ }
        }
        throw new Error(message);
      }
      if (res.free) {
        // Nothing to pay: the place is already confirmed and the ticket issued.
        navigate(`/booking/return?booking_id=${res.booking_id}&redirect_status=succeeded`);
        return;
      }
      setStripePromise(getStripeFor(res.environment as PaymentsEnvironment));
      setSetup({
        clientSecret: res.client_secret,
        bookingId: res.booking_id,
        environment: res.environment,
        mode: "payment",
        amountPence: res.amount_pence,
        isProgramme: !!res.is_programme,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment setup failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isProgramme = data?.event.programme_type === "programme";
  const complimentary = !!data?.invitation.complimentary;
  const noCharge = !!data && (complimentary || data.event.is_free || !data.event.price_pence);
  const priceLabel = data
    ? complimentary
      ? "No extra charge"
      : noCharge
        ? "Free"
        : isProgramme
          ? `${gbp(data.event.price_pence!)} for the full programme`
          : gbp(data.event.price_pence!)
    : "";
  const payLabel = data && !noCharge && data.event.price_pence ? gbp(data.event.price_pence) : "";

  const elementsOptions: StripeElementsOptions | null = setup
    ? {
        clientSecret: setup.clientSecret,
        appearance,
        loader: "auto" as const,
        // The Payment Element renders in Stripe's iframe — the brand font must
        // be loaded inside it explicitly.
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500&display=swap" }],
      }
    : null;

  const isCancelled = !!data?.event.cancelled_at;
  const sessionsShown = data ? (showAllSessions ? data.sessions : data.sessions.slice(0, 5)) : [];

  const Notice = ({ icon: Icon, title, children, tone = "neutral" }: { icon: LucideIcon; title: string; children?: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) => {
    const ring = { neutral: "bg-muted text-muted-foreground", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-red-50 text-red-700" }[tone];
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-card md:p-6">
        <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${ring}`}><Icon className="h-6 w-6" strokeWidth={1.8} /></div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {children && <div className="mt-2 space-y-3 text-sm text-muted-foreground">{children}</div>}
      </div>
    );
  };

  return (
    <FlowShell back={user ? { label: "My bookings", to: "/parent-hub?tab=bookings" } : undefined} maxWidth="max-w-2xl">
      {loading ? (
        <div className="space-y-4" aria-busy>
          <SkeletonBlock className="h-8 w-2/3" />
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-72" />
        </div>
      ) : !data ? (
        <Notice icon={AlertCircle} title="This invitation could not be opened" tone="warning">
          <p>{error}</p>
        </Notice>
      ) : (
        <div className="space-y-5">
          {/* ---- The invitation, as a product card ---- */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {data.event.poster_url && (
              <img src={data.event.poster_url} alt="" className="max-h-56 w-full object-cover" />
            )}
            <div className="p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                Invitation{data.invitation.child_name ? ` for ${data.invitation.child_name}` : ""}
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold leading-tight md:text-3xl">{data.event.title}</h1>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {data.event.event_date && !isProgramme && (
                  <p className="flex items-center gap-2"><Calendar size={15} className="shrink-0 text-muted-foreground/70" />
                    {new Date(data.event.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
                {isProgramme && (
                  <p className="flex items-center gap-2"><Calendar size={15} className="shrink-0 text-muted-foreground/70" />
                    {data.event.meeting_cadence ? data.event.meeting_cadence[0]!.toUpperCase() + data.event.meeting_cadence.slice(1) : "Weekly"} programme · {data.sessions.length} session{data.sessions.length === 1 ? "" : "s"}
                  </p>
                )}
                {data.event.location && <p className="flex items-center gap-2"><MapPin size={15} className="shrink-0 text-muted-foreground/70" /> {data.event.location}</p>}
              </div>

              <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Price</p>
                  <p className="font-display text-2xl font-semibold leading-tight">{complimentary ? "No extra charge" : noCharge ? "Free" : gbp(data.event.price_pence!)}</p>
                  {isProgramme && !noCharge && <p className="text-xs text-muted-foreground">for the full programme, paid once</p>}
                </div>
                {complimentary && <StatusBadge tone="success">Included</StatusBadge>}
              </div>

              {complimentary ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  This place is <strong className="text-foreground">included at no extra charge</strong> because{" "}
                  {data.invitation.child_name ?? "your child"} is already on one of our programmes — just confirm it below.
                </p>
              ) : isProgramme && (
                <p className="mt-3 text-sm text-muted-foreground">
                  One payment covers the <strong className="text-foreground">whole programme</strong> — every session below is included.
                </p>
              )}
              {data.event.description && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{data.event.description}</p>
              )}
            </div>

            {data.sessions.length > 0 && (
              <div className="border-t border-border">
                <p className="px-5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:px-6">
                  {isProgramme ? "Programme sessions · all included" : "Session dates"}
                </p>
                <ul className="divide-y divide-border">
                  {sessionsShown.map((sn) => (
                    <li key={sn.id} className={`flex items-center justify-between gap-3 px-5 py-2.5 text-sm md:px-6 ${sn.cancelled_at ? "text-muted-foreground line-through" : ""}`}>
                      <span>
                        {new Date(sn.session_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        {sn.start_time ? ` · ${formatTimeRange(sn.start_time, sn.end_time)}` : ""}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {sn.cancelled_at ? <StatusBadge tone="danger" dot={false}>Cancelled</StatusBadge> : sn.moved_from_date ? <StatusBadge tone="warning" dot={false}>Moved</StatusBadge> : null}
                        <span className="max-w-[9rem] truncate">{sn.venue ?? ""}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {data.sessions.length > 5 && (
                  <button type="button" onClick={() => setShowAllSessions((v) => !v)} className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-border text-sm font-medium text-primary">
                    {showAllSessions ? "Show fewer" : `Show all ${data.sessions.length} sessions`}
                    <ChevronDown className={`h-4 w-4 transition-transform ${showAllSessions ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ---- What happens next ---- */}
          {isCancelled ? (
            <Notice icon={AlertCircle} title="This event has been cancelled" tone="danger">
              <p>
                Suffolk Tennis will be in touch{data.existing_booking?.status === "paid" ? " about your payment" : ""}. Questions:{" "}
                <a href="mailto:enquiries@suffolktennis.online" className="font-medium text-primary">enquiries@suffolktennis.online</a>
              </p>
            </Notice>
          ) : data.existing_booking?.status === "paid" || data.invitation.status === "booked" ? (
            <Notice icon={Ticket} title="This place is already booked" tone="success">
              <p>Your entry ticket was emailed to you — it is also in your Parent Hub.</p>
              <Button asChild variant="outline"><Link to="/parent-hub?tab=bookings">Go to my bookings</Link></Button>
            </Notice>
          ) : setup && elementsOptions && stripePromise ? (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <PaymentStep setup={setup} priceLabel={payLabel} onBack={() => setSetup(null)} />
            </Elements>
          ) : authLoading ? (
            <SkeletonBlock className="h-40" />
          ) : !user ? (
            /* Onboarding gate 1: an account is required before booking. */
            <Notice icon={UserPlus} title="Sign in to book this place">
              <p>
                Bookings are made through your Suffolk Tennis account, so your child's profile, tickets and coach feedback
                all live in one place. It takes a minute to set up.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild size="lg">
                  <Link to={`/auth?redirect=${encodeURIComponent(`/book/${token}`)}`}><UserPlus className="w-4 h-4" /> Create free account</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to={`/auth?redirect=${encodeURIComponent(`/book/${token}`)}`}><LogIn className="w-4 h-4" /> Sign in</Link>
                </Button>
              </div>
              <p className="text-xs">You'll come straight back here to finish booking.</p>
            </Notice>
          ) : data.invitation.parent_email &&
            user.email?.toLowerCase() !== data.invitation.parent_email.toLowerCase() ? (
            /* Personal invitation: only the invited account can book with it. */
            <Notice icon={AlertCircle} title="This invitation isn't for this account" tone="warning">
              <p>
                It was sent to <strong className="text-foreground">{data.invitation.parent_email}</strong>, but you're signed in as{" "}
                <strong className="text-foreground">{user.email}</strong>. Please switch to the invited account to book.
              </p>
              <Button size="lg" onClick={async () => { await signOut(); window.location.assign(`/auth?redirect=${encodeURIComponent(`/book/${token}`)}`); }}>
                <LogIn className="w-4 h-4" /> Switch account
              </Button>
            </Notice>
          ) : children && children.length === 0 ? (
            /* Onboarding gate 2: the child must be registered (photo included). */
            <Notice icon={UserPlus} title={`Add ${data.invitation.child_name ?? "your child"} to your account`}>
              <p>
                Before booking, add your child's profile (including a photo — coaches use it on the session register).
                Then come back to this page to finish.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild size="lg">
                  <a href="/parent-hub?tab=children" target="_blank" rel="noreferrer"><UserPlus className="w-4 h-4" /> Add my child</a>
                </Button>
                <Button variant="outline" size="lg" onClick={loadChildren}><RefreshCcw className="w-4 h-4" /> I've added them</Button>
              </div>
            </Notice>
          ) : (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card md:p-6">
              <div>
                <h2 className="font-display text-lg font-semibold">Book this place</h2>
                <p className="text-xs text-muted-foreground">Booking as {user.email}</p>
              </div>
              <Field label="Which child is this for?" htmlFor="bk-child" required>
                <Select value={childId} onValueChange={setChildId}>
                  <SelectTrigger id="bk-child"><SelectValue placeholder="Choose your child" /></SelectTrigger>
                  <SelectContent>
                    {(children ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <a href="/parent-hub?tab=children" target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center text-xs font-medium text-primary">
                  Add another child
                </a>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" htmlFor="bk-name" required>
                  <Input id="bk-name" autoComplete="name" value={parentName} onChange={(e) => setParentName(e.target.value)} />
                </Field>
                <Field label="Phone" htmlFor="bk-phone" hint="Optional — for on-the-day contact.">
                  <Input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
                </Field>
              </div>
              {Array.isArray(data.event.session_slots) && data.event.session_slots.length > 0 && (
                <Field label="Session" htmlFor="bk-slot">
                  <Select value={sessionSlot} onValueChange={setSessionSlot}>
                    <SelectTrigger id="bk-slot"><SelectValue placeholder="Choose a session" /></SelectTrigger>
                    <SelectContent>
                      {data.event.session_slots.map((sl) => <SelectItem key={sl} value={sl}>{sl}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Anything else for the coaches?" htmlFor="bk-notes" hint="Optional — your child's profile medical info is already shared.">
                <Textarea id="bk-notes" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} rows={2} />
              </Field>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
                <Checkbox checked={photoConsent} onCheckedChange={(v) => setPhotoConsent(v === true)} className="mt-0.5" />
                <span>I consent to photos of my child being taken at this event for Suffolk Tennis use.</span>
              </label>
              {isProgramme && (
                <p className="text-sm text-muted-foreground">
                  By {noCharge ? "confirming" : "accepting"} this place you agree to be added to the age-group WhatsApp group and the Suffolk Junior Tennis Hub, which we use for key Suffolk Tennis announcements.
                </p>
              )}
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button onClick={handleContinue} disabled={submitting} size="lg" className="w-full">
                {submitting
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : noCharge ? "Confirm this place" : `Continue to payment · ${payLabel}`}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {noCharge
                  ? "No payment needed. Your entry QR ticket is emailed to you as soon as you confirm."
                  : "Secure card payment powered by Stripe. You'll receive your entry QR ticket by email once paid."}
              </p>
            </section>
          )}
        </div>
      )}
    </FlowShell>
  );
};

export default BookingPage;
