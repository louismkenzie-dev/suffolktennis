import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { findVenueByLocation, googleMapsUrl } from "@/lib/venues";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Ticket, ExternalLink, AlertCircle, RefreshCcw } from "lucide-react";

const db = supabase as any;
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export type BookingDetail = {
  id: string; event_id: string; child_name: string; status: string;
  amount_pence: number; session_slot: string | null; paid_at: string | null;
};
export type EventDetail = {
  id: string; title: string; event_date: string | null; location: string | null;
  programme_type?: string | null; programme_months?: number | null;
};
export type MembershipDetail = {
  months_paid: number; months_total: number; status: string;
} | null;

type Session = { id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null };

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;

const statusBadge = (status: string) => {
  if (status === "paid") return <Badge className="bg-green-100 text-green-800" variant="outline">Paid</Badge>;
  if (status === "payment_failed")
    return <Badge className="bg-red-100 text-red-800" variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Payment issue</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

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
      new maplibregl.Marker({ color: "#00a8e0" }).setLngLat(coords).addTo(map);
    } catch {
      // A failed map is cosmetic — the address text and maps link remain.
    }
    return () => { map?.remove(); };
  }, [coords[0], coords[1], name]);

  return <div ref={containerRef} className="h-44 w-full rounded-lg overflow-hidden border border-border" aria-label={`Map showing ${name}`} />;
};

const BookingDetailDialog = ({ booking, event, membership, qrToken, open, onOpenChange }: {
  booking: BookingDetail | null;
  event: EventDetail | null;
  membership: MembershipDetail;
  qrToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const isProgramme = event?.programme_type === "monthly_programme";

  useEffect(() => {
    if (!open || !event) { setSessions([]); return; }
    db.from("event_sessions")
      .select("id, session_date, start_time, end_time, venue")
      .eq("event_id", event.id)
      .order("session_date")
      .then(({ data }: { data: Session[] | null }) => setSessions(data ?? []));
  }, [open, event?.id]);

  if (!booking) return null;

  const venue = findVenueByLocation(event?.location ?? sessions[0]?.venue ?? null);
  const locationText = event?.location ?? sessions[0]?.venue ?? null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display pr-6">{event?.title ?? "Booking"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(booking.status)}
            <span className="text-muted-foreground">
              {gbp(booking.amount_pence)}{isProgramme ? "/month" : ""}
            </span>
            {booking.paid_at && (
              <span className="text-muted-foreground">
                · paid {new Date(booking.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Player</span><strong>{booking.child_name}</strong></div>
            {booking.session_slot && (
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Session</span><span>{booking.session_slot}</span></div>
            )}
            {event?.event_date && (
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Date</span>
                <span className="inline-flex items-center gap-1"><Calendar size={13} />
                  {new Date(event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            )}
            {isProgramme && membership && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground inline-flex items-center gap-1"><RefreshCcw size={13} /> Monthly payments</span>
                <span>
                  {membership.months_paid} of {membership.months_total} paid
                  {membership.status === "past_due" && <span className="text-red-600 font-semibold"> · payment issue</span>}
                </span>
              </div>
            )}
          </div>

          {booking.status === "paid" && qrToken && (
            <Button asChild className="w-full bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold">
              <Link to={`/ticket/${qrToken}`}><Ticket className="w-4 h-4 mr-2" /> View entry ticket (QR)</Link>
            </Button>
          )}

          {locationText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold inline-flex items-center gap-1.5"><MapPin size={14} className="text-lta-cyan" /> {locationText}</span>
                <a href={googleMapsUrl(locationText)} target="_blank" rel="noreferrer"
                   className="text-xs text-lta-cyan hover:underline inline-flex items-center gap-1 shrink-0">
                  Directions <ExternalLink size={11} />
                </a>
              </div>
              {venue && <VenueMap coords={venue.coords} name={venue.name} />}
            </div>
          )}

          {sessions.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">
                {isProgramme ? `Programme sessions (${sessions.length}) — all included` : "Sessions"}
              </h4>
              <ul className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {sessions.map((s) => {
                  const past = s.session_date < today;
                  return (
                    <li key={s.id} className={`flex justify-between gap-3 rounded px-2 py-1 ${past ? "text-muted-foreground/60" : "bg-muted/40"}`}>
                      <span>
                        {new Date(s.session_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        {s.start_time ? ` · ${s.start_time.slice(0, 5)}${s.end_time ? `–${s.end_time.slice(0, 5)}` : ""}` : ""}
                      </span>
                      <span className="text-muted-foreground truncate">{s.venue ?? ""}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;
