import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CalendarPlus } from "lucide-react";
import { calendarLinks, formatTimeRange } from "@/lib/timeFormat";
import { FlowShell, KeyValueList, StatusBadge, SkeletonBlock, EmptyState } from "@/components/app";

type TicketData = {
  booking: { status: string; child_name: string; parent_name: string; session_slot: string | null };
  event: { title: string; location: string | null; event_date: string | null; cancelled_at?: string | null } | null;
  upcoming_sessions: Array<{ session_date: string; start_time: string | null; end_time: string | null; venue: string | null; moved_from_date?: string | null }>;
  ticket: { qr_token: string; status: string } | null;
};

/** "Add to calendar" for one session — Google and Outlook web links. */
const CalLinks = ({ title, date, start, end, location, details }: {
  title: string; date: string; start: string | null; end: string | null; location: string | null; details: string;
}) => {
  const c = calendarLinks({ title, date, start, end, location, details });
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs">
      <a href={c.google} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center rounded-md px-1.5 font-medium text-primary hover:bg-primary/10">Google</a>
      <a href={c.outlook} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center rounded-md px-1.5 font-medium text-primary hover:bg-primary/10">Outlook</a>
    </span>
  );
};

const TicketPage = () => {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [data, setData] = useState<TicketData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!qrToken) return;
    supabase.functions
      .invoke("get-booking-status", { body: { qr_token: qrToken } })
      .then(({ data, error }) => {
        if (error || data?.error) setError(data?.error || "Ticket not found");
        else setData(data as TicketData);
      })
      .catch(() => setError("Could not load the ticket"));
  }, [qrToken]);

  const valid = !!data?.ticket && data.booking.status === "paid" && data.ticket.status === "active";

  return (
    <FlowShell maxWidth="max-w-md" back={{ label: "My bookings", to: "/parent-hub?tab=bookings" }}>
      {error ? (
        <EmptyState icon={AlertCircle} title="Ticket not found" description={error} />
      ) : !data ? (
        <div className="space-y-3" aria-busy><SkeletonBlock className="h-[26rem]" /></div>
      ) : (
        <div className="space-y-4">
          {/* The ticket itself — high contrast, QR first, nothing else competing. */}
          <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
            <div className="bg-suffolk-navy px-5 pb-5 pt-5 text-primary-foreground">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lta-cyan">Suffolk Tennis · Entry ticket</p>
              <h1 className="mt-1 font-display text-xl font-semibold leading-tight md:text-2xl">{data.event?.title}</h1>
              {data.event?.location && <p className="mt-0.5 text-sm text-primary-foreground/70">{data.event.location}</p>}
            </div>
            <div className="relative flex flex-col items-center bg-white px-6 pb-6 pt-7">
              {/* perforation */}
              <span aria-hidden className="absolute -left-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full border border-border bg-background" />
              <span aria-hidden className="absolute -right-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full border border-border bg-background" />
              {valid ? (
                <>
                  <QRCodeSVG value={data.ticket!.qr_token} size={224} level="M" includeMargin={false} />
                  <p className="mt-4 text-center text-xs text-muted-foreground">Show this code to be scanned on arrival</p>
                </>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle className="h-6 w-6" /></div>
                  <p className="font-semibold text-foreground">{data.booking.status === "paid" ? "Ticket cancelled" : "Awaiting payment"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Please contact Suffolk Tennis if this looks wrong.</p>
                </div>
              )}
            </div>
            <div className="border-t border-dashed border-border px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Player</p>
                  <p className="text-lg font-semibold leading-tight">{data.booking.child_name}</p>
                </div>
                <StatusBadge tone={valid ? "success" : "danger"}>{valid ? "Valid" : data.booking.status === "paid" ? "Cancelled" : "Unpaid"}</StatusBadge>
              </div>
            </div>
          </article>

          {data.event?.cancelled_at && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900">
              This event has been cancelled — Suffolk Tennis will be in touch.
            </p>
          )}

          <KeyValueList items={[
            { label: "Booked by", value: data.booking.parent_name },
            { label: "Session", value: data.booking.session_slot, hidden: !data.booking.session_slot },
            { label: "Date", value: data.event?.event_date ? new Date(data.event.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : null, hidden: !data.event?.event_date || data.upcoming_sessions.length > 0 },
          ]} />

          {data.upcoming_sessions.length > 0 && (
            <div>
              <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Upcoming sessions</p>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {data.upcoming_sessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {new Date(s.session_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        {s.start_time ? ` · ${formatTimeRange(s.start_time, s.end_time)}` : ""}
                        {s.moved_from_date ? <StatusBadge tone="warning" dot={false} className="ml-2">Moved</StatusBadge> : null}
                      </p>
                      {s.venue && <p className="truncate text-xs text-muted-foreground">{s.venue}</p>}
                    </div>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CalendarPlus className="h-4 w-4" aria-hidden />
                      <CalLinks
                        title={data.event?.title ?? "Suffolk Tennis"}
                        date={s.session_date} start={s.start_time} end={s.end_time}
                        location={s.venue ?? data.event?.location ?? null}
                        details={`${data.booking.child_name} — Suffolk Tennis. Entry ticket: ${window.location.href}`}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </FlowShell>
  );
};

export default TicketPage;
