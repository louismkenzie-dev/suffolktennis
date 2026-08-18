import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

const schema = z.object({
  parent_name: z.string().trim().min(1, "Required").max(120),
  parent_email: z.string().trim().email("Invalid email").max(255),
  parent_phone: z.string().trim().max(40).optional().or(z.literal("")),
  parent_club: z.string().trim().max(120).optional().or(z.literal("")),
  player_coach: z.string().trim().max(120).optional().or(z.literal("")),
  child_name: z.string().trim().min(1, "Required").max(120),
  child_dob: z.string().max(20).optional().or(z.literal("")),
  child_gender: z.string().max(30).optional().or(z.literal("")),
  session_slot: z.string().max(120).optional().or(z.literal("")),
  medical_notes: z.string().max(1000).optional().or(z.literal("")),
  photo_consent: z.boolean(),
});

export type RisingStarsEvent = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  session_slots?: string[] | null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: RisingStarsEvent | null;
}

const empty = {
  parent_name: "", parent_email: "", parent_phone: "", parent_club: "", player_coach: "",
  child_name: "", child_dob: "", child_gender: "", session_slot: "", medical_notes: "", photo_consent: false,
};

export default function RisingStarsSignupDialog({ open, onOpenChange, event }: Props) {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const slots = (event?.session_slots ?? []).filter(Boolean);

  const submit = async () => {
    if (!event) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast.error(first ?? "Please check the form");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("submit-rising-stars-signup", {
      body: { event_id: event.id, ...parsed.data },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error("Sign-up failed — please try again");
      return;
    }
    setDone(true);
    toast.success("You're booked in! Check your inbox for confirmation.");
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) { setDone(false); setForm(empty); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {done ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-lta-cyan/15 text-lta-cyan flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="font-display text-2xl font-black mt-4">You're booked in!</h3>
            <p className="text-muted-foreground mt-2">
              A confirmation email is on its way. We'll see you on court.
            </p>
            <p className="text-sm text-muted-foreground mt-6">
              💡 Want to track your child's tennis journey? Create a free Parent Hub account.
            </p>
            <Button className="mt-4" onClick={() => close(false)}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-2xl">
                <Sparkles className="text-lta-cyan" size={20} /> Sign up for {event?.title}
              </DialogTitle>
              <DialogDescription>
                It's free — takes under a minute. We'll email confirmation to the parent's address.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-lta-cyan mb-2">Parent details</h4>
                <div className="grid gap-3">
                  <div>
                    <Label>Full name *</Label>
                    <Input value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Email *</Label>
                      <Input type="email" value={form.parent_email} onChange={e => setForm({ ...form, parent_email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input type="tel" value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Home club</Label>
                      <Input placeholder="e.g. Ipswich Sports Club" value={form.parent_club} onChange={e => setForm({ ...form, parent_club: e.target.value })} />
                    </div>
                    <div>
                      <Label>Player's coach</Label>
                      <Input placeholder="Coach's name" value={form.player_coach} onChange={e => setForm({ ...form, player_coach: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-lta-cyan mb-2">Child details</h4>
                <div className="grid gap-3">
                  <div>
                    <Label>Child's name *</Label>
                    <Input value={form.child_name} onChange={e => setForm({ ...form, child_name: e.target.value })} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Date of birth</Label>
                      <Input type="date" value={form.child_dob} onChange={e => setForm({ ...form, child_dob: e.target.value })} />
                    </div>
                    <div>
                      <Label>Gender</Label>
                      <Select value={form.child_gender} onValueChange={v => setForm({ ...form, child_gender: v })}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Boy">Boy</SelectItem>
                          <SelectItem value="Girl">Girl</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {slots.length > 0 && (
                    <div>
                      <Label>Choose a session *</Label>
                      <Select value={form.session_slot} onValueChange={v => setForm({ ...form, session_slot: v })}>
                        <SelectTrigger><SelectValue placeholder="Pick a time slot…" /></SelectTrigger>
                        <SelectContent>
                          {slots.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Medical notes / allergies (optional)</Label>
                <Textarea rows={2} value={form.medical_notes} onChange={e => setForm({ ...form, medical_notes: e.target.value })} />
              </div>

              <label className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 cursor-pointer">
                <Checkbox checked={form.photo_consent} onCheckedChange={c => setForm({ ...form, photo_consent: !!c })} className="mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  I consent for photos of my child to be used by Suffolk Tennis for promotional purposes.
                </span>
              </label>

              <Button onClick={submit} disabled={busy} className="w-full bg-suffolk-navy hover:bg-suffolk-navy/90 text-primary-foreground">
                {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Complete sign-up"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
