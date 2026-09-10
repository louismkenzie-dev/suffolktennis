import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Ticket, Clock } from "lucide-react";
import { FlowShell } from "@/components/app";

type Status = {
  booking: { status: string; child_name: string; session_slot: string | null };
  event: { title: string; location: string | null } | null;
  ticket: { qr_token: string } | null;
};

const BookingReturn = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id"); // legacy hosted-checkout returns
  const bookingId = params.get("booking_id");
  const cancelled = params.get("cancelled");
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId && !bookingId) return;
    let stopped = false;
    const poll = async () => {
      attempts.current += 1;
      const { data, error } = await supabase.functions.invoke("get-booking-status", {
        body: bookingId ? { booking_id: bookingId } : { session_id: sessionId },
      });
      if (stopped) return;
      if (!error && data && !data.error) {
        setStatus(data as Status);
        if (data.booking?.status === "paid") return; // done
      }
      // The webhook can lag a few seconds behind the redirect.
      if (attempts.current < 10) setTimeout(poll, 2500);
      else setFailed(true);
    };
    poll();
    return () => { stopped = true; };
  }, [sessionId, bookingId]);

  const paid = status?.booking?.status === "paid";
  const pending = !paid && !failed && !cancelled;

  const Panel = ({ icon, tone, title, children }: { icon: React.ReactNode; tone: string; title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card md:p-8">
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${tone}`}>{icon}</div>
      <h1 className="font-display text-2xl font-semibold leading-tight">{title}</h1>
      <div className="mt-2 space-y-4 text-sm text-muted-foreground">{children}</div>
    </div>
  );

  return (
    <FlowShell maxWidth="max-w-lg" back={{ label: "My bookings", to: "/parent-hub?tab=bookings" }}>
      <div className="pt-2 md:pt-6">
        {cancelled ? (
          <Panel icon={<XCircle className="h-8 w-8" strokeWidth={1.8} />} tone="bg-amber-50 text-amber-700" title="Payment cancelled">
            <p>No payment was taken. Your invitation link still works — you can come back and book any time while places remain.</p>
            <Button asChild variant="outline"><Link to="/parent-hub?tab=bookings">Back to my bookings</Link></Button>
          </Panel>
        ) : pending ? (
          <Panel icon={<Loader2 className="h-8 w-8 animate-spin" />} tone="bg-primary/10 text-primary" title="Confirming your payment…">
            <p>This usually takes a few seconds. Please keep this page open.</p>
          </Panel>
        ) : paid ? (
          <Panel icon={<CheckCircle2 className="h-8 w-8" strokeWidth={1.8} />} tone="bg-emerald-50 text-emerald-700" title="Booking confirmed">
            <p className="text-base text-foreground">
              <strong>{status!.booking.child_name}</strong> is booked on <strong>{status!.event?.title}</strong>
              {status!.booking.session_slot ? ` (${status!.booking.session_slot})` : ""}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {status!.ticket && (
                <Button asChild size="lg">
                  <Link to={`/ticket/${status!.ticket.qr_token}`}><Ticket className="w-4 h-4" /> View entry ticket</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/parent-hub?tab=bookings">My bookings</Link>
              </Button>
            </div>
            <p className="text-xs">A confirmation with your ticket link has also been emailed to you.</p>
          </Panel>
        ) : (
          <Panel icon={<Clock className="h-8 w-8" strokeWidth={1.8} />} tone="bg-amber-50 text-amber-700" title="Payment received — confirmation on its way">
            <p>Your payment is being processed. Your ticket will arrive by email shortly — no need to pay again.</p>
            <Button asChild variant="outline"><Link to="/parent-hub?tab=bookings">My bookings</Link></Button>
          </Panel>
        )}
      </div>
    </FlowShell>
  );
};

export default BookingReturn;
