// Typed client for the `coach-session` edge function. The shapes here are the
// contract in docs/REGISTERS-SPEC.md — keep them in step with the function.
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export type ProgrammeType = "programme" | "event";
export type AttendanceStatus = "arrived" | "absent";

export type Venue = { name: string; upcoming: number; next_date: string | null; programmes: number; events: number };

export type ProgrammeItem = {
  id: string;
  title: string;
  programme_type: ProgrammeType;
  meeting_cadence: string | null;
  location: string | null;
  next_session: { id: string; session_date: string; start_time: string | null; end_time: string | null } | null;
  session_count: number;
  upcoming_count: number;
  cancelled_at: string | null;
};

export type SessionSummary = {
  id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  cancelled_at: string | null;
  ended_at: string | null;
  total: number;
  arrived: number;
  absent: number;
  reports_complete: number;
};

export type SessionsResponse = {
  event: { id: string; title: string; programme_type: ProgrammeType; location: string | null; register_closed_at: string | null };
  sessions: SessionSummary[];
};

export type Attendance = { status: AttendanceStatus; marked_at: string; source: "scan" | "manual" | "auto" };

export type PlayerReport = {
  id: string;
  complete: boolean;
  sent_at: string | null;
  ratings: Record<string, number> | null;
  area_notes: Record<string, string> | null;
  comment: string | null;
  updated_at: string;
};

export type Player = {
  booking_id: string;
  child_id: string | null;
  child_name: string;
  age_group: string | null;
  photo_url: string | null;
  medical_notes: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  attendance: Attendance | null;
  /** This coach's report for this session. */
  report: PlayerReport | null;
  /** Latest complete report on the child before this session, any coach. */
  previous: { ratings: Record<string, number> | null; session_date: string | null; created_at: string } | null;
  /** Complete, unsent reports on this booking by any coach — what End session will send. */
  pending_reports: number;
};

export type RegisterSession = {
  id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  ended_at: string | null;
};

export type RegisterResponse = {
  event: { id: string; title: string; programme_type: ProgrammeType; location: string | null; register_closed_at: string | null };
  session: RegisterSession | null;
  players: Player[];
};

export type EndSessionResponse = {
  ok: true;
  absent_marked: number;
  reports_sent: number;
  absence_emails: number;
  errors: string[];
};

/**
 * POST to `coach-session` and unwrap the JSON. A non-2xx reply comes back
 * from supabase-js as a FunctionsHttpError with the body still unread, so we
 * read `{ error }` out of it to give the coach a real message.
 */
export async function coachSession<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("coach-session", { body });
  if (error) {
    let message = "Something went wrong — please try again.";
    if (error instanceof FunctionsHttpError) {
      try {
        const parsed = await error.context.json();
        if (parsed?.error) message = String(parsed.error);
      } catch { /* body was not JSON */ }
    } else if (error.message) {
      message = error.message;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
