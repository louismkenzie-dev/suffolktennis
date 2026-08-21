import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Ticket } from "lucide-react";
import logo from "@/assets/suffolk-tennis-logo-v7.png";

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

  return (
    <div className="min-h-screen bg-suffolk-navy text-primary-foreground">
      <header className="container mx-auto px-6 py-6">
        <Link to="/"><img src={logo} alt="Suffolk Tennis" className="h-12" /></Link>
      </header>
      <main className="container mx-auto px-6 pb-20 max-w-lg text-center">
        {cancelled ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mt-8">
            <XCircle className="w-12 h-12 text-lta-yellow mx-auto mb-4" />
            <h1 className="font-display text-2xl font-black">Payment cancelled</h1>
            <p className="text-primary-foreground/70 mt-2 text-sm">
              No payment was taken. Your invitation link still works — you can come back and book any time while places remain.
            </p>
          </div>
        ) : pending ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mt-8">
            <Loader2 className="w-12 h-12 text-lta-cyan mx-auto mb-4 animate-spin" />
            <h1 className="font-display text-2xl font-black">Confirming your payment…</h1>
            <p className="text-primary-foreground/70 mt-2 text-sm">This usually takes a few seconds.</p>
          </div>
        ) : paid ? (
          <div className="bg-lta-cyan/10 border border-lta-cyan/30 rounded-2xl p-8 mt-8">
            <CheckCircle2 className="w-12 h-12 text-lta-cyan mx-auto mb-4" />
            <h1 className="font-display text-2xl font-black">Booking confirmed!</h1>
            <p className="text-primary-foreground/80 mt-2">
              <strong>{status!.booking.child_name}</strong> is booked on <strong>{status!.event?.title}</strong>
              {status!.booking.session_slot ? ` (${status!.booking.session_slot})` : ""}.
            </p>
            {status!.ticket && (
              <Button asChild className="mt-6 bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold h-12 px-8">
                <Link to={`/ticket/${status!.ticket.qr_token}`}><Ticket className="w-4 h-4 mr-2" /> View entry ticket</Link>
              </Button>
            )}
            <p className="text-primary-foreground/60 text-xs mt-4">A confirmation with your ticket link has also been emailed to you.</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mt-8">
            <Loader2 className="w-12 h-12 text-lta-yellow mx-auto mb-4" />
            <h1 className="font-display text-2xl font-black">Payment received — confirmation on its way</h1>
            <p className="text-primary-foreground/70 mt-2 text-sm">
              Your payment is being processed. Your ticket will arrive by email shortly — no need to pay again.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default BookingReturn;
