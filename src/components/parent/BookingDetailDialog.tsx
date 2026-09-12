import { useEffect, useRef, useState } from "react";
import { formatTimeRange } from "@/lib/timeFormat";
import { venueLine, venueRuns, venueRunsSentence } from "@/lib/venueRuns";
import { Link } from "react-router-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { findVenueByLocation, googleMapsUrl } from "@/lib/venues";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Ticket, ExternalLink, ClipboardList, ChevronRight } from "lucide-react";
import { KeyValueList, ListGroup, ListRow, StatusBadge, bookingStatus } from "@/components/app";
import { isComplete, type Ratings } from "@/lib/lta";

const db = supabase as any;
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export type BookingDetail = {
  id: string; event_id: string; child_name: string; status: string;
  amount_pence: number; session_slot: string | null; paid_at: string | null;
};
export type EventDetail = {
  id: string; title: string; event_date: string | null; location: string | null;
  programme_type?: string | null; programme_months?: number | null; cancelled_at?: string | null;
};
export type MembershipDetail = {
  months_paid: number; months_total: number; status: string;
} | null;

type Session = { id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null; cancelled_at?: string | null; moved_from_date?: string | null };
// Only finished nine-area reports count; legacy four-star rows (empty
// `ratings`) are hidden from parents everywhere.
type CoachReport = { id: string; child_id: string | null; complete: boolean; sent_at: string | null; ratings: Ratings | null; created_at: string };

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const shortDate = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Small non-interactive venue map (MapLibre + OpenFreeMap, token-free). */
const VenueMap = ({ coords, name }: { coords: [number, number]; name: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map | null = null;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: coords,
        zoom: 13,
        interactive: false,
        attributionControl: { compact: true },
      });
      new maplibregl.Marker({ color: "#0a66b3" }).setLngLat(coords).addTo(map);
    } catch {
      // A failed map is cosmetic — the address text and maps link remain.
    }
    return () => { map?.remove(); };
  }, [coords[0], coords[1], name]);

  return <div ref={containerRef} className="h-40 w-full overflow-hidden rounded-xl border border-border bg-muted" aria-label={`Map showing ${name}`} />;
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{children}</p>
);

const BookingDetailDialog = ({ booking, event, membership, qrToken, open, onOpenChange }: {
  booking: BookingDetail | null;
  event: EventDetail | null;
  membership: MembershipDetail;
  qrToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reports, setReports] = useState<CoachReport[]>([]);
  const isProgramme = event?.programme_type === "programme";

  useEffect(() => {
    if (!open || !event) { setSessions([]); setReports([]); return; }
    // Guard against a slow query for one booking landing in a dialog opened for another.
    let cancelled = false;
    db.from("event_sessions")
      .select("id, session_date, start_time, end_time, venue, cancelled_at, moved_from_date")
      .eq("event_id", event.id)
      .order("session_date")
      .then(({ data }: { data: Session[] | null }) => { if (!cancelled) setSessions(data ?? []); });
    if (booking) {
      // Coach session reports — RLS limits this to the parent's own bookings;
      // only reports that have been sent to the parent count.
      db.from("session_reports")
        .select("id, child_id, complete, sent_at, ratings, created_at")
        .eq("booking_id", booking.id)
        .eq("complete", true)
        .not("sent_at", "is", null)
        .order("created_at", { ascending: false })
        .then(({ data }: { data: CoachReport[] | null }) => {
          if (!cancelled) setReports((data ?? []).filter((r) => r.complete && r.sent_at && isComplete(r.ratings)));
        });
    }
    return () => { cancelled = true; };
  }, [open, event?.id, booking?.id]);

  if (!booking) return null;

  const runs = venueRuns(sessions, event?.location ?? null);
  const venue = findVenueByLocation(runs[0]?.venue ?? event?.location ?? null);
  const locationText = venueLine(runs, event?.location ?? null);
  const venueSentence = venueRunsSentence(runs);
  const today = new Date().toISOString().slice(0, 10);
  const st = event?.cancelled_at ? { tone: "danger" as const, label: "Event cancelled" } : bookingStatus(booking.status);
  const upcomingSessions = sessions.filter((s) => s.session_date >= today);
  const pastSessions = sessions.filter((s) => s.session_date < today);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 md:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            {booking.paid_at && <span className="text-xs text-muted-foreground">paid {new Date(booking.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
          </div>
          <DialogTitle className="font-display text-xl">{event?.title ?? "Booking"}</DialogTitle>
          <DialogDescription>
            {booking.child_name} · {booking.amount_pence === 0 ? "No charge" : `${gbp(booking.amount_pence)}${isProgramme && membership ? "/month" : isProgramme ? " for the programme" : ""}`}
          </DialogDescription>
        </DialogHeader>

        {booking.status === "paid" && qrToken && !event?.cancelled_at && (
          <Button asChild size="lg" className="w-full">
            <Link to={`/ticket/${qrToken}`}><Ticket className="h-4 w-4" /> View entry ticket</Link>
          </Button>
        )}
        {event?.cancelled_at && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900">
            This event has been cancelled. Suffolk Tennis will be in touch about your place{booking.amount_pence > 0 ? " and payment" : ""}.
          </p>
        )}

        <div>
          <Label>Details</Label>
          <KeyValueList items={[
            { label: "Player", value: booking.child_name },
            { label: "Session", value: booking.session_slot, hidden: !booking.session_slot },
            { label: "Date", value: event?.event_date && !isProgramme ? new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : null, hidden: !event?.event_date || isProgramme },
            { label: "Monthly payments", value: membership ? <>{membership.months_paid} of {membership.months_total} paid{membership.status === "past_due" && <span className="text-destructive font-semibold"> · payment issue</span>}</> : null, hidden: !(isProgramme && membership) },
            { label: "Venue", value: locationText, hidden: !locationText },
          ]} />
        </div>

        {locationText && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Getting there</p>
              <a href={googleMapsUrl(runs[0]?.venue ?? locationText)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary">
                Directions <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            {venue ? <VenueMap coords={venue.coords} name={venue.name} /> : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {locationText}</p>
            )}
            {venueSentence && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{venueSentence}</p>}
          </div>
        )}

        {reports.length > 0 && (
          <div>
            <Label>Session reports</Label>
            <ListGroup>
              <ListRow
                size="sm"
                leading={<ClipboardList className="h-5 w-5 text-primary" strokeWidth={1.8} />}
                title="See session reports"
                subtitle={`${reports.length} ${reports.length === 1 ? "report" : "reports"} from the coach`}
                trailing={<ChevronRight className="h-4 w-4 text-muted-foreground/60" aria-hidden />}
                onClick={() => {
                  onOpenChange(false);
                  // The child's Reports view in the hub, or the report itself if the
                  // child record has gone. The hub only reads ?tab on mount and this
                  // dialog lives inside it, so switching tabs needs a full load.
                  const childId = reports.find((r) => r.child_id)?.child_id;
                  window.location.assign(childId ? `/parent-hub?tab=children&reports=${childId}` : `/report/${reports[0].id}`);
                }}
              />
            </ListGroup>
          </div>
        )}

        {sessions.length > 0 && (
          <div>
            <Label>{isProgramme ? `Programme sessions · ${sessions.length} included` : "Sessions"}</Label>
            <ListGroup>
              {[...upcomingSessions, ...pastSessions].map((s) => {
                const past = s.session_date < today;
                return (
                  <div key={s.id} className={`flex items-center justify-between gap-3 bg-card px-4 py-2.5 text-sm ${past ? "text-muted-foreground/60" : ""}`}>
                    <span className={s.cancelled_at ? "line-through" : ""}>
                      {shortDate(s.session_date)}
                      {s.start_time ? ` · ${formatTimeRange(s.start_time, s.end_time)}` : ""}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {s.cancelled_at ? <StatusBadge tone="danger" dot={false}>Cancelled</StatusBadge>
                        : s.moved_from_date ? <StatusBadge tone="warning" dot={false}>Moved</StatusBadge> : null}
                      <span className="max-w-[9rem] truncate">{s.venue ?? ""}</span>
                    </span>
                  </div>
                );
              })}
            </ListGroup>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;
