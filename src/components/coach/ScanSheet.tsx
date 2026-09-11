// The register's QR scanner, in a bottom sheet so the list stays underneath
// and fills in as each child is scanned. Same camera code as AdminScan; the
// session is pre-selected so a scan lands on this register's attendance.
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ScanResult = {
  ok: boolean;
  result: string;
  message: string;
  player: {
    child_name: string | null;
    parent_name: string | null;
    session_slot: string | null;
    has_medical_notes: boolean;
    event_title: string | null;
  };
};

const NO_PLAYER: ScanResult["player"] = { child_name: null, parent_name: null, session_slot: null, has_medical_notes: false, event_title: null };
const READER_ID = "coach-register-qr-reader";

export function ScanSheet({ open, onOpenChange, sessionId, label, onScanned }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omitted for session-less events — scan-ticket then records against the booking alone. */
  sessionId?: string;
  label: string;
  /** Called after any scan that changed or confirmed attendance, so the register refreshes at once. */
  onScanned: () => void;
}) {
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Set when the sheet closes or Stop is tapped, so a start() still in
  // flight releases the camera instead of leaving it on with no handle.
  const closedRef = useRef(false);
  const lastToken = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  const submitToken = async (token: string) => {
    // The camera decodes the same code many times a second — one post per 5s.
    const now = Date.now();
    if (lastToken.current.token === token && now - lastToken.current.at < 5000) return;
    lastToken.current = { token, at: now };

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-ticket", {
        body: { qr_token: token, ...(sessionId && { session_id: sessionId }) },
      });
      if (error && !data) {
        // A non-2xx reply still carries a JSON body worth showing (e.g. a code that is too short).
        let message = "Scan failed — check your connection";
        if (error instanceof FunctionsHttpError) {
          const parsed = await error.context.json().catch(() => null);
          if (parsed?.message) message = String(parsed.message);
          else if (parsed?.error) message = String(parsed.error);
        }
        throw new Error(message);
      }
      const r = data as ScanResult;
      setResult(r);
      if (navigator.vibrate) navigator.vibrate(r?.ok ? 100 : [80, 60, 80]);
      if (r?.ok || r?.result === "duplicate") onScanned();
    } catch (e) {
      setResult({ ok: false, result: "error", message: e instanceof Error ? e.message : "Scan failed", player: NO_PLAYER });
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
        (decoded) => submitToken(decoded.trim()),
        () => { /* per-frame decode misses are normal */ },
      );
      // Closed (or stopped) while the camera was still starting: the stream
      // is live now, so release it rather than leave it running.
      if (closedRef.current || scannerRef.current !== scanner) await release(scanner);
    } catch {
      if (scannerRef.current === scanner) scannerRef.current = null;
      if (closedRef.current) return;
      setCameraOn(false);
      setResult({ ok: false, result: "error", message: "Camera unavailable — check permissions, or type the ticket code below.", player: NO_PLAYER });
    }
  };

  // Start the camera as the sheet opens (once the reader div is on screen)
  // and always release it when the sheet closes or unmounts.
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setManual("");
    const t = window.setTimeout(() => { void startScanner(); }, 250);
    return () => {
      window.clearTimeout(t);
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Scan tickets</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>

        {result && (
          <div
            role="status"
            aria-live="assertive"
            className={`rounded-2xl border p-4 text-center ${
              result.ok ? "border-emerald-200 bg-emerald-50"
              : result.result === "duplicate" ? "border-amber-200 bg-amber-50"
              : "border-red-200 bg-red-50"
            }`}
          >
            {result.ok
              ? <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" strokeWidth={1.8} />
              : result.result === "duplicate"
                ? <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" strokeWidth={1.8} />
                : <XCircle className="mx-auto h-10 w-10 text-red-600" strokeWidth={1.8} />}
            <div className="mt-1.5 font-display text-xl font-semibold leading-tight">
              {result.player.child_name ?? (result.result === "error" ? "Scanner" : result.result === "forbidden" || result.result === "wrong_event" ? "Not this register" : "Unknown ticket")}
            </div>
            <div className="mt-0.5 text-sm text-foreground/80">{result.message}</div>
            {result.player.has_medical_notes && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" /> Has medical notes — see their profile
              </div>
            )}
          </div>
        )}

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
              onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) submitToken(manual.trim()); }}
            />
            <Button onClick={() => manual.trim() && submitToken(manual.trim())} disabled={busy || !manual.trim()}>Check</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
