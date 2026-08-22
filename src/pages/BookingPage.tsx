import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Appearance, Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStripeFor, type PaymentsEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Loader2, Ticket, AlertCircle, ArrowLeft, Lock, ShieldCheck, UserPlus, LogIn, RefreshCcw } from "lucide-react";
import logo from "@/assets/suffolk-tennis-logo-v7.png";

type InvitationPayload = {
  invitation: { id: string; status: string; child_name: string | null; parent_name: string | null; parent_email: string };
  event: {
    id: string; title: string; description: string | null; event_date: string | null;
    location: string | null; poster_url: string | null; session_slots: string[] | null;
    programme_type: string; price_pence: number | null; monthly_amount_pence: number | null;
    programme_months: number | null; capacity: number | null;
  };
  sessions: Array<{ id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null }>;
  existing_booking: { id: string; status: string } | null;
};

type PaymentSetup = {
  clientSecret: string;
  bookingId: string;
  environment: PaymentsEnvironment;
  mode: "payment" | "subscription";
  amountPence: number;
  monthsTotal: number | null;
};

const gbp = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

// Stripe Payment Element theming — matches the navy booking page so the card
// form reads as part of the site, not an embedded third party.
const appearance: Appearance = {
  theme: "night",
  labels: "floating",
  variables: {
    colorPrimary: "hsl(195 100% 45%)", // lta-cyan
    colorBackground: "hsl(220 55% 18%)",
    colorText: "hsl(0 0% 98%)",
    colorTextSecondary: "hsl(220 20% 70%)",
    colorTextPlaceholder: "hsl(220 20% 55%)",
    colorDanger: "hsl(0 84% 66%)",
    colorIcon: "hsl(220 20% 70%)",
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
    fontSizeBase: "15px",
    borderRadius: "10px",
  },
  rules: {
    ".Input": {
      backgroundColor: "hsl(220 60% 11%)",
      border: "1px solid hsla(0, 0%, 100%, 0.18)",
      boxShadow: "none",
      padding: "12px 14px",
    },
    ".Input:focus": {
      border: "1px solid hsl(195 100% 45%)",
      boxShadow: "0 0 0 1px hsl(195 100% 45%)",
    },
    ".Label": { color: "hsl(220 20% 70%)", fontSize: "13px" },
    ".Tab": {
      backgroundColor: "hsl(220 60% 11%)",
      border: "1px solid hsla(0, 0%, 100%, 0.18)",
    },
    ".Tab--selected": {
      border: "1px solid hsl(195 100% 45%)",
      boxShadow: "0 0 0 1px hsl(195 100% 45%)",
    },
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
    <form onSubmit={handleSubmit} className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg">Payment</h3>
        <button type="button" onClick={onBack} className="text-sm text-primary-foreground/60 hover:text-primary-foreground inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to details
        </button>
      </div>
      {setup.mode === "subscription" && setup.monthsTotal && (
        <p className="text-sm text-primary-foreground/70">
          You're signing up for the full programme — every session included. Your card is charged {gbp(setup.amountPence)} today and then monthly, {setup.monthsTotal} payments in total; billing stops automatically once the programme is paid.
        </p>
      )}
      <PaymentElement options={{ layout: { type: "tabs", defaultCollapsed: false } }} />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" disabled={!stripe || !elements || submitting} className="w-full bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold h-12 text-base">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay ${priceLabel}`}
      </Button>
      <div className="flex items-center justify-center gap-4 text-[11px] text-primary-foreground/50 uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Secure payment</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Powered by Stripe</span>
      </div>
    </form>
  );
};

type ChildOption = { id: string; name: string };

const BookingPage = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
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
      if (error || res?.error || !res?.client_secret) {
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
      setStripePromise(getStripeFor(res.environment as PaymentsEnvironment));
      setSetup({
        clientSecret: res.client_secret,
        bookingId: res.booking_id,
        environment: res.environment,
        mode: res.mode,
        amountPence: res.amount_pence,
        monthsTotal: res.months_total ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment setup failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isProgramme = data?.event.programme_type === "monthly_programme";
  const priceLabel = data
    ? isProgramme && data.event.monthly_amount_pence
      ? `${gbp(data.event.monthly_amount_pence)}/month × ${data.event.programme_months} months`
      : data.event.price_pence
        ? gbp(data.event.price_pence)
        : "Free"
    : "";
  const payLabel = data
    ? isProgramme && data.event.monthly_amount_pence
      ? `${gbp(data.event.monthly_amount_pence)} today`
      : data.event.price_pence
        ? gbp(data.event.price_pence)
        : ""
    : "";

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

  return (
    <div className="min-h-screen bg-suffolk-navy text-primary-foreground">
      <header className="container mx-auto px-6 py-6">
        <Link to="/"><img src={logo} alt="Suffolk Tennis" className="h-12" /></Link>
      </header>
      <main className="container mx-auto px-6 pb-20 max-w-2xl">
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-lta-cyan" /></div>
        ) : !data ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <AlertCircle className="w-10 h-10 text-lta-yellow mx-auto mb-4" />
            <p className="text-lg">{error}</p>
          </div>
        ) : (
          <>
            <span className="inline-block px-3 py-1 rounded-full bg-lta-yellow/15 text-lta-yellow text-[11px] font-bold uppercase tracking-widest mb-3">
              Invitation for {data.invitation.child_name || "your player"}
            </span>
            <h1 className="font-display text-3xl md:text-4xl font-black">{data.event.title}</h1>
            <div className="mt-3 space-y-1.5 text-sm text-primary-foreground/80">
              {data.event.event_date && (
                <div className="flex items-center gap-2"><Calendar size={14} className="text-lta-cyan" />
                  {new Date(data.event.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              )}
              {data.event.location && <div className="flex items-center gap-2"><MapPin size={14} className="text-lta-cyan" /> {data.event.location}</div>}
              <div className="text-lta-yellow font-bold mt-2">{priceLabel}</div>
              {isProgramme && (
                <p className="text-primary-foreground/60 text-xs">
                  One sign-up covers the <strong className="text-primary-foreground/90">whole programme</strong> — every
                  session listed below is included. Your card is simply billed monthly
                  ({data.event.programme_months} payments in total).
                </p>
              )}
            </div>
            {data.event.description && (
              <p className="mt-4 text-primary-foreground/70 text-sm whitespace-pre-line">{data.event.description}</p>
            )}
            {data.sessions.length > 0 && (
              <div className="mt-5 bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="font-display font-bold text-sm mb-2">
                  {isProgramme ? `Programme sessions (${data.sessions.length}) — all included in your sign-up` : "Session dates"}
                </h3>
                <ul className="text-sm text-primary-foreground/80 space-y-1">
                  {data.sessions.map((s) => (
                    <li key={s.id}>
                      {new Date(s.session_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      {s.start_time ? ` · ${s.start_time.slice(0, 5)}${s.end_time ? `–${s.end_time.slice(0, 5)}` : ""}` : ""}
                      {s.venue ? ` · ${s.venue}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.existing_booking?.status === "paid" || data.invitation.status === "booked" ? (
              <div className="mt-8 bg-lta-cyan/10 border border-lta-cyan/30 rounded-2xl p-6 text-center">
                <Ticket className="w-8 h-8 text-lta-cyan mx-auto mb-3" />
                <p className="font-bold">This place is already booked.</p>
                <p className="text-sm text-primary-foreground/70 mt-1">Your entry ticket was emailed to you — check your inbox for the confirmation.</p>
              </div>
            ) : setup && elementsOptions && stripePromise ? (
              <Elements stripe={stripePromise} options={elementsOptions}>
                <PaymentStep setup={setup} priceLabel={payLabel} onBack={() => setSetup(null)} />
              </Elements>
            ) : authLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-lta-cyan" /></div>
            ) : !user ? (
              /* Onboarding gate 1: an account is required before booking. */
              <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-4">
                <h3 className="font-display font-bold text-lg">Sign in to book this place</h3>
                <p className="text-sm text-primary-foreground/70">
                  Bookings are made through your Suffolk Tennis account, so your child's
                  profile, tickets and coach feedback all live in one place. It takes a
                  minute to set up.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild className="bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold h-12 px-6">
                    <Link to={`/auth?redirect=${encodeURIComponent(`/book/${token}`)}`}><UserPlus className="w-4 h-4 mr-2" /> Create free account</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 px-6 border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground font-bold">
                    <Link to={`/auth?redirect=${encodeURIComponent(`/book/${token}`)}`}><LogIn className="w-4 h-4 mr-2" /> Sign in</Link>
                  </Button>
                </div>
                <p className="text-[11px] text-primary-foreground/50">You'll come straight back here to finish booking.</p>
              </div>
            ) : children && children.length === 0 ? (
              /* Onboarding gate 2: the child must be registered (photo included). */
              <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-4">
                <h3 className="font-display font-bold text-lg">
                  Add {data.invitation.child_name ?? "your child"} to your account
                </h3>
                <p className="text-sm text-primary-foreground/70">
                  Before booking, add your child's profile (including a photo — coaches
                  use it on the session register). Then come back to this page to pay.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild className="bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold h-12 px-6">
                    <a href="/parent-hub?tab=children" target="_blank" rel="noreferrer"><UserPlus className="w-4 h-4 mr-2" /> Add my child</a>
                  </Button>
                  <Button variant="outline" onClick={loadChildren} className="h-12 px-6 border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground font-bold">
                    <RefreshCcw className="w-4 h-4 mr-2" /> I've added them
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-lg">Book this place</h3>
                <p className="text-xs text-primary-foreground/50 -mt-2">Booking as {user.email}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-primary-foreground/80">Which child is this for?</Label>
                    <Select value={childId} onValueChange={setChildId}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground"><SelectValue placeholder="Choose your child" /></SelectTrigger>
                      <SelectContent>
                        {(children ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <a href="/parent-hub?tab=children" target="_blank" rel="noreferrer" className="text-[11px] text-lta-cyan hover:underline mt-1 inline-block">
                      Add another child
                    </a>
                  </div>
                  <div>
                    <Label className="text-primary-foreground/80">Your name</Label>
                    <Input value={parentName} onChange={(e) => setParentName(e.target.value)} className="bg-white/10 border-white/20 text-primary-foreground" />
                  </div>
                  <div>
                    <Label className="text-primary-foreground/80">Phone (optional)</Label>
                    <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className="bg-white/10 border-white/20 text-primary-foreground" />
                  </div>
                </div>
                {Array.isArray(data.event.session_slots) && data.event.session_slots.length > 0 && (
                  <div>
                    <Label className="text-primary-foreground/80">Session</Label>
                    <Select value={sessionSlot} onValueChange={setSessionSlot}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground"><SelectValue placeholder="Choose a session" /></SelectTrigger>
                      <SelectContent>
                        {data.event.session_slots.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-primary-foreground/80">Anything else for the coaches? (optional — your child's profile medical info is already shared)</Label>
                  <Textarea value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} className="bg-white/10 border-white/20 text-primary-foreground" rows={2} />
                </div>
                <label className="flex items-start gap-2 text-sm text-primary-foreground/80 cursor-pointer">
                  <Checkbox checked={photoConsent} onCheckedChange={(v) => setPhotoConsent(v === true)} className="mt-0.5" />
                  I consent to photos of my child being taken at this event for Suffolk Tennis use.
                </label>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <Button onClick={handleContinue} disabled={submitting} className="w-full bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold h-12 text-base">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Continue to payment · ${priceLabel}`}
                </Button>
                <p className="text-[11px] text-primary-foreground/50 text-center">Secure card payment powered by Stripe. You'll receive your entry QR ticket by email once paid.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default BookingPage;
