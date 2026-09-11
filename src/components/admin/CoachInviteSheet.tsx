/**
 * Invite someone to coach with Suffolk Tennis: a name and an email address.
 * send-coach-invitations finds or creates the coach_invitations row and
 * emails the personal join link; the coach signs up (or in) with that address
 * and the role is added to their account. The sibling of the parent booking
 * invitation, so the two flows feel like one system.
 */
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app";

type SendResult = { email: string; invitation_id?: string; sent: boolean; error?: string };

export default function CoachInviteSheet({ open, onOpenChange, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The invitation row exists (sent or not) — reload the Coach accounts list. */
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => onOpenChange(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("send-coach-invitations", {
      body: { invitees: [{ name: name.trim(), email: address }] },
    });
    // The dialog must never stay locked: release it before deciding what to
    // say, whichever way the call went.
    setSubmitting(false);

    // invoke() resolves with { error } on a non-2xx rather than throwing, and
    // a 200 can still carry a per-address failure in results ("already a
    // coach", or the email provider not being configured), so all three are
    // read before claiming success.
    const result: SendResult | undefined = data?.results?.[0];
    if (error || data?.error || !result?.sent) {
      const reason = result?.error ?? data?.error ?? error?.message ?? "Please try again.";
      toast.error(`Could not invite ${address}`, { description: reason });
      // A row may still have been created (email not sent), so the list
      // must show it rather than let the admin invite twice.
      if (result?.invitation_id) onDone();
      return;
    }
    toast.success(`Invitation sent to ${address}`);
    close();
    setName("");
    setEmail("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a coach</DialogTitle>
          <DialogDescription>
            They get an email with a personal link to set up their Suffolk Tennis coach account. Once they have accepted, assign them to programmes from the programme's form.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" htmlFor="coach-invite-name" hint="Optional — used to address the email.">
            <Input id="coach-invite-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Email" htmlFor="coach-invite-email" required hint="They must sign up or sign in with this address.">
            <Input
              id="coach-invite-email"
              type="email"
              required
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={submitting || !email.trim()}>{submitting ? "Sending…" : "Send invitation"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
