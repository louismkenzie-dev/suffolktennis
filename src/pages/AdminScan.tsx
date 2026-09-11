import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Loader2, Camera } from "lucide-react";
import { FlowShell, EmptyState, InlineNote, SkeletonBlock } from "@/components/app";
import { ScanResultPanel, scanError, scanTicket, type ScanTicketResult } from "@/components/coach/ScanSheet";

const AdminScan = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, canScan, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanTicketResult | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Set when the camera is stopped, so a start() still in flight releases the
  // stream instead of leaving it live with no handle to stop it.
  const closedRef = useRef(false);
  const lastToken = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  /** Manual entry: check the code, then clear the box for the next child. */
  const check = async () => {
    const token = manual.trim();
    if (!token || busy) return;
    await submitToken(token);
    setManual("");
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
      // No session is sent: the code names its own, and this scanner is not
      // standing on any one register.
      const r = await scanTicket(token);
      setResult(r);
      if (navigator.vibrate) navigator.vibrate(r.ok ? 100 : [80, 60, 80]);
    } finally {
      setBusy(false);
    }
  };

  // html5-qrcode throws synchronously from stop() until start() has fully
  // settled, so every release goes through here — including the unmount one,
  // where an escaping throw would take the whole app to the error boundary.
  const release = async (scanner: Html5Qrcode | null) => {
    try { await scanner?.stop(); scanner?.clear(); } catch { /* never reached SCANNING */ }
  };

  const stopScanner = async () => {
    closedRef.current = true;
    setScanning(false);
    const scanner = scannerRef.current;
    scannerRef.current = null;
    await release(scanner);
  };

  const startScanner = async () => {
    setResult(null);
    setScanning(true);
    closedRef.current = false;
    lastToken.current = { token: "", at: 0 };
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => submitToken(decoded.trim(), true),
        () => { /* per-frame decode misses are normal */ },
      );
      // Stopped while the camera was still starting: the stream is live now,
      // so release it rather than leave it running with nothing holding it.
      if (closedRef.current || scannerRef.current !== scanner) await release(scanner);
    } catch {
      if (scannerRef.current === scanner) scannerRef.current = null;
      if (closedRef.current) return;
      setScanning(false);
      setResult(scanError("Camera unavailable — check permissions, or type the ticket code below."));
    }
  };

  useEffect(() => () => {
    closedRef.current = true;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    void release(scanner);
  }, []);

  if (authLoading || adminLoading) {
    return (
      <div className="app-shell min-h-screen bg-background">
        <div className="h-14 border-b border-border" />
        <div className="mx-auto max-w-md space-y-3 px-4 py-5"><SkeletonBlock className="h-11" /><SkeletonBlock className="h-64" /></div>
      </div>
    );
  }
  if (!canScan) {
    return (
      <div className="app-shell min-h-screen bg-background">
        <div className="mx-auto max-w-md px-6 py-24">
          <EmptyState icon={AlertTriangle} title="Staff access required" action={<Button asChild variant="outline"><Link to="/">Back to site</Link></Button>} />
        </div>
      </div>
    );
  }

  return (
    <FlowShell maxWidth="max-w-md" title="Ticket scanner" back={{ label: isAdmin ? "Admin" : "Register", to: isAdmin ? "/admin?tab=bookings" : "/coach" }}>
      <div className="space-y-4">
        <div id="qr-reader" className={`overflow-hidden rounded-2xl bg-black ${scanning ? "" : "hidden"}`} />

        {/* Mounted always, so the first scan is announced rather than inserted. */}
        <div role="status" aria-live="polite" aria-atomic="true">
          {result
            ? <ScanResultPanel result={result} />
            : <InlineNote tone="neutral">Each code names its own session, so there is nothing to choose — scan and the child is marked in on the right register.</InlineNote>}
        </div>

        {busy && <div className="flex justify-center py-2"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

        {!scanning ? (
          <Button onClick={startScanner} size="lg" className="h-14 w-full text-base">
            <Camera className="h-5 w-5" /> Start camera
          </Button>
        ) : (
          <Button onClick={stopScanner} variant="outline" size="lg" className="w-full">Stop camera</Button>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">No camera? Enter the ticket code</p>
          <div className="flex gap-2">
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="e.g. 3f9a…" inputMode="text" autoCapitalize="none" autoCorrect="off" onKeyDown={(e) => { if (e.key === "Enter" && !busy && manual.trim()) { void check(); } }} />
            <Button onClick={() => { void check(); }} disabled={busy || !manual.trim()}>Check</Button>
          </div>
        </div>
      </div>
    </FlowShell>
  );
};

export default AdminScan;
