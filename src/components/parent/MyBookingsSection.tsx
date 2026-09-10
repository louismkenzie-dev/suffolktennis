import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, MapPin, ArrowRight } from "lucide-react";
import { formatTimeRange } from "@/lib/timeFormat";
import { PageHeader, Section, ListGroup, ListRow, StatusBadge, bookingStatus, EmptyState, SkeletonRows } from "@/components/app";
import BookingDetailDialog, { type MembershipDetail } from "./BookingDetailDialog";

const db = supabase as any;

type Invitation = {
  id: string; token: string; status: string; child_name: string | null;
  event_id: string; created_at: string; complimentary?: boolean | null;
};
type Booking = {
  id: string; event_id: string; child_name: string; status: string;
  amount_pence: number; session_slot: string | null; paid_at: string | null;
};
type EventInfo = {
  id: string; title: string; event_date: string | null; location: string | null;
  programme_type: string | null; programme_months: number | null;
  price_pence?: number | null; is_free?: boolean | null; meeting_cadence?: string | null; cancelled_at?: string | null;
};
type UpcomingSession = {
  id: string; event_id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null; moved_from_date?: string | null;
};

const cadenceLabel = (c: string | null | undefined) => (c ? c[0]!.toUpperCase() + c.slice(1) : "Weekly");
const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const longDate = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** Day/month block used as the leading element on session rows. */
const DateBlock = ({ iso }: { iso: string }) => {
  const d = new Date(iso + "T12:00:00");
  return (
    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
      <span className="text-[10px] font-semibold uppercase leading-none">{d.toLocaleDateString("en-GB", { month: "short" })}</span>
      <span className="mt-0.5 text-lg font-semibold leading-none tabular">{d.getDate()}</span>
    </div>
  );
};

/** The premium invitation card: what, when, where, for whom, how much — and one clear action. */
const InvitationCard = ({ inv, ev }: { inv: Invitation; ev: EventInfo | undefined }) => {
  const isProgramme = ev?.programme_type === "programme";
  const price = inv.complimentary
    ? "No extra charge"
    : ev?.is_free || !ev?.price_pence
      ? "Free"
      : isProgramme ? `${gbp(ev.price_pence)} · full programme` : gbp(ev.price_pence);
  return (
    <article className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-card">
      <div className="h-1 bg-primary" aria-hidden />
      <div className="p-4 md:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          Invitation{inv.child_name ? ` · ${inv.child_name}` : ""}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold leading-tight text-foreground md:text-xl">{ev?.title ?? "Invitation"}</h3>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          {ev?.event_date && !isProgramme && (
            <p className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-muted-foreground/70" />{longDate(ev.event_date)}</p>
          )}
          {isProgramme && (
            <p className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-muted-foreground/70" />{cadenceLabel(ev?.meeting_cadence)} programme · every session included</p>
          )}
          {ev?.location && (
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-muted-foreground/70" />{ev.location}</p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Price</p>
            <p className="text-lg font-semibold leading-tight text-foreground">{price}</p>
          </div>
          <Button asChild size="lg" className="min-w-[9rem]">
            <Link to={`/book/${inv.token}`}>Book place <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

const MyBookingsSection = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tickets, setTickets] = useState<Map<string, string>>(new Map()); // booking_id -> qr_token
  const [events, setEvents] = useState<Map<string, EventInfo>>(new Map());
  const [memberships, setMemberships] = useState<Map<string, NonNullable<MembershipDetail>>>(new Map()); // booking_id -> membership
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: invs }, { data: bks }] = await Promise.all([
        db.from("booking_invitations")
          .select("id, token, status, child_name, event_id, created_at, complimentary")
          .eq("parent_user_id", user.id)
          .in("status", ["invited", "opened", "booked"])
          .order("created_at", { ascending: false }),
        db.from("bookings")
          .select("id, event_id, child_name, status, amount_pence, session_slot, paid_at")
          .eq("parent_user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      setInvitations(invs ?? []);
      setBookings(bks ?? []);

      const bookingIds = (bks ?? []).map((b: Booking) => b.id);
      if (bookingIds.length > 0) {
        const [{ data: tks }, { data: mems }] = await Promise.all([
          db.from("tickets").select("booking_id, qr_token, status").in("booking_id", bookingIds),
          db.from("memberships").select("booking_id, months_paid, months_total, status").in("booking_id", bookingIds),
        ]);
        setTickets(new Map((tks ?? []).filter((t: any) => t.status === "active").map((t: any) => [t.booking_id, t.qr_token])));
        setMemberships(new Map((mems ?? []).map((m: any) => [m.booking_id, m])));
      }

      const eventIds = [...new Set([...(invs ?? []).map((i: Invitation) => i.event_id), ...(bks ?? []).map((b: Booking) => b.event_id)])];
      if (eventIds.length > 0) {
        // Invited parents can read their private events via RLS.
        const { data: evs } = await db.from("events")
          .select("id, title, event_date, location, programme_type, programme_months, price_pence, is_free, meeting_cadence, cancelled_at")
          .in("id", eventIds);
        setEvents(new Map((evs ?? []).map((e: EventInfo) => [e.id, e])));
      }

      // What's next: the coming sessions of anything paid for.
      const paidEventIds = [...new Set((bks ?? []).filter((b: Booking) => b.status === "paid").map((b: Booking) => b.event_id))];
      if (paidEventIds.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: sess } = await db.from("event_sessions")
          .select("id, event_id, session_date, start_time, end_time, venue, moved_from_date, cancelled_at")
          .in("event_id", paidEventIds)
          .gte("session_date", today)
          .is("cancelled_at", null)
          .order("session_date")
          .order("start_time")
          .limit(6);
        setUpcoming(sess ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  const openInvitations = useMemo(() => invitations.filter((i) => i.status !== "booked"), [invitations]);
  const childrenOn = useMemo(() => {
    const m = new Map<string, string[]>();
    bookings.filter((b) => b.status === "paid").forEach((b) => m.set(b.event_id, [...(m.get(b.event_id) ?? []), b.child_name]));
    return m;
  }, [bookings]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bookings" hideTitleOnPhone description="Invitations, upcoming sessions and your children's places." className="mb-0" />
        <SkeletonRows rows={3} avatar={false} />
      </div>
    );
  }

  const nothing = openInvitations.length === 0 && bookings.length === 0;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Bookings"
        hideTitleOnPhone
        description={nothing ? undefined : "Invitations, upcoming sessions and your children's places."}
        className="mb-0"
      />

      {nothing ? (
        <EmptyState
          icon={Mail}
          title="No invitations or bookings yet"
          description="When Suffolk Tennis invites your child to a session or programme it appears here, and in your email."
        />
      ) : (
        <>
          {openInvitations.length > 0 && (
            <Section title="Needs your attention" count={openInvitations.length}>
              <div className="grid gap-3 md:grid-cols-2">
                {openInvitations.map((inv) => <InvitationCard key={inv.id} inv={inv} ev={events.get(inv.event_id)} />)}
              </div>
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section title="Coming up">
              <ListGroup>
                {upcoming.map((s) => {
                  const ev = events.get(s.event_id);
                  const kids = childrenOn.get(s.event_id) ?? [];
                  return (
                    <ListRow
                      key={s.id}
                      wrapTitle
                      leading={<DateBlock iso={s.session_date} />}
                      title={ev?.title ?? "Session"}
                      subtitle={[
                        new Date(s.session_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" }),
                        s.start_time ? formatTimeRange(s.start_time, s.end_time) : null,
                        s.venue ?? ev?.location ?? null,
                      ].filter(Boolean).join(" · ")}
                      detail={[kids.join(", "), s.moved_from_date ? "moved" : null].filter(Boolean).join(" · ") || undefined}
                      onClick={() => {
                        const b = bookings.find((x) => x.event_id === s.event_id && x.status === "paid");
                        if (b) setOpenBookingId(b.id);
                      }}
                      chevron
                    />
                  );
                })}
              </ListGroup>
            </Section>
          )}

          {bookings.length > 0 && (
            <Section title="Your bookings" count={bookings.length}>
              <ListGroup>
                {bookings.map((b) => {
                  const ev = events.get(b.event_id);
                  const membership = memberships.get(b.id);
                  const isProgramme = ev?.programme_type === "programme";
                  const st = ev?.cancelled_at ? { tone: "danger" as const, label: "Cancelled" } : bookingStatus(b.status);
                  return (
                    <ListRow
                      key={b.id}
                      wrapTitle
                      onClick={() => setOpenBookingId(b.id)}
                      title={ev?.title ?? "Booking"}
                      subtitle={[b.child_name, b.amount_pence === 0 ? "No charge" : `${gbp(b.amount_pence)}${isProgramme && membership ? "/month" : ""}`, b.session_slot].filter(Boolean).join(" · ")}
                      detail={isProgramme && membership ? `${membership.months_paid}/${membership.months_total} months paid` : undefined}
                      trailing={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
                      chevron
                    />
                  );
                })}
              </ListGroup>
            </Section>
          )}
        </>
      )}

      {(() => {
        const b = bookings.find((x) => x.id === openBookingId) ?? null;
        return (
          <BookingDetailDialog
            open={!!openBookingId}
            onOpenChange={(open) => { if (!open) setOpenBookingId(null); }}
            booking={b}
            event={b ? events.get(b.event_id) ?? null : null}
            membership={b ? memberships.get(b.id) ?? null : null}
            qrToken={b ? tickets.get(b.id) ?? null : null}
          />
        );
      })()}
    </div>
  );
};

export default MyBookingsSection;
