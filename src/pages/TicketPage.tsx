import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import logo from "@/assets/suffolk-tennis-logo-v7.png";

type TicketData = {
  booking: { status: string; child_name: string; parent_name: string; session_slot: string | null };
  event: { title: string; location: string | null; event_date: string | null } | null;
  upcoming_sessions: Array<{ session_date: string; start_time: string | null; venue: string | null }>;
  ticket: { qr_token: string; status: string } | null;
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

  return (
    <div className="min-h-screen bg-suffolk-navy text-primary-foreground">
      <header className="container mx-auto px-6 py-6">
        <Link to="/"><img src={logo} alt="Suffolk Tennis" className="h-12" /></Link>
      </header>
      <main className="container mx-auto px-6 pb-20 max-w-md">
        {error ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center mt-8">
            <AlertCircle className="w-10 h-10 text-lta-yellow mx-auto mb-4" />
            <p>{error}</p>
          </div>
        ) : !data ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-lta-cyan" /></div>
        ) : (
          <div className="mt-4 rounded-3xl overflow-hidden border border-white/10">
            <div className="bg-lta-cyan text-suffolk-navy p-5 text-center">
              <div className="text-[11px] font-black uppercase tracking-widest">Suffolk Tennis · Entry Ticket</div>
              <h1 className="font-display text-2xl font-black mt-1">{data.event?.title}</h1>
              {data.event?.location && <div className="text-sm font-semibold mt-0.5">{data.event.location}</div>}
            </div>
            <div className="bg-white p-8 flex flex-col items-center">
              {data.ticket && data.booking.status === "paid" && data.ticket.status === "active" ? (
                <>
                  <QRCodeSVG value={data.ticket.qr_token} size={220} level="M" includeMargin />
                  <p className="text-suffolk-navy/60 text-xs mt-3 text-center">Show this code to be scanned on arrival</p>
                </>
              ) : (
                <div className="text-center py-10">
                  <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                  <p className="text-suffolk-navy font-bold">
                    {data.booking.status === "paid" ? "Ticket cancelled" : "Awaiting payment"}
                  </p>
                  <p className="text-suffolk-navy/60 text-sm mt-1">Please contact Suffolk Tennis if this looks wrong.</p>
                </div>
              )}
            </div>
            <div className="bg-white/5 p-5 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-primary-foreground/60">Player</span><strong>{data.booking.child_name}</strong></div>
              <div className="flex justify-between"><span className="text-primary-foreground/60">Booked by</span><span>{data.booking.parent_name}</span></div>
              {data.booking.session_slot && (
                <div className="flex justify-between"><span className="text-primary-foreground/60">Session</span><span>{data.booking.session_slot}</span></div>
              )}
              {data.event?.event_date && (
                <div className="flex justify-between"><span className="text-primary-foreground/60">Date</span>
                  <span>{new Date(data.event.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
              {data.upcoming_sessions.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-primary-foreground/60 mb-1">Upcoming sessions</div>
                  {data.upcoming_sessions.map((s, i) => (
                    <div key={i} className="text-primary-foreground/85">
                      {new Date(s.session_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      {s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ""}{s.venue ? ` · ${s.venue}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TicketPage;
