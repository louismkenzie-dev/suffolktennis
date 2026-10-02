// suffolktennis.online/nominate — a coach, club or school puts a child forward
// for the Suffolk Rising Stars Talent ID days.
//
// The link in Ollie's outreach email and on the posters. It asks only what a
// coach can answer from the side of a court: the child's name and date of
// birth (the year alone if that's all they know), where they play, which day suits, and why. Parent details are
// optional and only with permission. The submit-nomination function saves it
// and adds the child to the county database, so nothing is retyped.
import { cloneElement, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slotFor, slotMismatch } from "@/lib/sessionSlots";
import risingStarsBadge from "@/assets/suffolk-rising-stars-badge.png";

/** Shown on the page; the form stays open after it so late ones still land. */
const NOMINATIONS_CLOSE = "Sunday 11 October 2026";
const CONTACT_EMAIL = "enquiries@suffolktennis.online";
const BIRTH_YEARS = [2017, 2018, 2019, 2020, 2021, 2022];
// Short names so the month fits beside the day and year on a phone.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Day, month and year as chosen → what we send. The full date when all three
 * are there and real; the year alone is accepted too. Returns an error for a
 * part-date or an impossible one (31 February).
 */
function birthFields(day: string, month: string, year: string): { date_of_birth: string | null; birth_year: number | null } | { error: string } {
  if (!day && !month) return { date_of_birth: null, birth_year: year ? Number(year) : null };
  if (!day || !month || !year) return { error: "Please choose the day, month and year of birth — or just the year if that's all you know" };
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const d = new Date(`${iso}T12:00:00Z`);
  if (d.getUTCDate() !== Number(day)) return { error: "That date of birth doesn't exist — please check the day and month" };
  return { date_of_birth: iso, birth_year: Number(year) };
}

const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const schema = z.object({
  player_first_name: z.string().trim().min(1, "The player's first name is needed").max(80),
  player_last_name: z.string().trim().min(1, "The player's last name is needed").max(80),
  birth_day: z.string().optional(),
  birth_month: z.string().optional(),
  birth_year: z.string().optional(),
  gender: z.enum(["male", "female", ""]).optional(),
  club: opt(160),
  event_id: z.string().optional(),
  session_slot: opt(120),
  parent_name: opt(120),
  parent_email: z.string().trim().email("That parent email doesn't look right").max(255).optional().or(z.literal("")),
  parent_phone: opt(40),
  nominator_name: z.string().trim().min(1, "Your name is needed").max(120),
  nominator_role: opt(160),
  nominator_email: z.string().trim().email("Your email doesn't look right").max(255),
  nominator_phone: opt(40),
  reason: opt(1500),
  website: opt(200),
});

type TalentEvent = { id: string; title: string; event_date: string; location: string | null; session_slots: string[] | null };

const empty = {
  player_first_name: "", player_last_name: "", birth_day: "", birth_month: "", birth_year: "", gender: "" as "" | "male" | "female", club: "",
  event_id: "", session_slot: "", parent_name: "", parent_email: "", parent_phone: "",
  nominator_name: "", nominator_role: "", nominator_email: "", nominator_phone: "", reason: "", website: "",
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

// Labels are tied to their control so screen readers and a tap on the label
// both reach it; the child is cloned with the generated id.
const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactElement }) => {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-foreground">{label}</Label>
      {cloneElement(children, { id })}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-display text-xs font-black uppercase tracking-[0.2em] text-lta-cyan">{children}</h2>
);

const Nominate = () => {
  const [form, setForm] = useState(empty);
  const [events, setEvents] = useState<TalentEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ player: string } | null>(null);
  const set = (patch: Partial<typeof empty>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    document.title = "Nominate a player — Suffolk Rising Stars";
    window.scrollTo(0, 0);
    supabase
      .from("events")
      .select("id, title, event_date, location, session_slots")
      .eq("event_type", "rising-stars")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .then(({ data }) => setEvents(((data as unknown) as TalentEvent[]) ?? []));
  }, []);

  const chosen = events.find((e) => e.id === form.event_id);
  const slots = (chosen?.session_slots ?? []).filter(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Please check the form");
      return;
    }
    const birth = birthFields(parsed.data.birth_day ?? "", parsed.data.birth_month ?? "", parsed.data.birth_year ?? "");
    if ("error" in birth) { toast.error(birth.error); return; }
    const { birth_day: _d, birth_month: _m, ...rest } = parsed.data;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("submit-nomination", {
      body: { ...rest, ...birth },
    });
    setBusy(false);
    const detail = (data as { error?: string } | null)?.error;
    if (error || detail) {
      toast.error(detail ?? "Couldn't send the nomination — please try again, or email " + CONTACT_EMAIL);
      return;
    }
    setDone({ player: `${parsed.data.player_first_name} ${parsed.data.player_last_name}` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const nominateAnother = () => {
    // Keep who is nominating; clear the child.
    setForm({ ...empty, nominator_name: form.nominator_name, nominator_role: form.nominator_role, nominator_email: form.nominator_email, nominator_phone: form.nominator_phone, club: form.club });
    setDone(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden bg-suffolk-navy pt-36 pb-16 md:pt-40 md:pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-suffolk-navy via-suffolk-navy to-primary/40" />
        <div className="container relative mx-auto px-6">
          <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-lta-cyan/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-lta-cyan">
                <Sparkles size={14} /> Suffolk Rising Stars · 8U Talent ID
              </span>
              <h1 className="mt-5 font-display text-4xl font-black text-primary-foreground md:text-6xl">
                Is there someone <span className="text-lta-yellow">we should know about?</span>
              </h1>
              <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed text-primary-foreground/85">
                If a child you coach or teach catches your eye — athletic, competitive, coordinated, or simply in love with the game — put them forward. They don't need to be a polished player. We look for potential.
              </p>
              <p className="mt-3 font-body text-primary-foreground/70">
                Takes about a minute per player. Nominations close <strong className="text-primary-foreground">{NOMINATIONS_CLOSE}</strong>. All sessions are free.
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <img src={risingStarsBadge} alt="Suffolk Rising Stars badge with Punchy the mascot" className="w-56 object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.35)] md:w-72" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl">
            {done ? (
              <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm md:p-12">
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
                <h2 className="mt-5 font-display text-3xl font-black">Thank you — {done.player} is in.</h2>
                <p className="mx-auto mt-4 max-w-xl font-body text-muted-foreground">
                  We've emailed you a copy. Ollie and the county team review every nomination after {NOMINATIONS_CLOSE}, then contact the family directly with an invitation and sign-up details.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button size="lg" onClick={nominateAnother}><Star className="h-4 w-4" /> Nominate another player</Button>
                  <Button size="lg" variant="outline" asChild><Link to="/events/rising-stars">About Rising Stars</Link></Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-8 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-10" noValidate>
                <div className="space-y-4">
                  <SectionTitle>The player</SectionTitle>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name *"><Input autoComplete="off" value={form.player_first_name} onChange={(e) => set({ player_first_name: e.target.value })} /></Field>
                    <Field label="Last name *"><Input autoComplete="off" value={form.player_last_name} onChange={(e) => set({ player_last_name: e.target.value })} /></Field>
                  </div>
                  <fieldset>
                    <legend className="text-sm font-medium leading-none text-foreground">Date of birth</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Select value={form.birth_day} onValueChange={(v) => set({ birth_day: v })}>
                        <SelectTrigger aria-label="Day of birth"><SelectValue placeholder="Day" /></SelectTrigger>
                        <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={form.birth_month} onValueChange={(v) => set({ birth_month: v })}>
                        <SelectTrigger aria-label="Month of birth"><SelectValue placeholder="Month" /></SelectTrigger>
                        <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={form.birth_year} onValueChange={(v) => set({ birth_year: v })}>
                        <SelectTrigger aria-label="Year of birth"><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent>{BIRTH_YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">The full date if you know it, as a January and a December birthday are nearly a year apart at this age. Just the year is fine if that's all you have. Our focus is 2020 and 2021, and the 2019s heading for 8U County Cup, but nominate anyone who stands out.</p>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Boy or girl">
                      <Select value={form.gender} onValueChange={(v) => set({ gender: v as "male" | "female" })}>
                        <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Boy</SelectItem>
                          <SelectItem value="female">Girl</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Club, school or programme they play at"><Input placeholder="e.g. Ipswich Sports Club, or Hillside Primary" value={form.club} onChange={(e) => set({ club: e.target.value })} /></Field>
                </div>

                <div className="space-y-4">
                  <SectionTitle>Which day suits, if you know</SectionTitle>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">We'll be in touch with the family about dates.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {events.map((ev) => {
                        const active = form.event_id === ev.id;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            // Pre-select the session that fits the child's birth year, if one does.
                            onClick={() => set({ event_id: active ? "" : ev.id, session_slot: active ? "" : slotFor((ev.session_slots ?? []).filter(Boolean), form.birth_year ? Number(form.birth_year) : null) ?? "" })}
                            aria-pressed={active}
                            className={`rounded-2xl border p-4 text-left transition-colors ${active ? "border-lta-cyan bg-lta-cyan/10" : "border-border bg-background hover:border-lta-cyan/50"}`}
                          >
                            <div className="text-xs font-bold uppercase tracking-wider text-lta-cyan">{fmtDay(ev.event_date)}</div>
                            <div className="mt-1 font-display text-lg font-black">{ev.location ?? ev.title}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {chosen && slots.length > 0 && (
                    <Field label="Session">
                      <Select value={form.session_slot} onValueChange={(v) => set({ session_slot: v })}>
                        <SelectTrigger><SelectValue placeholder="Choose a session" /></SelectTrigger>
                        <SelectContent>{slots.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  )}
                  {slotMismatch(form.session_slot, form.birth_year ? Number(form.birth_year) : null) && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      That session is for children born in a different year from {form.birth_year}. Please check the session, or the date of birth above.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <SectionTitle>Why them?</SectionTitle>
                  <Textarea rows={4} placeholder="A sentence or two is plenty — what have you noticed?" value={form.reason} onChange={(e) => set({ reason: e.target.value })} />
                </div>

                <div className="space-y-4">
                  <SectionTitle>About you</SectionTitle>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your name *"><Input autoComplete="name" value={form.nominator_name} onChange={(e) => set({ nominator_name: e.target.value })} /></Field>
                    <Field label="Role and club or school"><Input placeholder="e.g. Head coach, Framlingham Tennis Club" value={form.nominator_role} onChange={(e) => set({ nominator_role: e.target.value })} /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your email *" hint="We'll send you a copy of the nomination."><Input type="email" inputMode="email" autoComplete="email" value={form.nominator_email} onChange={(e) => set({ nominator_email: e.target.value })} /></Field>
                    <Field label="Your phone"><Input type="tel" inputMode="tel" autoComplete="tel" value={form.nominator_phone} onChange={(e) => set({ nominator_phone: e.target.value })} /></Field>
                  </div>
                </div>

                <div className="space-y-4">
                  <SectionTitle>The family, if you have their details</SectionTitle>
                  <p className="text-sm text-muted-foreground">Optional, and only with the parent's permission. It lets us send their invitation straight away; otherwise we'll come back to you.</p>
                  <Field label="Parent or guardian name"><Input autoComplete="off" value={form.parent_name} onChange={(e) => set({ parent_name: e.target.value })} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Parent email"><Input type="email" inputMode="email" autoComplete="off" value={form.parent_email} onChange={(e) => set({ parent_email: e.target.value })} /></Field>
                    <Field label="Parent phone"><Input type="tel" inputMode="tel" autoComplete="off" value={form.parent_phone} onChange={(e) => set({ parent_phone: e.target.value })} /></Field>
                  </div>
                </div>

                {/* Honeypot: hidden from people, filled by bots. */}
                <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                  <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set({ website: e.target.value })} /></label>
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Details are used only to arrange Talent ID sessions and are handled under our <Link to="/safeguarding" className="underline">safeguarding</Link> and privacy commitments. Questions: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
                  </p>
                  <Button type="submit" size="lg" disabled={busy} className="shrink-0">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />} Send nomination
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Nominate;
