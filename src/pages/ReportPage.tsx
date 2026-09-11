/**
 * Standalone session performance report — the "View report" button in the
 * coach's email lands here. Sign-in is required (RLS decides visibility);
 * the same building blocks power the Reports view in the Parent Hub.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { EmptyState, FlowShell, ListGroup, ListRow, PageHeader, Section, SkeletonBlock, StatusBadge, Surface } from "@/components/app";
import {
  AreaRows, CoachComment, RatingsRadar, TrendGrid, isUpdated, loadReportWithHistory, longDate, shortDate, type SessionReport,
} from "@/components/children/ChildReportsView";
import { formatTimeRange } from "@/lib/timeFormat";

const BACK = { label: "My children", to: "/parent-hub?tab=children" };

const ReportPage = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{ report: SessionReport; history: SessionReport[] } | null | "loading">("loading");

  // Not signed in: the email link should bring the parent straight back here after sign-in.
  useEffect(() => {
    if (!authLoading && !user) navigate(`/auth?redirect=${encodeURIComponent(`/report/${reportId ?? ""}`)}`, { replace: true });
  }, [authLoading, user, navigate, reportId]);

  useEffect(() => {
    if (!user || !reportId) return;
    let cancelled = false;
    setState("loading");
    loadReportWithHistory(reportId)
      .then((r) => { if (!cancelled) setState(r); })
      .catch(() => { if (!cancelled) setState(null); });
    return () => { cancelled = true; };
    // user?.id rather than user: a token refresh swaps the user object hourly
    // and must not blank the report while it refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reportId]);

  const report = state !== "loading" && state ? state.report : null;
  const history = state !== "loading" && state ? state.history : [];
  const index = report ? history.findIndex((r) => r.id === report.id) : -1;
  const previous = index > 0 ? history[index - 1] : null;
  const earlier = report && index >= 0 ? history.slice(0, index).reverse() : [];
  const later = report && index >= 0 ? history.slice(index + 1).reverse() : [];
  const time = report?.session?.start_time ? formatTimeRange(report.session.start_time, report.session.end_time) : null;
  const firstName = report ? report.child_name.trim().split(/\s+/)[0] : "";

  return (
    <FlowShell back={BACK}>
      {state === "loading" || authLoading || !user ? (
        <div className="space-y-4" aria-busy>
          <SkeletonBlock className="h-16" />
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-48" />
        </div>
      ) : !report ? (
        <EmptyState
          icon={FileQuestion}
          title="Report not found"
          description="This report may not be ready yet, or it belongs to another account. Reports are kept under each child in the Parent Hub."
          action={<Button variant="outline" onClick={() => navigate(BACK.to)}>Go to my children</Button>}
        />
      ) : (
        <div className="space-y-8">
          <PageHeader
            eyebrow="Session report"
            title={report.event?.title ?? "Session"}
            description={
              <>
                {[longDate(report.date), time].filter(Boolean).join(" · ")}
                {report.coach_name ? ` · Coach ${report.coach_name}` : ""}
                <span className="block">{report.child_name}</span>
              </>
            }
            actions={isUpdated(report) ? <StatusBadge tone="info" dot={false}>Updated</StatusBadge> : undefined}
          />

          <Section title={`How ${firstName} did`} description={previous ? `Compared with ${shortDate(previous.date)}.` : "The first report — trends start with the next one."}>
            <Surface className="px-2 pb-3 pt-2 sm:px-4">
              <RatingsRadar latest={report.ratings} previous={previous?.ratings ?? null} latestDate={report.date} previousDate={previous?.date} />
            </Surface>
          </Section>

          <Section title="The nine areas">
            <AreaRows report={report} previous={previous} />
          </Section>

          {report.comment?.trim() && (
            <Section title={report.coach_name ? `${report.coach_name}'s comment` : "Coach's comment"}>
              <CoachComment comment={report.comment} />
            </Section>
          )}

          <Section title="Progress over time" description={history.length < 2 ? "Trend lines appear once there are two or more reports." : "Up is better. Latest level shown on each area."}>
            <TrendGrid reports={history} />
          </Section>

          {[{ title: "Later reports", rows: later }, { title: "Earlier reports", rows: earlier }].filter((g) => g.rows.length > 0).map((g) => (
            <Section key={g.title} title={g.title} count={g.rows.length}>
              <ListGroup>
                {g.rows.map((r) => (
                  <ListRow
                    key={r.id}
                    onClick={() => { navigate(`/report/${r.id}`); window.scrollTo({ top: 0 }); }}
                    title={longDate(r.date)}
                    subtitle={[r.coach_name ? `Coach ${r.coach_name}` : null, r.event?.title].filter(Boolean).join(" · ")}
                    detail="9 areas rated"
                    trailing={isUpdated(r) ? <StatusBadge tone="info" dot={false}>Updated</StatusBadge> : undefined}
                    chevron
                  />
                ))}
              </ListGroup>
            </Section>
          ))}
        </div>
      )}
    </FlowShell>
  );
};

export default ReportPage;
