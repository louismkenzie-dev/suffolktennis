// The register's QR scanner, in a bottom sheet so the list stays underneath
// and fills in as each child is scanned. A ticket names its own session, so a
// scan can land on a different register than the one that is open — this sheet
// says so rather than pretending the list below changed.
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Loader2, XCircle, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineNote, StatusBadge } from "@/components/app";
import { formatTimeRange } from "@/lib/timeFormat";
import { cn } from "@/lib/utils";
import { fmtDay } from "./time";

/** The `scan-ticket` reply — docs/SESSION-TICKETS-SPEC.md. Every outcome is a 200. */
export type ScanTicketResult = {
  ok: boolean;
  result: string;
  message: string;
  player: {
    child_name: string | null;
    parent_name: string | null;
    session_slot: string | null;
    has_medical_notes: boolean;
    event_title: string | null;
    age_group: string | null;
    medical_notes: string | null;
  };
  session: { id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null } | null;
  event: { id: string; title: string } | null;
  booking_id: string | null;
  resolved_from: "qr" | "clock" | "hint" | null;
};

const NO_PLAYER: ScanTicketResult["player"] = {
  child_name: null, parent_name: null, session_slot: null,
  has_medical_notes: false, event_title: null, age_group: null, medical_notes: null,
};

/** A failure of the scanner itself (camera, network) wears the same panel. */
export function scanError(message: string): ScanTicketResult {
  return { ok: false, result: "error", message, player: NO_PLAYER, session: null, event: null, booking_id: null, resolved_from: null };
}

/**
 * POST `scan-ticket`. The token carries the session; `hintSessionId` is only
 * the fallback the function uses for a legacy season ticket when no session of
 * that programme is running. A thrown error means the call itself failed, so it
 * comes back as a result panel rather than as silence at the gate.
 */
export async function scanTicket(qrToken: string, hintSessionId?: string): Promise<ScanTicketResult> {
  try {
    const { data, error } = await supabase.functions.invoke("scan-ticket", {
      body: { qr_token: qrToken, ...(hintSessionId && { session_id: hintSessionId }) },
    });
    if (error && !data) {
      // A non-2xx reply still carries a JSON body worth showing (e.g. a code that is too short).
      let message = "Scan failed — check your connection";
      if (error instanceof FunctionsHttpError) {
        const parsed = await error.context.json().catch(() => null);
        if (parsed?.message) message = String(parsed.message);
        else if (parsed?.error) message = String(parsed.error);
      }
      return scanError(message);
    }
    return data as ScanTicketResult;
  } catch (e) {
    return scanError(e instanceof Error ? e.message : "Scan failed");
  }
}

type Tone = "success" | "warning" | "danger";

const PANEL: Record<Tone, { box: string; icon: string; Icon: LucideIcon }> = {
  success: { box: "border-emerald-200 bg-emerald-50", icon: "text-emerald-600", Icon: CheckCircle2 },
  warning: { box: "border-amber-200 bg-amber-50", icon: "text-amber-600", Icon: AlertTriangle },
  danger: { box: "border-red-200 bg-red-50", icon: "text-red-600", Icon: XCircle },
};

/** Headline and what to do next — the function's `message` says what happened. */
function present(r: ScanTicketResult): { tone: Tone; heading: string; advice?: string } {
  const name = r.player.child_name;
  switch (r.result) {
    case "admitted":
      return { tone: "success", heading: name ?? "Admitted" };
    case "duplicate":
      return { tone: "warning", heading: name ? `Already scanned — ${name}` : "Already scanned", advice: "Their arrival time stays as it was." };
    case "no_session":
      return {
        tone: "warning",
        heading: name ? `No session now — ${name}` : "No session running",
        advice: `This is a season ticket and no session of ${r.event?.title ?? "that programme"} is running now. If they are booked on today, let them on and mark them in by hand on that programme's register — otherwise send them to an admin.`,
      };
    case "wrong_session":
      return {
        tone: "warning",
        heading: name ? `Wrong session — ${name}` : "Wrong session",
        advice: "That code is for another date. Ask the parent for today's reminder email, or mark them in by hand.",
      };
    case "forbidden":
      return { tone: "danger", heading: "Not your programme", advice: "Ask an admin to add you to it, or scan from a register you coach." };
    case "rejected_void":
      return { tone: "danger", heading: name ? `Cancelled ticket — ${name}` : "Cancelled ticket", advice: "Do not let them on court — send them to an admin." };
    case "rejected_unpaid":
      return { tone: "danger", heading: name ? `Not paid — ${name}` : "Not paid", advice: "Do not let them on court — send them to an admin to settle the booking." };
    case "unknown":
      return { tone: "danger", heading: "Unknown code", advice: "Ask the parent to open the link in their session reminder email." };
    default:
      return { tone: "danger", heading: "Scanner", advice: "Try again, or type the code in below." };
  }
}

/** "Sat 12 Sep, 2–4pm · Culford" — the session the scan was recorded against. */
function sessionWhen(session: ScanTicketResult["session"]): string {
  if (!session) return "";
  const time = formatTimeRange(session.start_time, session.end_time);
  return [[fmtDay(session.session_date), time].filter(Boolean).join(", "), session.venue].filter(Boolean).join(" · ");
}

function sessionLine(r: ScanTicketResult): string {
  const when = sessionWhen(r.session);
  if (!when) return "";
  if (r.result === "admitted") return `Marked arrived · ${when}`;
  if (r.result === "duplicate") return `Already on the register · ${when}`;
  return when;
}

/** The big glanceable answer, shared by the register sheet and the admin scanner. */
export function ScanResultPanel({ result, compact = false, className, tone: toneOverride, heading: headingOverride, message: messageOverride, advice: adviceOverride }: {
  result: ScanTicketResult;
  /** Tighter type and icon for the register sheet, where the list matters too. */
  compact?: boolean;
  className?: string;
  /** A scan that admitted elsewhere is not a green answer on this register. */
  tone?: Tone;
  heading?: string;
  message?: string;
  advice?: string;
}) {
  const presented = present(result);
  const tone = toneOverride ?? presented.tone;
  const heading = headingOverride ?? presented.heading;
  const message = messageOverride ?? result.message;
  const advice = adviceOverride ?? presented.advice;
  const { box, icon, Icon } = PANEL[tone];
  const where = sessionLine(result);
  const title = result.event?.title ?? result.player.event_title;
  const medical = result.player.medical_notes;

  return (
    <div className={cn("rounded-2xl border text-center", box, compact ? "p-4" : "p-5", className)}>
      <Icon className={cn("mx-auto", icon, compact ? "h-10 w-10" : "h-14 w-14")} strokeWidth={1.8} />
      <div className={cn("font-display font-semibold leading-tight", compact ? "mt-1.5 text-xl" : "mt-2 text-2xl")}>{heading}</div>
      <div className="mt-0.5 text-sm text-foreground/80">{message}</div>
      {where && <div className="mt-1 text-[13px] font-medium text-foreground/75">{where}</div>}
      {title && <div className="mt-0.5 text-xs text-muted-foreground">{title}{result.player.session_slot ? ` · ${result.player.session_slot}` : ""}</div>}

      {(result.player.age_group || result.player.has_medical_notes || medical) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {result.player.age_group && <StatusBadge tone="neutral" dot={false}>{result.player.age_group}</StatusBadge>}
          {(result.player.has_medical_notes || medical) && <StatusBadge tone="warning">Medical notes</StatusBadge>}
        </div>
      )}
      {medical && <p className="mt-1.5 text-xs leading-snug text-amber-900">{medical}</p>}

      {advice && <p className={cn("text-xs text-muted-foreground", compact ? "mt-2" : "mt-2.5")}>{advice}</p>}
    </div>
  );
}

const READER_ID = "coach-register-qr-reader";

export function ScanSheet({ open, onOpenChange, sessionId, eventId, label, onScanned }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The open register's session. Sent only as `scan-ticket`'s fallback hint —
   * the code names the session — and used to tell a scan that belongs here
   * from one that belongs to another register. Omitted for session-less events.
   */
  sessionId?: string;
  /** The register's event, so a session-less scan from another event is spotted too. */
  eventId?: string | null;
  label: string;
  /** Called only after a scan that landed on this register, so the list refreshes at once. */
  onScanned: () => void;
}) {
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanTicketResult | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Set when the sheet closes or Stop is tapped, so a start() still in
  // flight releases the camera instead of leaving it on with no handle.
  const closedRef = useRef(false);
  const lastToken = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  const landedHere = (r: ScanTicketResult) =>
    (sessionId ? r.session?.id === sessionId : !r.session) && (!eventId || !r.event || r.event.id === eventId);

  /** Where an admitted scan actually went, when that is not this register. */
  const strayNote = (r: ScanTicketResult): string | null => {
    if (r.result !== "admitted" && r.result !== "duplicate") return null;
    if (landedHere(r)) return null;
    const when = r.session ? sessionWhen(r.session) : r.event?.title ?? "a different session";
    return `Scanned into ${when} — not this register. They are marked in there, not here; if they should be on this court, mark them in by hand.`;
  };

  /**
   * `fromCamera` scans are debounced because the decoder fires many times a
   * second on one code; a tap on Check is a deliberate act and always runs.
   */
  const submitToken = async (token: string, fromCamera = false) => {
    const now = Date.now();
    if (fromCamera) {
      if (lastToken.current.token === token && now - lastToken.current.at < 5000) return;
      lastToken.current = { token, at: now };
    }

    // The last child's verdict must not sit under the next child's spinner.
    setResult(null);
    setBusy(true);
    try {
      const r = await scanTicket(token, sessionId);
      setResult(r);
      if (navigator.vibrate) navigator.vibrate(r.ok ? 100 : [80, 60, 80]);
      // A scan on another session changed another register, not this one.
      if ((r.ok || r.result === "duplicate") && landedHere(r)) onScanned();
    } finally {
      setBusy(false);
    }
  };

  const release = async (scanner: Html5Qrcode | null) => {
    try { await scanner?.stop(); scanner?.clear(); } catch { /* already stopped */ }
  };

  const stopScanner = async () => {
    closedRef.current = true;
    setCameraOn(false);
    const scanner = scannerRef.current;
    scannerRef.current = null;
    await release(scanner);
  };

  const startScanner = async () => {
    setResult(null);
    setCameraOn(true);
    closedRef.current = false;
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 220, height: 220 } },
        (decoded) => submitToken(decoded.trim(), true),
        () => { /* per-frame decode misses are normal */ },
      );
      // Closed (or stopped) while the camera was still starting: the stream
      // is live now, so release it rather than leave it running.
      if (closedRef.current || scannerRef.current !== scanner) await release(scanner);
    } catch {
      if (scannerRef.current === scanner) scannerRef.current = null;
      if (closedRef.current) return;
      setCameraOn(false);
      setResult(scanError("Camera unavailable — check permissions, or type the ticket code below."));
    }
  };

  // Start the camera as the sheet opens (once the reader div is on screen)
  // and always release it when the sheet closes or unmounts.
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setManual("");
    // A fresh sheet is a fresh scan session: the same code scanned again here
    // must not be swallowed by the previous session's debounce.
    lastToken.current = { token: "", at: 0 };
    const t = window.setTimeout(() => { void startScanner(); }, 250);
    return () => {
      window.clearTimeout(t);
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stray = result ? strayNote(result) : null;

  /** Manual entry: check the code, then clear the box for the next child. */
  const check = async () => {
    const token = manual.trim();
    if (!token || busy) return;
    await submitToken(token);
    setManual("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Scan tickets</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>

        {/* Mounted whether or not there is a result, so the first scan of a
            session is announced rather than silently inserted. */}
        <div role="status" aria-live="polite" aria-atomic="true">
          {result && (
            <ScanResultPanel
              result={result}
              compact
              // A code that admitted somewhere else must not read as a green
              // "welcome" on this register — one verdict, one tone.
              tone={stray ? "warning" : undefined}
              heading={stray ? (result.player.child_name ? `Not this register — ${result.player.child_name}` : "Not this register") : undefined}
              message={stray ? "Their code is for another session." : undefined}
              advice={stray ?? undefined}
            />
          )}
        </div>

        <div id={READER_ID} className={`overflow-hidden rounded-2xl bg-black ${cameraOn ? "" : "hidden"}`} />

        {busy && <div className="flex justify-center py-1"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

        {!cameraOn ? (
          <Button onClick={startScanner} size="lg" className="w-full">Start camera</Button>
        ) : (
          <Button onClick={stopScanner} variant="outline" size="lg" className="w-full">Stop camera</Button>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">No camera? Enter the ticket code</p>
          <div className="flex gap-2">
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="e.g. 3f9a…"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              onKeyDown={(e) => { if (e.key === "Enter" && !busy && manual.trim()) { void check(); } }}
            />
            <Button onClick={() => { void check(); }} disabled={busy || !manual.trim()}>Check</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
