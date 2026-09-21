// "End session" confirmation: names everyone still unmarked (they become
// absent and their parents get a note) and says how many reports will go.
//
// "How many will go" is not the same as "how many you wrote": a report
// finished more than two hours after the session has already been sent by the
// dispatcher. The two numbers are kept apart here so a coach who wrote four
// and sees "2 will be sent" is not left thinking two went missing.
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineNote } from "@/components/app";
import type { Player } from "./api";

export function EndSessionDialog({ open, onOpenChange, players, isProgramme, busy, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: Player[];
  isProgramme: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const unmarked = players.filter((p) => !p.attendance);
  // Every coach's complete, unsent reports for the session — the same set
  // end_session sends.
  const toSend = players.reduce((n, p) => n + (p.pending_reports ?? 0), 0);
  // Reports finished more than two hours after the session are sent on their
  // own by session-reports-dispatch, without waiting for this button. So the
  // number left to send can be smaller than the number written — and saying
  // only "2 will be sent" after writing four reads as though two were lost.
  // Ollie hit exactly that on 20 Sep 2026.
  const written = players.reduce(
    (n, p) => n + (p.report?.complete ? 1 : 0) + (p.other_reports ?? []).filter((r) => r.complete).length,
    0,
  );
  const alreadySent = Math.max(0, written - toSend);
  const one = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

  const reportLine = alreadySent === 0
    ? toSend === 1 ? "1 complete report will be sent to the parent." : `${toSend} complete reports will be sent to parents.`
    : toSend === 0
      ? `Nothing left to send — ${one(alreadySent, "report has", "reports have")} already gone to parents.`
      : `${one(toSend, "report goes", "reports go")} to parents now; ${one(alreadySent, "has", "have")} already gone.`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">End session?</DialogTitle>
          <DialogDescription>
            {isProgramme ? reportLine : "The register closes; you can still change marks afterwards."}
          </DialogDescription>
        </DialogHeader>

        {unmarked.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">These will be marked absent and their parents told</p>
            <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
              {unmarked.map((p) => (
                <li key={p.booking_id} className="flex min-h-10 items-center px-4 py-2 text-[15px]">{p.child_name}</li>
              ))}
            </ul>
          </div>
        ) : (
          <InlineNote tone="success">Everyone is marked — nobody will be recorded absent.</InlineNote>
        )}

        {isProgramme && toSend === 0 && (
          <p className="text-xs text-muted-foreground">
            {alreadySent > 0
              ? "Reports finished after a session go to the parent on their own, so there is nothing waiting on this button. Anything still incomplete stays with you until you finish it."
              : "Reports still incomplete stay with you; anything finished later is sent automatically two hours after the session."}
          </p>
        )}

        <DialogFooter className="sm:flex-row">
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button size="lg" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "End session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
