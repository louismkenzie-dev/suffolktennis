import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, KeyRound, Mail, User as UserIcon, Search, Loader2, Handshake } from "lucide-react";


type ParentProfile = {
  first_name: string;
  last_name: string;
  phone: string | null;
  primary_phone: string | null;
  secondary_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_postcode: string | null;
  sponsorship_interest: boolean;
  sponsorship_company: string | null;
  sponsorship_details: string | null;
  newsletter_subscribed: boolean;
};

const ParentDetailsSection = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const [pcLoading, setPcLoading] = useState(false);
  type AddressSuggestion = {
    full_address: string;
    address_line_1: string;
    address_line_2: string;
    town_city: string;
    county: string;
    postcode: string;
    country: string;
  };
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  const lookupPostcode = async () => {
    const pc = (profile?.address_postcode ?? "").trim();
    if (pc.length < 5) { toast.error("Enter a UK postcode first"); return; }
    setPcLoading(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("postcode-lookup", {
        body: { postcode: pc },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: AddressSuggestion[] = data?.addresses ?? [];
      if (list.length === 0) {
        toast.error("No addresses found for that postcode");
      } else {
        setSuggestions(list);
        toast.success(`Found ${list.length} address${list.length === 1 ? "" : "es"}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPcLoading(false);
    }
  };

  const pickAddress = (full: string) => {
    const a = suggestions.find((s) => s.full_address === full);
    if (!a) return;
    setProfile((p) => p ? {
      ...p,
      address_line1: a.address_line_1 || p.address_line1,
      address_line2: a.address_line_2 || "",
      address_city: a.town_city || p.address_city,
      address_postcode: a.postcode || p.address_postcode,
    } : p);
    setSuggestions([]);
    toast.success("Address filled in");
  };



  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("first_name,last_name,phone,primary_phone,secondary_phone,address_line1,address_line2,address_city,address_postcode,sponsorship_interest,sponsorship_company,sponsorship_details,newsletter_subscribed")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(
          data ?? {
            first_name: "",
            last_name: "",
            phone: null,
            primary_phone: null,
            secondary_phone: null,
            address_line1: null,
            address_line2: null,
            address_city: null,
            address_postcode: null,
            sponsorship_interest: false,
            sponsorship_company: null,
            sponsorship_details: null,
            newsletter_subscribed: true,
          }
        );
        setLoading(false);
      });
  }, [user]);

  const update = <K extends keyof ParentProfile>(key: K, value: ParentProfile[K]) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  };

  const save = async () => {
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        primary_phone: profile.primary_phone,
        secondary_phone: profile.secondary_phone,
        address_line1: profile.address_line1,
        address_line2: profile.address_line2,
        address_city: profile.address_city,
        address_postcode: profile.address_postcode,
        sponsorship_interest: profile.sponsorship_interest,
        sponsorship_company: profile.sponsorship_company,
        sponsorship_details: profile.sponsorship_details,
        newsletter_subscribed: profile.newsletter_subscribed,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  const sendResetEmail = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  const changePassword = async () => {
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    setResetting(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setResetting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setNewPw(""); setConfirmPw(""); setPwOpen(false);
    }
  };

  if (loading || !profile) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="font-display text-2xl md:text-3xl font-black text-foreground">Parent Details</h2>
        <p className="text-muted-foreground text-sm">
          Manage your personal details, contact information and account.
        </p>
      </div>

      {/* Personal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><UserIcon className="w-4 h-4 text-lta-cyan" />Personal</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>First name</Label>
            <Input value={profile.first_name} onChange={(e) => update("first_name", e.target.value)} />
          </div>
          <div>
            <Label>Last name</Label>
            <Input value={profile.last_name} onChange={(e) => update("last_name", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />Email</Label>
            <Input value={user?.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground mt-1">Email is used for sign-in and cannot be changed here.</p>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact numbers</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Primary phone</Label>
            <Input
              type="tel"
              placeholder="07123 456 789"
              value={profile.primary_phone ?? ""}
              onChange={(e) => update("primary_phone", e.target.value)}
            />
          </div>
          <div>
            <Label>Secondary phone</Label>
            <Input
              type="tel"
              placeholder="Optional"
              value={profile.secondary_phone ?? ""}
              onChange={(e) => update("secondary_phone", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Home address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Postcode</Label>
            <div className="flex gap-2">
              <Input
                value={profile.address_postcode ?? ""}
                onChange={(e) => update("address_postcode", e.target.value.toUpperCase())}
                placeholder="e.g. IP1 1AA"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupPostcode(); } }}
              />
              <Button type="button" onClick={lookupPostcode} disabled={pcLoading} className="bg-lta-cyan hover:bg-lta-cyan/90 text-suffolk-navy">
                {pcLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Find address
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Enter your postcode and pick your address from the list.</p>
          </div>

          {suggestions.length > 0 && (
            <div className="rounded-lg border bg-muted/30 divide-y max-h-72 overflow-auto">
              {suggestions.map((s, idx) => (
                <button
                  key={`${s.full_address}-${idx}`}
                  type="button"
                  onClick={() => pickAddress(s.full_address)}
                  className="w-full text-left px-3 py-2 hover:bg-lta-cyan/10 transition-colors flex items-start gap-2"
                >
                  <Search className="w-4 h-4 mt-0.5 text-lta-cyan shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{s.address_line_1}</p>
                    <p className="text-xs text-muted-foreground">{[s.address_line_2, s.town_city, s.postcode].filter(Boolean).join(", ")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Address line 1</Label>
              <Input value={profile.address_line1 ?? ""} onChange={(e) => update("address_line1", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Address line 2</Label>
              <Input value={profile.address_line2 ?? ""} onChange={(e) => update("address_line2", e.target.value)} />
            </div>
            <div>
              <Label>Town / City</Label>
              <Input value={profile.address_city ?? ""} onChange={(e) => update("address_city", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sponsorship */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Handshake className="w-4 h-4 text-lta-cyan" />
            Sponsorship opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="pr-4">
              <p className="font-medium">Interested in sponsoring Suffolk Tennis?</p>
              <p className="text-xs text-muted-foreground">
                Tick this if you or your company would like to explore sponsorship, partnership or commercial opportunities with us.
              </p>
            </div>
            <Switch
              checked={profile.sponsorship_interest}
              onCheckedChange={(v) => update("sponsorship_interest", v)}
            />
          </div>
          {profile.sponsorship_interest && (
            <>
              <div>
                <Label>Company / Organisation</Label>
                <Input
                  placeholder="e.g. Acme Ltd"
                  value={profile.sponsorship_company ?? ""}
                  onChange={(e) => update("sponsorship_company", e.target.value)}
                />
              </div>
              <div>
                <Label>Tell us more (optional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Type of sponsorship you'd like to discuss, sector, budget range, ideas, etc."
                  value={profile.sponsorship_details ?? ""}
                  onChange={(e) => update("sponsorship_details", e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Our partnerships team will be in touch to explore opportunities together.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving} className="bg-lta-cyan hover:bg-lta-cyan/90 text-suffolk-navy">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="outline" onClick={() => setPwOpen((o) => !o)}>
          <KeyRound className="w-4 h-4 mr-2" />Change password
        </Button>
        <Button variant="ghost" onClick={sendResetEmail}>
          Send password reset email
        </Button>
      </div>

      {pwOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-w-md">
            <div>
              <Label>New password</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={changePassword} disabled={resetting}>
                {resetting ? "Updating…" : "Update password"}
              </Button>
              <Button variant="ghost" onClick={() => { setPwOpen(false); setNewPw(""); setConfirmPw(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default ParentDetailsSection;
