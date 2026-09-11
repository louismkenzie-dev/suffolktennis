// The session report: nine LTA areas rated 1–4, an optional note per area
// and one overall comment. Complete once every area is rated; the parent
// gets it when the session ends (or two hours after, whichever comes first).
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app";
import { LTA_AREAS, LTA_LEVELS, isComplete, levelLabel, type Ratings } from "@/lib/lta";
import { cn } from "@/lib/utils";
import { coachSession, type Player } from "./api";
import { clock, fmtDay, londonParts } from "./time";

type SavedReport = { id: string; complete: boolean; sent_at: string | null; updated_at: string };

const VALID = [1, 2, 3, 4];

export function ReportSheet({ player, sessionId, open, onOpenChange, onSaved }: {
  player: Player | null;
  sessionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (report: SavedReport) => void;
}) {
  const [ratings, setRatings] = useState<Ratings>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load this coach's saved report each time the sheet opens for a player.
  useEffect(() => {
    if (!open || !player) return;
    const r = player.report;
    const seeded: Ratings = {};
    for (const a of LTA_AREAS) {
      const v = r?.ratings?.[a.name];
      if (VALID.includes(v as number)) seeded[a.name] = v as number;
    }
    setRatings(seeded);
    const seededNotes = { ...(r?.area_notes ?? {}) };
    setNotes(seededNotes);
    setOpenNotes(new Set(Object.keys(seededNotes).filter((k) => seededNotes[k]?.trim())));
    setComment(r?.comment ?? "");
    setError(null);
    // Polling swaps the player object every 5s; only a fresh open (or a
    // different child) should reseed, or the coach's half-written ratings vanish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, player?.booking_id]);

  const ratedCount = useMemo(() => LTA_AREAS.filter((a) => VALID.includes(ratings[a.name])).length, [ratings]);
  const complete = isComplete(ratings);
  const previous = player?.previous?.ratings ?? null;

  const save = async () => {
    if (!player) return;
    setSaving(true);
    setError(null);
    const cleanRatings: Record<string, 1 | 2 | 3 | 4> = {};
    for (const a of LTA_AREAS) {
      const v = ratings[a.name];
      if (VALID.includes(v)) cleanRatings[a.name] = v as 1 | 2 | 3 | 4;
    }
    const cleanNotes: Record<string, string> = {};
    for (const a of LTA_AREAS) {
      const n = notes[a.name]?.trim();
      if (n) cleanNotes[a.name] = n;
    }
    try {
      const res = await coachSession<{ ok: true; report: SavedReport }>({
        action: "save_report",
        booking_id: player.booking_id,
        ...(sessionId && { session_id: sessionId }),
        ratings: cleanRatings,
        area_notes: cleanNotes,
        comment: comment.trim(),
      });
      const wasSent = !!player.report?.sent_at;
      toast.success(
        wasSent ? "Report updated — the parent will see it as updated"
          : res.report.complete ? "Report complete — it goes to the parent when you end the session"
            : `Report saved · ${ratedCount}/9 rated`,
      );
      onSaved(res.report);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the report — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="md:max-w-lg">
        {player && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Session report · {player.child_name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={complete ? "success" : "danger"}>{complete ? "Complete" : `${ratedCount}/9 rated`}</StatusBadge>
                {player.report?.sent_at && <span>Sent {fmtDay(londonParts(player.report.sent_at).date)} {clock(player.report.sent_at)}</span>}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {LTA_AREAS.map((area) => {
                const value = ratings[area.name];
                const last = previous?.[area.name];
                const noteOpen = openNotes.has(area.name);
                return (
                  <div key={area.name}>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-semibold leading-tight">{area.name}</div>
                      {VALID.includes(last) && (
                        <div className="shrink-0 text-[11px] text-muted-foreground">Last time: <span className="font-medium text-foreground/80">{levelLabel(last)}</span></div>
                      )}
                    </div>
                    <div className="mb-2 text-[11px] text-muted-foreground">{area.descriptor}</div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label={area.name}>
                      {LTA_LEVELS.map((level) => {
                        const active = value === level.value;
                        return (
                          <button
                            key={level.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setRatings((r) => {
                              const next = { ...r };
                              if (active) delete next[area.name]; else next[area.name] = level.value;
                              return next;
                            })}
                            className={cn(
                              "press flex min-h-11 items-center justify-center rounded-xl border px-2 text-[12px] font-semibold leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9",
                              active ? level.classes + " ring-1 ring-current" : "border-border bg-card text-muted-foreground hover:border-foreground/40",
                            )}
                          >
                            {level.label}
                          </button>
                        );
                      })}
                    </div>
                    {noteOpen ? (
                      <Textarea
                        className="mt-2"
                        rows={2}
                        value={notes[area.name] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [area.name]: e.target.value }))}
                        placeholder={`A note on ${area.name.toLowerCase()} (optional)`}
                        aria-label={`Note on ${area.name}`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenNotes((s) => new Set(s).add(area.name))}
                        className="hit-area mt-1.5 inline-flex min-h-8 items-center gap-1 rounded-lg px-1 text-[12px] font-medium text-primary"
                      >
                        <Plus size={14} /> Add note
                      </button>
                    )}
                  </div>
                );
              })}

              <div>
                <div className="mb-1.5 text-sm font-semibold">Overall comment</div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="What went well, what to work on…"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Parents see the ratings, notes and this comment together on the report.</p>
              </div>

              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>

            {/* Sticks to the bottom of the sheet so Save is never a long scroll away. */}
            <div className="sticky -mx-5 -mb-[max(1.25rem,env(safe-area-inset-bottom))] bottom-0 border-t border-border bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 md:-mx-6 md:-mb-6 md:px-6 md:pb-6">
              <Button onClick={save} disabled={saving} size="lg" className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : complete ? "Save report" : `Save (${ratedCount}/9 rated)`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
