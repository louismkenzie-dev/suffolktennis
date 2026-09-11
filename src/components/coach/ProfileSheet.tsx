// A child's profile for the coach: who they are, anything medical, how to
// reach the parent, their attendance today and the way into the report.
import { AlertCircle, Check, ClipboardList, Mail, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, InlineNote, ListGroup, ListRow, SegmentedControl, StatusBadge } from "@/components/app";
import { LTA_AREAS, LTA_LEVELS, levelLabel } from "@/lib/lta";
import { cn } from "@/lib/utils";
import type { Player, RegisterSession } from "./api";
import { ArrivalTime, type AttendanceAction } from "./PlayerRow";
import { clock, fmtDay, londonParts } from "./time";

type Segment = "arrived" | "absent" | "clear";

export function ProfileSheet({ player, session, isProgramme, open, onOpenChange, busy, onAttendance, onOpenReport }: {
  player: Player | null;
  session: RegisterSession | null;
  isProgramme: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onAttendance: (status: AttendanceAction) => void;
  onOpenReport: () => void;
}) {
  const ratedCount = LTA_AREAS.filter((a) => [1, 2, 3, 4].includes(player?.report?.ratings?.[a.name] as number)).length;
  const complete = !!player?.report?.complete;
  const prev = player?.previous;
  const prevRatings = prev?.ratings ?? null;
  const segment: Segment = player?.attendance?.status ?? "clear";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        {player && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 font-display">
                <Avatar name={player.child_name} src={player.photo_url} size="lg" />
                <span className="min-w-0">
                  <span className="block truncate">{player.child_name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {player.age_group && <StatusBadge tone="neutral" dot={false}>{player.age_group}</StatusBadge>}
                    <ArrivalTime player={player} session={session} className="text-[12px] font-normal" />
                  </span>
                </span>
              </DialogTitle>
              <DialogDescription className="sr-only">Player profile and attendance</DialogDescription>
            </DialogHeader>

            {player.medical_notes && (
              <InlineNote tone="warning" icon={AlertCircle}>
                <span className="block text-[11px] font-semibold uppercase tracking-wide">Medical</span>
                <span className="whitespace-pre-line">{player.medical_notes}</span>
              </InlineNote>
            )}

            <div>
              <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Attendance</p>
              <SegmentedControl<Segment>
                value={segment}
                onChange={(v) => { if (!busy && v !== segment) onAttendance(v); }}
                options={[
                  { value: "arrived", label: "Arrived", icon: Check },
                  { value: "absent", label: "Absent", icon: X },
                  { value: "clear", label: "Not marked" },
                ]}
              />
            </div>

            {isProgramme && (
              <div className="space-y-1.5">
                <Button
                  onClick={onOpenReport}
                  size="lg"
                  className={cn("w-full text-white", complete ? "bg-emerald-600 hover:bg-emerald-600/90" : "bg-red-600 hover:bg-red-600/90")}
                >
                  <ClipboardList className="h-5 w-5" />
                  {complete ? "Session report · Complete" : `Session report · ${ratedCount}/9 rated`}
                </Button>
                <p className="px-0.5 text-center text-[12px] text-muted-foreground">
                  {player.report?.sent_at
                    ? `Sent ${fmtDay(londonParts(player.report.sent_at).date)} ${clock(player.report.sent_at)} — edits are saved quietly and the parent sees “Updated”.`
                    : complete
                      ? "Goes to the parent when you end the session."
                      : "Rate all nine areas to complete it."}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Parent</p>
              <ListGroup>
                {player.parent_phone ? (
                  <ListRow
                    size="sm"
                    href={`tel:${player.parent_phone.replace(/\s+/g, "")}`}
                    leading={<Phone className="h-5 w-5 text-primary" strokeWidth={1.8} />}
                    title={player.parent_name ?? "Parent"}
                    subtitle={player.parent_phone}
                    ariaLabel={`Call ${player.parent_name ?? "parent"} on ${player.parent_phone}`}
                    chevron
                  />
                ) : (
                  <ListRow
                    size="sm"
                    leading={<Phone className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.8} />}
                    title={player.parent_name ?? "Parent"}
                    subtitle="No phone number on file"
                  />
                )}
                {player.parent_email && (
                  <ListRow
                    size="sm"
                    href={`mailto:${player.parent_email}`}
                    leading={<Mail className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />}
                    title={player.parent_email}
                    ariaLabel={`Email ${player.parent_email}`}
                  />
                )}
              </ListGroup>
            </div>

            {isProgramme && (
              <div>
                <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Previous session{prev?.session_date ? ` · ${fmtDay(prev.session_date)}` : ""}
                </p>
                {prevRatings ? (
                  <div className="grid grid-cols-1 gap-x-3 gap-y-1 rounded-2xl border border-border bg-card px-3 py-2 sm:grid-cols-2">
                    {LTA_AREAS.map((a) => {
                      const v = prevRatings[a.name];
                      const level = LTA_LEVELS.find((l) => l.value === v);
                      return (
                        <div key={a.name} className="flex min-h-8 items-center justify-between gap-2 text-[13px]">
                          <span className="truncate text-foreground">{a.name}</span>
                          <StatusBadge tone={level?.tone ?? "neutral"} dot={false} className="shrink-0">{levelLabel(v)}</StatusBadge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-center text-sm text-muted-foreground">No earlier report on {player.child_name.split(" ")[0]} yet.</p>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
