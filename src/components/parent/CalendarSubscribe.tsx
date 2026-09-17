import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPABASE_URL } from "@/integrations/supabase/client";

/**
 * A live calendar subscription for one booking.
 *
 * "Add to Google / Outlook" copies a single session into a diary and then
 * knows nothing more — a session that later moves stays wrong, and an
 * eleven-date programme means eleven taps. A subscription is one link the
 * calendar re-reads on its own, so a moved or cancelled session follows.
 *
 * The feed is served by the calendar-feed edge function and authorised by the
 * same qr_token as the ticket page, which is why the link is worth no less
 * care than the ticket link itself.
 */
const CalendarSubscribe = ({ qrToken, sessionCount }: { qrToken: string; sessionCount?: number }) => {
  const [copied, setCopied] = useState(false);
  const base = `${SUPABASE_URL.replace(/^https?:\/\//, "")}/functions/v1/calendar-feed?t=${qrToken}`;
  const httpsUrl = `https://${base}`;
  // webcal:// is what hands the link straight to the calendar app on iPhone,
  // Mac and Outlook; Google on a computer wants the https form pasted in.
  const webcalUrl = `webcal://${base}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success("Calendar link copied", {
        description: "In Google Calendar choose Other calendars → From URL, and paste it there.",
      });
    } catch {
      toast.message("Calendar link", { description: httpsUrl, duration: 20000 });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Subscribe to these sessions</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Adds {sessionCount && sessionCount > 1 ? `all ${sessionCount} dates` : "the dates"} to your calendar and keeps
            them up to date — if a session moves or is cancelled, your calendar follows.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button asChild className="flex-1">
          <a href={webcalUrl}>Add to my calendar</a>
        </Button>
        <Button variant="outline" onClick={copy} className="flex-1">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        On an iPhone, iPad or Mac, and in Outlook, “Add to my calendar” is all you need. In Google Calendar on a
        computer, copy the link and use <span className="whitespace-nowrap">Other calendars → From URL</span>.
      </p>
    </div>
  );
};

export default CalendarSubscribe;
