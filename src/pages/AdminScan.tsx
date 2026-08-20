import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Loader2, Camera } from "lucide-react";

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
  const { isAdmin, loading: adminLoading } = useIsAdmin();
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
    return <div className="min-h-screen bg-suffolk-navy flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-lta-cyan" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-suffolk-navy text-primary-foreground flex flex-col items-center justify-center gap-4">
        <p>Admin access required.</p>
        <Button asChild variant="outline"><Link to="/">Back to site</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-suffolk-navy text-primary-foreground">
      <div className="container mx-auto px-4 py-4 max-w-md">
        <div className="flex items-center justify-between mb-4">
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground/70">
            <Link to="/admin"><ArrowLeft className="w-4 h-4 mr-1" /> Admin</Link>
          </Button>
          <h1 className="font-display font-black text-lg">Ticket Scanner</h1>
          <div className="w-16" />
        </div>

        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground mb-4">
            <SelectValue placeholder="Session (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No specific session (one-off event)</SelectItem>
            {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Result banner — big and glanceable for door duty */}
        {result && (
          <div className={`rounded-2xl p-5 mb-4 border text-center ${
            result.ok ? "bg-green-500/15 border-green-400/40"
            : result.result === "duplicate" ? "bg-yellow-500/15 border-yellow-400/40"
            : "bg-red-500/15 border-red-400/40"
          }`}>
            {result.ok
              ? <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
              : result.result === "duplicate"
                ? <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto" />
                : <XCircle className="w-12 h-12 text-red-400 mx-auto" />}
            <div className="font-display font-black text-xl mt-2">{result.player.child_name ?? "Unknown ticket"}</div>
            <div className="text-sm text-primary-foreground/80">{result.message}</div>
            {result.player.event_title && <div className="text-xs text-primary-foreground/60 mt-1">{result.player.event_title}{result.player.session_slot ? ` · ${result.player.session_slot}` : ""}</div>}
            {result.player.has_medical_notes && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs bg-lta-yellow/20 text-lta-yellow px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" /> Has medical notes — see admin
              </div>
            )}
          </div>
        )}

        <div id="qr-reader" className={`rounded-2xl overflow-hidden ${scanning ? "" : "hidden"}`} />

        {busy && <div className="flex justify-center py-3"><Loader2 className="w-6 h-6 animate-spin text-lta-cyan" /></div>}

        {!scanning ? (
          <Button onClick={startScanner} className="w-full h-14 bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold text-base">
            <Camera className="w-5 h-5 mr-2" /> Start camera
          </Button>
        ) : (
          <Button onClick={stopScanner} variant="outline" className="w-full mt-3 border-white/30 text-primary-foreground">
            Stop camera
          </Button>
        )}

        <div className="mt-5">
          <div className="text-xs text-primary-foreground/50 mb-1">No camera? Enter the ticket code:</div>
          <div className="flex gap-2">
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="e.g. 3f9a…" className="bg-white/10 border-white/20 text-primary-foreground" />
            <Button onClick={() => manual.trim() && submitToken(manual.trim())} disabled={busy} className="bg-lta-cyan text-suffolk-navy font-bold">Check</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminScan;
