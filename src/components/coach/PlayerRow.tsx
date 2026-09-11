// One line of the register: the 44px attendance control, who the child is,
// when they arrived, and (programmes only) whether their report is done.
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { Avatar, StatusBadge } from "@/components/app";
import { cn } from "@/lib/utils";
import type { Player, RegisterSession } from "./api";
import { clock, isLate } from "./time";

export type AttendanceAction = "arrived" | "absent" | "clear";

/**
 * Tap cycles Not marked → Arrived → Not marked. A child marked absent who
 * turns up late is a tap away from Arrived; Absent itself is set from the
 * profile sheet so it is never a slip of the thumb.
 */
export function AttendanceButton({ player, busy, onChange, size = "h-11 w-11" }: {
  player: Player;
  busy: boolean;
  onChange: (status: AttendanceAction) => void;
  size?: string;
}) {
  const status = player.attendance?.status ?? null;
  const next: AttendanceAction = status === "arrived" ? "clear" : "arrived";
  const label = status === "arrived"
    ? `Clear ${player.child_name}'s arrival`
    : `Mark ${player.child_name} arrived`;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      disabled={busy}
      aria-label={label}
      aria-pressed={status === "arrived"}
      className={cn(
        "press flex shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70",
        size,
        status === "arrived" && "border-emerald-500 bg-emerald-500 text-white",
        status === "absent" && "border-red-500 bg-red-500 text-white",
        !status && "border-border bg-card text-transparent hover:border-primary",
      )}
    >
      {busy
        ? <Loader2 size={18} className={cn("animate-spin", !status && "text-muted-foreground")} />
        : status === "absent" ? <X size={20} strokeWidth={3} /> : <Check size={20} strokeWidth={3} />}
    </button>
  );
}

/** Red until all nine areas are rated by this coach, green once they are. */
export function ReportDot({ player, className }: { player: Player; className?: string }) {
  const complete = !!player.report?.complete;
  return (
    <span
      role="img"
      aria-label={complete ? "Report complete" : player.report ? "Report incomplete" : "No report yet"}
      title={complete ? (player.report?.sent_at ? "Report sent" : "Report complete") : "Report incomplete"}
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", complete ? "bg-emerald-500" : "bg-red-500", className)}
    />
  );
}

/** "Arrived 1.28pm" (amber when late) / "Absent 1.30pm" / "Not marked". */
export function ArrivalTime({ player, session, className }: { player: Player; session: RegisterSession | null; className?: string }) {
  const a = player.attendance;
  if (!a) return <span className={cn("text-[12px] text-muted-foreground/70", className)}>Not marked</span>;
  const late = a.status === "arrived" && isLate(a.marked_at, session?.session_date, session?.start_time);
  return (
    <span className={cn("text-[12px] tabular", a.status === "absent" ? "text-red-700" : late ? "text-amber-700" : "text-muted-foreground", className)}>
      {a.status === "absent" ? "Absent" : late ? "Late" : "Arrived"} {clock(a.marked_at)}
    </span>
  );
}

export function PlayerRow({ player, session, isProgramme, busy, onAttendance, onOpen }: {
  player: Player;
  session: RegisterSession | null;
  isProgramme: boolean;
  busy: boolean;
  onAttendance: (status: AttendanceAction) => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-card px-3 py-2.5">
      <AttendanceButton player={player} busy={busy} onChange={onAttendance} />
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${player.child_name}`}
        className="press flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar name={player.child_name} src={player.photo_url} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-medium leading-snug text-foreground">{player.child_name}</span>
            {player.age_group && <StatusBadge tone="neutral" dot={false} className="px-2 py-0 text-[11px]">{player.age_group}</StatusBadge>}
            {player.medical_notes && (
              <span className="inline-flex shrink-0 items-center text-amber-600" title="Has medical notes">
                <AlertCircle size={15} /><span className="sr-only">Has medical notes</span>
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <ArrivalTime player={player} session={session} />
          </div>
        </div>
        {isProgramme && <ReportDot player={player} className="mr-1" />}
      </button>
    </div>
  );
}
