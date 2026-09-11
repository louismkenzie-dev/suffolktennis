# Performance & Reports: one section, one button

Status: shipped 11 Sep 2026 (commit 3a29942 on main). Louis: "these 'reports' are the same thing as
performance plan, please make sure these are merged together same logic,
just viewed in 'Performance and Reports' one section one button".

## Why they are the same thing

Two tables, one framework:

| | `session_reports` | `player_reports` |
|---|---|---|
| Written by | a coach, after a session, in the app | the LTA, as an RPC camp PDF a parent uploads (parsed by `parse-report`) |
| Nine LTA areas | `ratings: {area: 1-4}` | `talent_characteristics: [{name, descriptor, rating}]`, same nine names, same scale (verified on production) |
| Notes | `area_notes` per area, `comment` | `coach_comments` |
| Extras | session + event, `sent_at` | `programme_review` table, `weekly_schedule`, `competitive_schedule`, `report_pdf_url` |

Today the child card has two buttons, "Performance plan" (→ `PlayerReportView`,
705 lines, its own radar) and "Reports" (→ `ChildReportsView`, its own radar).
A parent sees the same nine areas charted twice, in two visual languages,
with no way to see a camp report and the sessions since on one trend line.

## The shape of the fix

Derive one shape, render it once. No data migration: the two tables stay,
because a plan carries columns a session report never will. The merge is a
normaliser plus one view.

### `src/components/children/progress.ts` (NEW)

```ts
export type ProgressKind = "session" | "plan";
export type ProgressEntry = {
  id: string;                    // "session:<uuid>" | "plan:<uuid>" — never collides
  kind: ProgressKind;
  date: string;                  // YYYY-MM-DD; sort key
  title: string;                 // event title | report_title
  coach_name: string | null;     // session.coach_name | plan.individual_coach ?? national_coach
  ratings: Ratings;              // {area: 1-4}; {} when the plan is PDF-only
  area_notes: Record<string, string>;
  comment: string | null;        // session.comment | plan.coach_comments
  rated: boolean;                // isComplete(ratings)
  session: SessionReport | null; // full row when kind === "session"
  plan: PlanReport | null;       // full row when kind === "plan"
};
export function fromSession(r: SessionReport): ProgressEntry
export function fromPlan(p: PlanReport): ProgressEntry   // talent_characteristics -> Ratings by name
export async function loadProgress(childId): Promise<{ entries: ProgressEntry[]; attendance: AttendanceEntry[] }>
```

- `loadProgress` calls the existing `loadChildReports` (sessions + attendance)
  AND reads `player_reports` for the child, merges, sorts oldest-first by
  `date` then `created_at`.
- Charts, trends and "previous" comparisons use **only** `rated` entries. A
  PDF-only plan (the older one on production has `talent_characteristics: []`)
  still appears in the list with the PDF, it just does not plot.
- `PlanReport` is the `player_reports` row type. Move it out of
  `PlayerReportView.tsx` into `progress.ts` so nothing imports the old view.

### `ChildReportsView.tsx` becomes the Performance & Reports view

- Eyebrow "Performance & Reports". Description counts entries, not "reports".
- `RatingsRadar`, `TrendGrid`, `AreaRows` are generalised to accept
  `{ ratings, area_notes?, date }` (a `ProgressEntry` satisfies it; a
  `SessionReport` still does, so `ReportPage.tsx` keeps working unchanged).
- Latest / previous = the last two **rated** entries of either kind. The
  "Latest report" surface shows the kind as a badge and the title.
- "All reports" → "Everything", one chronological list, newest first. Each
  row: date, title, coach, and a `StatusBadge` "Session report" or
  "Performance plan". Expanded row:
  - both kinds: `AreaRows` (if rated) + comment
  - session: "Open full report" → `/report/:id` (unchanged)
  - plan: PDF download link (signed url via `useSignedUrl("report-pdfs", …)`),
    an inline PDF viewer toggle, the programme-review table, and weekly /
    competitive schedule text when present. Ported from `PlayerReportView`
    into a new `PlanDetail.tsx`, restyled with the app primitives (Surface,
    ListGroup, KeyValueList) — not the old `motion.div` cards.
- `GoalsTournamentSection` (goals + tournament plan) mounts in this view,
  after the charts and before the list, `sideBySide` on desktop. It was only
  reachable from the Performance plan view; it must not be lost.
- "Upload a performance plan (PDF)" action in the page header. Port
  `handleUploadReport` + `handleParseReport` from `PlayerReportView` into
  `PlanUploadSheet.tsx` (a Dialog, bottom-sheet on phones like every other
  form in the app). Storage path and `manage-reports` body unchanged. After
  upload, reload the view.
- Attendance section stays at the bottom, unchanged.
- Empty state (no entries of either kind): one message covering both — a
  coach's session write-ups AND uploaded LTA camp reports appear here.

### `MyChildrenSection.tsx`

- ONE button per child: `Performance & Reports` (primary, full width of the
  action row), opening `ChildReportsView`. Remove the `Performance plan`
  button, `selectedChild`, `reports`, `reportsLoading`, `handleSelectChild`,
  the `Report` type and the `PlayerReportView` import and render branch.
- The `?reports=<childId>` deep link and `closeReports` stay exactly as they
  are — `BookingDetailDialog`'s "See session reports" link relies on it.
- The `onDeleteChild` path that lived in `PlayerReportView` is not lost:
  `MyChildrenSection` already has `handleDeleteChild`; make sure a parent can
  still remove a child from the edit form or the card. Check
  `EditChildForm` — it has no delete today, so add a "Remove child" row at
  the bottom of `EditChildForm` (danger styling, confirm dialog) wired to the
  existing `handleDeleteChild` logic via a new optional `onDelete` prop.

### Delete `PlayerReportView.tsx`

Nothing may import it afterwards. `grep -rn PlayerReportView src/` must be
empty. Its `ratingConfig` colours are superseded by `LTA_LEVELS` in
`src/lib/lta.ts`.

### Copy and naming

- Button: "Performance & Reports".
- Eyebrow: "Performance & Reports".
- Badges: "Session report", "Performance plan".
- Upload: "Upload a performance plan", helper "The PDF report from an LTA
  camp. Suffolk Tennis reads the nine ratings out of it so it plots
  alongside the coach's session reports."
- Suffolk Tennis is named in the empty state and the upload helper; LTA is
  named only where the framework or the camp genuinely is the LTA's.

### Admin side

`AdminHub` → Progress → "Reports" writes `player_reports` (a coach report
form). Rename that view label to "Performance & Reports" so the two sides
use one name. No behaviour change there.

## Out of scope

- Migrating `player_reports` rows into `session_reports`.
- Changing `/report/:id`.
- Coach-side (`coach/api.ts` `PlayerReport` is the register's per-player
  session report, unrelated to `player_reports` despite the name).

## Verification

- tsc + build clean; `grep -rn PlayerReportView src/` empty.
- Mocked Playwright at 390 and 1280 with one rated plan, one PDF-only plan
  and two session reports for the same child: the trend has three points,
  the list has four rows with the right badges, the PDF-only row expands
  to a download link and no area rows, upload dialog opens, goals section
  present, only ONE button on the child card.
