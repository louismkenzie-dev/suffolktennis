import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type State = "loading" | "valid" | "invalid" | "already" | "confirmed";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token, method: "GET" },
    }).then(({ data, error }) => {
      if (error || !data) return setState("invalid");
      if (data.already_unsubscribed) { setEmail(data.email ?? ""); setState("already"); return; }
      if (data.valid) { setEmail(data.email ?? ""); setState("valid"); return; }
      setState("invalid");
    }).catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token, method: "POST" },
    });
    setBusy(false);
    if (error || !data?.success) return setState("invalid");
    setState("confirmed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
        {state === "loading" && <Loader2 className="w-8 h-8 animate-spin mx-auto text-lta-cyan" />}

        {state === "valid" && (
          <>
            <h1 className="font-display text-2xl font-black">Unsubscribe from Suffolk Tennis emails?</h1>
            <p className="text-muted-foreground mt-2">{email}</p>
            <Button onClick={confirm} disabled={busy} className="mt-6 w-full bg-suffolk-navy text-primary-foreground">
              {busy ? "Working…" : "Confirm unsubscribe"}
            </Button>
            <Button asChild variant="ghost" className="mt-2 w-full"><Link to="/">Cancel</Link></Button>
          </>
        )}

        {(state === "confirmed" || state === "already") && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-lta-cyan" />
            <h1 className="font-display text-2xl font-black mt-4">You've been unsubscribed</h1>
            <p className="text-muted-foreground mt-2">{email} will no longer receive marketing emails from Suffolk Tennis. Important account emails may still be sent.</p>
            <Button asChild className="mt-6"><Link to="/">Back to homepage</Link></Button>
          </>
        )}

        {state === "invalid" && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="font-display text-2xl font-black mt-4">Invalid or expired link</h1>
            <p className="text-muted-foreground mt-2">This unsubscribe link is no longer valid. Please contact us if you need help.</p>
            <Button asChild className="mt-6"><Link to="/contact">Contact us</Link></Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
