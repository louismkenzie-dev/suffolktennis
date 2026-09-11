/**
 * One shape for a child's progress, whoever wrote it down. A coach's session
 * report (session_reports) and an LTA camp report a parent uploaded
 * (player_reports) rate the same nine areas on the same 1–4 scale, so the
 * Performance & Reports view charts them on one trend line. Nothing is
 * migrated: each entry keeps its full row for the bits only that kind has.
 */
import { supabase } from "@/integrations/supabase/client";
import { LTA_AREAS, isComplete, type Ratings } from "@/lib/lta";
import { loadChildReports, type AttendanceEntry, type SessionReport } from "./ChildReportsView";

/* ---------------------------------------------------------------- */
/* player_reports                                                     */
/* ---------------------------------------------------------------- */

/** One of the nine areas as parse-report reads it out of the camp PDF. */
export type TalentChar = {
  name: string;
  descriptor: string;
  rating: number; // 1 = Excelling … 4 = Next Step Focus, the LTA scale
};

/** A column of the camp's programme-review table: one rating per area, in talent_characteristics order. */
export type ProgrammeEntry = {
  period: string;
  level: string;
  ratings: (number | null)[];
};

/** A player_reports row — the "performance plan" a parent uploads as a PDF. */
export type PlanReport = {
  id: string;
  child_id: string;
  report_title: string;
  report_date: string;
  programme: string | null;
  national_coach: string | null;
  individual_coach: string | null;
  region: string | null;
  county: string | null;
  talent_characteristics: TalentChar[];
  programme_review: ProgrammeEntry[];
  coach_comments: string | null;
  weekly_schedule: string | null;
  competitive_schedule: string | null;
  report_pdf_url: string | null;
  created_at: string;
  updated_at: string;
};

/* ---------------------------------------------------------------- */
/* The merged shape                                                   */
/* ---------------------------------------------------------------- */

export type ProgressKind = "session" | "plan";

export type ProgressEntry = {
  /** "session:<uuid>" | "plan:<uuid>" — the two tables' ids can never collide as React keys. */
  id: string;
  kind: ProgressKind;
  /** YYYY-MM-DD; the sort key. */
  date: string;
  /** Event title for a session, report_title for a plan. */
  title: string;
  coach_name: string | null;
  /** {area: 1-4}; {} when the plan is PDF-only and nothing was read out of it. */
  ratings: Ratings;
  area_notes: Record<string, string>;
  comment: string | null;
  /** All nine areas rated — the only entries that plot or count as "previous". */
  rated: boolean;
  session: SessionReport | null;
  plan: PlanReport | null;
};

export function fromSession(r: SessionReport): ProgressEntry {
  return {
    id: `session:${r.id}`,
    kind: "session",
    date: r.date,
    title: r.event?.title ?? "Session",
    coach_name: r.coach_name,
    ratings: r.ratings,
    area_notes: r.area_notes,
    comment: r.comment,
    rated: isComplete(r.ratings),
    session: r,
    plan: null,
  };
}

// The PDF parser is not guaranteed to reproduce the LTA names byte for byte,
// so match on a trimmed, case-folded key but store under the canonical name
// that ratings keys everywhere else.
const AREA_BY_KEY = new Map(LTA_AREAS.map((a) => [a.name.trim().toLowerCase(), a.name]));

export function fromPlan(p: PlanReport): ProgressEntry {
  const ratings: Ratings = {};
  for (const tc of p.talent_characteristics ?? []) {
    const area = tc?.name ? AREA_BY_KEY.get(tc.name.trim().toLowerCase()) : undefined;
    if (area && typeof tc.rating === "number") ratings[area] = tc.rating;
  }
  return {
    id: `plan:${p.id}`,
    kind: "plan",
    date: p.report_date.slice(0, 10),
    title: p.report_title,
    coach_name: p.individual_coach ?? p.national_coach ?? null,
    ratings,
    area_notes: {},
    comment: p.coach_comments,
    rated: isComplete(ratings),
    session: null,
    plan: p,
  };
}

const createdAt = (e: ProgressEntry) => e.session?.created_at ?? e.plan?.created_at ?? "";

/** Oldest first so "previous" is simply the rated entry before. */
const chronological = (a: ProgressEntry, b: ProgressEntry) =>
  a.date === b.date ? createdAt(a).localeCompare(createdAt(b)) : a.date.localeCompare(b.date);

/* ---------------------------------------------------------------- */
/* Loading                                                            */
/* ---------------------------------------------------------------- */

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * The JSON columns come back as `Json | null`; an older row on production has
 * `talent_characteristics: []` and a PDF only, and nothing downstream should
 * have to null-check.
 */
async function loadPlans(childId: string): Promise<PlanReport[]> {
  const { data, error } = await supabase.from("player_reports").select("*").eq("child_id", childId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    talent_characteristics: asArray<TalentChar>(row.talent_characteristics),
    programme_review: asArray<ProgrammeEntry>(row.programme_review),
  }) as PlanReport);
}

/**
 * Everything the Performance & Reports view shows: session reports and plans
 * as one list, oldest first, plus the attendance entries. A failure reading
 * player_reports must not take the coach's session reports down with it —
 * the plans simply do not appear.
 */
export type ProgressData = { entries: ProgressEntry[]; attendance: AttendanceEntry[]; warnings: string[] };

export async function loadProgress(childId: string): Promise<ProgressData> {
  // Session reports failing is an error; plans failing must not hide the
  // session reports, but a parent with uploaded plans should not be shown an
  // empty list and invited to upload them again, so the failure is surfaced.
  const warnings: string[] = [];
  const [{ reports, attendance }, plans] = await Promise.all([
    loadChildReports(childId),
    loadPlans(childId).catch(() => { warnings.push("Performance plans could not be loaded just now. Your session reports are shown; please try again shortly."); return [] as PlanReport[]; }),
  ]);
  const entries = [...reports.map(fromSession), ...plans.map(fromPlan)].sort(chronological);
  return { entries, attendance, warnings };
}
