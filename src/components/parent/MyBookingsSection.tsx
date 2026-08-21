import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Ticket, Mail, Calendar, MapPin, AlertCircle, ChevronRight } from "lucide-react";
import BookingDetailDialog, { type MembershipDetail } from "./BookingDetailDialog";

const db = supabase as any;

type Invitation = {
  id: string; token: string; status: string; child_name: string | null;
  event_id: string; created_at: string;
};
type Booking = {
  id: string; event_id: string; child_name: string; status: string;
  amount_pence: number; session_slot: string | null; paid_at: string | null;
};
type EventInfo = {
  id: string; title: string; event_date: string | null; location: string | null;
  programme_type: string | null; programme_months: number | null;
};

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;

const MyBookingsSection = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tickets, setTickets] = useState<Map<string, string>>(new Map()); // booking_id -> qr_token
  const [events, setEvents] = useState<Map<string, EventInfo>>(new Map());
  const [memberships, setMemberships] = useState<Map<string, NonNullable<MembershipDetail>>>(new Map()); // booking_id -> membership
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: invs }, { data: bks }] = await Promise.all([
        db.from("booking_invitations")
          .select("id, token, status, child_name, event_id, created_at")
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
        const { data: evs } = await db.from("events").select("id, title, event_date, location, programme_type, programme_months").in("id", eventIds);
        setEvents(new Map((evs ?? []).map((e: EventInfo) => [e.id, e])));
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-lta-cyan" /></div>;

  const openInvitations = invitations.filter((i) => i.status !== "booked");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      {openInvitations.length === 0 && bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground">No invitations or bookings yet</p>
            <p className="text-sm mt-1">When Suffolk Tennis invites your child to a session or programme, it will appear here (and in your email).</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {openInvitations.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-lg mb-3">Invitations awaiting booking</h3>
              <div className="space-y-3">
                {openInvitations.map((inv) => {
                  const ev = events.get(inv.event_id);
                  return (
                    <Card key={inv.id} className="border-lta-cyan/40">
                      <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">{ev?.title ?? "Invitation"}</div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                            {inv.child_name && <span>For {inv.child_name}</span>}
                            {ev?.event_date && <span className="inline-flex items-center gap-1"><Calendar size={13} />{new Date(ev.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                            {ev?.location && <span className="inline-flex items-center gap-1"><MapPin size={13} />{ev.location}</span>}
                          </div>
                        </div>
                        <Button asChild className="bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold">
                          <Link to={`/book/${inv.token}`}>View &amp; book</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {bookings.length > 0 && (
            <div>
              <h3 className="font-display font-bold text-lg mb-3">Bookings</h3>
              <div className="space-y-3">
                {bookings.map((b) => {
                  const ev = events.get(b.event_id);
                  const qr = tickets.get(b.id);
                  const membership = memberships.get(b.id);
                  const isProgramme = ev?.programme_type === "monthly_programme";
                  return (
                    <Card
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenBookingId(b.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenBookingId(b.id); } }}
                      className="cursor-pointer transition-colors hover:border-lta-cyan/60 focus-visible:ring-2 focus-visible:ring-lta-cyan outline-none"
                    >
                      <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">{ev?.title ?? "Booking"} <span className="text-muted-foreground font-normal">— {b.child_name}</span></div>
                          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-3 mt-0.5">
                            <span>{gbp(b.amount_pence)}{isProgramme ? "/month" : ""}</span>
                            {isProgramme && membership && <span>{membership.months_paid}/{membership.months_total} months paid</span>}
                            {b.session_slot && <span>{b.session_slot}</span>}
                            {b.status === "paid"
                              ? <Badge className="bg-green-100 text-green-800" variant="outline">Paid</Badge>
                              : b.status === "payment_failed"
                                ? <Badge className="bg-red-100 text-red-800" variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Payment issue</Badge>
                                : <Badge variant="outline">{b.status}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {qr && b.status === "paid" && (
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/ticket/${qr}`}><Ticket className="w-4 h-4 mr-1" /> Ticket</Link>
                            </Button>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
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
    </motion.div>
  );
};

export default MyBookingsSection;
