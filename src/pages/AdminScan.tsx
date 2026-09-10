import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Camera } from "lucide-react";
import { FlowShell, EmptyState, SkeletonBlock } from "@/components/app";

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

type SessionOption = { id: string; label: string };

const AdminScan = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, canScan, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sessionId, setSessionId] = useState<string>("none");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastToken = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    // Today's sessions (and any one-off events today would just scan without a session).
    const today = new Date().toISOString().slice(0, 10);
    (supabase as any)
      .from("event_sessions")
      .select("id, session_date, start_time, events(title)")
      .gte("session_date", today)
      .order("session_date")
      .limit(20)
      .then(({ data }: any) => {
        if (data) {
          setSessions(
            data.map((s: any) => ({
              id: s.id,
              label: `${s.events?.title ?? "Session"} · ${new Date(s.session_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}${s.start_time ? ` ${s.start_time.slice(0, 5)}` : ""}`,
            })),
          );
        }
      });
  }, []);

  const submitToken = async (token: string) => {
    // Debounce the same code being decoded repeatedly by the camera.
    const now = Date.now();
    if (lastToken.current.token === token && now - lastToken.current.at < 5000) return;
    lastToken.current = { token, at: now };

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-ticket", {
        body: { qr_token: token, ...(sessionId !== "none" && { session_id: sessionId }) },
      });
      if (error && !data) throw new Error("Scan failed — check your connection");
      setResult(data as ScanResult);
      if (navigator.vibrate) navigator.vibrate(data?.ok ? 100 : [80, 60, 80]);
    } catch (e) {
      setResult({
        ok: false, result: "error",
        message: e instanceof Error ? e.message : "Scan failed",
        player: { child_name: null, parent_name: null, session_slot: null, has_medical_notes: false, event_title: null },
      });
    } finally {
      setBusy(false);
    }
  };

  const startScanner = async () => {
    setResult(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => submitToken(decoded.trim()),
        () => { /* per-frame decode misses are normal */ },
      );
    } catch {
      setScanning(false);
      setResult({
        ok: false, result: "error",
        message: "Camera unavailable — check permissions, or type the ticket code below.",
        player: { child_name: null, parent_name: null, session_slot: null, has_medical_notes: false, event_title: null },
      });
    }
  };

  const stopScanner = async () => {
    setScanning(false);
    try { await scannerRef.current?.stop(); scannerRef.current?.clear(); } catch { /* already stopped */ }
    scannerRef.current = null;
  };

  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

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
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger aria-label="Session"><SelectValue placeholder="Session (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No specific session (one-off event)</SelectItem>
            {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Result banner — big and glanceable for door duty */}
        {result && (
          <div
            role="status"
            aria-live="assertive"
            className={`rounded-2xl border p-5 text-center ${
              result.ok ? "border-emerald-200 bg-emerald-50"
              : result.result === "duplicate" ? "border-amber-200 bg-amber-50"
              : "border-red-200 bg-red-50"
            }`}
          >
            {result.ok
              ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" strokeWidth={1.8} />
              : result.result === "duplicate"
                ? <AlertTriangle className="mx-auto h-14 w-14 text-amber-600" strokeWidth={1.8} />
                : <XCircle className="mx-auto h-14 w-14 text-red-600" strokeWidth={1.8} />}
            <div className="mt-2 font-display text-2xl font-semibold leading-tight">{result.player.child_name ?? "Unknown ticket"}</div>
            <div className="mt-1 text-sm text-foreground/80">{result.message}</div>
            {result.player.event_title && <div className="mt-1 text-xs text-muted-foreground">{result.player.event_title}{result.player.session_slot ? ` · ${result.player.session_slot}` : ""}</div>}
            {result.player.has_medical_notes && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" /> Has medical notes — see admin
              </div>
            )}
          </div>
        )}

        <div id="qr-reader" className={`overflow-hidden rounded-2xl bg-black ${scanning ? "" : "hidden"}`} />

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
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="e.g. 3f9a…" inputMode="text" autoCapitalize="none" autoCorrect="off" onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) submitToken(manual.trim()); }} />
            <Button onClick={() => manual.trim() && submitToken(manual.trim())} disabled={busy || !manual.trim()}>Check</Button>
          </div>
        </div>
      </div>
    </FlowShell>
  );
};

export default AdminScan;
