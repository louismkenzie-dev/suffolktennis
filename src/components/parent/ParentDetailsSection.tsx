import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, FormGroup, Field, ActionBar, ListGroup, ListRow, SkeletonBlock } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, KeyRound, Search, Loader2, MapPin } from "lucide-react";


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
    return (
      <div className="space-y-4">
        <PageHeader title="Parent Details" hideTitleOnPhone description="Your personal details, contact information and account." className="mb-0" />
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-32" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5 md:max-w-3xl">
      <PageHeader title="Parent Details" hideTitleOnPhone description="Your personal details, contact information and account." className="mb-0" />

      <FormGroup title="Personal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="pd-first">
            <Input id="pd-first" autoComplete="given-name" value={profile.first_name} onChange={(e) => update("first_name", e.target.value)} />
          </Field>
          <Field label="Last name" htmlFor="pd-last">
            <Input id="pd-last" autoComplete="family-name" value={profile.last_name} onChange={(e) => update("last_name", e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="pd-email" hint="Used to sign in — it cannot be changed here." className="sm:col-span-2">
            <Input id="pd-email" value={user?.email ?? ""} disabled />
          </Field>
        </div>
      </FormGroup>

      <FormGroup title="Contact numbers" description="So coaches and county staff can reach you on the day.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary phone" htmlFor="pd-phone1">
            <Input id="pd-phone1" type="tel" inputMode="tel" autoComplete="tel" placeholder="07123 456 789" value={profile.primary_phone ?? ""} onChange={(e) => update("primary_phone", e.target.value)} />
          </Field>
          <Field label="Secondary phone" htmlFor="pd-phone2">
            <Input id="pd-phone2" type="tel" inputMode="tel" placeholder="Optional" value={profile.secondary_phone ?? ""} onChange={(e) => update("secondary_phone", e.target.value)} />
          </Field>
        </div>
      </FormGroup>

      <FormGroup title="Home address">
        <Field label="Postcode" htmlFor="pd-postcode" hint="Enter your postcode and pick your address from the list.">
          <div className="flex gap-2">
            <Input
              id="pd-postcode"
              autoComplete="postal-code"
              autoCapitalize="characters"
              value={profile.address_postcode ?? ""}
              onChange={(e) => update("address_postcode", e.target.value.toUpperCase())}
              placeholder="e.g. IP1 1AA"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupPostcode(); } }}
            />
            <Button type="button" variant="outline" onClick={lookupPostcode} disabled={pcLoading} className="shrink-0">
              {pcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Find
            </Button>
          </div>
        </Field>

        {suggestions.length > 0 && (
          <ListGroup className="max-h-72 overflow-auto">
            {suggestions.map((sg, idx) => (
              <ListRow
                key={`${sg.full_address}-${idx}`}
                size="sm"
                onClick={() => pickAddress(sg.full_address)}
                leading={<MapPin className="h-4 w-4 text-primary" />}
                title={sg.address_line_1}
                subtitle={[sg.address_line_2, sg.town_city, sg.postcode].filter(Boolean).join(", ")}
              />
            ))}
          </ListGroup>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" htmlFor="pd-a1" className="sm:col-span-2">
            <Input id="pd-a1" autoComplete="address-line1" value={profile.address_line1 ?? ""} onChange={(e) => update("address_line1", e.target.value)} />
          </Field>
          <Field label="Address line 2" htmlFor="pd-a2" className="sm:col-span-2">
            <Input id="pd-a2" autoComplete="address-line2" value={profile.address_line2 ?? ""} onChange={(e) => update("address_line2", e.target.value)} />
          </Field>
          <Field label="Town / City" htmlFor="pd-city">
            <Input id="pd-city" autoComplete="address-level2" value={profile.address_city ?? ""} onChange={(e) => update("address_city", e.target.value)} />
          </Field>
        </div>
      </FormGroup>

      <FormGroup title="Sponsorship" description="Interested in sponsoring or partnering with Suffolk Tennis?">
        <label className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
          <span className="text-sm font-medium">I'd like to hear about sponsorship opportunities</span>
          <Switch checked={profile.sponsorship_interest} onCheckedChange={(v) => update("sponsorship_interest", v)} aria-label="Sponsorship interest" />
        </label>
        {profile.sponsorship_interest && (
          <>
            <Field label="Company / organisation" htmlFor="pd-company">
              <Input id="pd-company" autoComplete="organization" placeholder="e.g. Acme Ltd" value={profile.sponsorship_company ?? ""} onChange={(e) => update("sponsorship_company", e.target.value)} />
            </Field>
            <Field label="Tell us more (optional)" htmlFor="pd-sponsor" hint="Our partnerships team will be in touch.">
              <Textarea id="pd-sponsor" rows={3} placeholder="Type of sponsorship you'd like to discuss, sector, budget range, ideas…" value={profile.sponsorship_details ?? ""} onChange={(e) => update("sponsorship_details", e.target.value)} />
            </Field>
          </>
        )}
      </FormGroup>

      <FormGroup title="Account">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPwOpen(true)}><KeyRound className="h-4 w-4" /> Change password</Button>
          <Button variant="ghost" onClick={sendResetEmail}>Email me a reset link</Button>
        </div>
      </FormGroup>

      <ActionBar aboveNav>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </ActionBar>

      <Dialog open={pwOpen} onOpenChange={(o) => { setPwOpen(o); if (!o) { setNewPw(""); setConfirmPw(""); } }}>
        <DialogContent className="md:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>At least 8 characters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="New password" htmlFor="pd-pw1">
              <Input id="pd-pw1" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </Field>
            <Field label="Confirm new password" htmlFor="pd-pw2">
              <Input id="pd-pw2" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={changePassword} disabled={resetting}>{resetting ? "Updating…" : "Update password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ParentDetailsSection;
