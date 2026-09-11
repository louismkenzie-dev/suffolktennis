/**
 * The parts of a performance plan a session report never has: the PDF the
 * parent uploaded, the camp's programme-review table, and the weekly and
 * competitive schedules. The nine ratings and the coach's comment are drawn
 * by the Performance & Reports view with the same rows a session report uses,
 * so this renders only what is plan-specific.
 */
import { useState } from "react";
import { Download, FileSearch, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { LTA_LEVELS } from "@/lib/lta";
import { Button } from "@/components/ui/button";
import { KeyValueList, Surface } from "@/components/app";
import { cn } from "@/lib/utils";
import type { PlanReport } from "./progress";

const levelClasses = (value: number | null) => LTA_LEVELS.find((l) => l.value === value)?.classes ?? "bg-muted text-muted-foreground border-border";

/** Camp periods across, the nine areas down, one coloured cell per rating. */
function ProgrammeReview({ plan }: { plan: PlanReport }) {
  // The parser stores one rating per area in talent_characteristics order,
  // so the rows are only meaningful when that list came through with them.
  const areas = plan.talent_characteristics.map((tc) => tc.name);
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="p-3 text-left text-xs font-medium text-muted-foreground">Area</th>
            {plan.programme_review.map((pr) => (
              <th key={pr.period} scope="col" className="min-w-[84px] p-3 text-center text-xs font-medium text-muted-foreground">
                <div>{pr.level}</div>
                <div className="text-[11px] font-normal text-muted-foreground/70">{pr.period}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {areas.map((name, i) => (
            <tr key={name}>
              <th scope="row" className="p-3 text-left text-[13px] font-medium text-foreground">{name}</th>
              {plan.programme_review.map((pr) => {
                const val = pr.ratings?.[i] ?? null;
                return (
                  <td key={pr.period} className="p-3 text-center">
                    {val === null ? (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    ) : (
                      <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[12px] font-semibold tabular", levelClasses(val))}>{val}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleText({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <div className="space-y-1.5">
      <p className="px-0.5 text-[13px] font-medium text-foreground">{title}</p>
      <Surface inset className="px-4 py-3">
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{text}</p>
      </Surface>
    </div>
  );
}

export default function PlanDetail({ plan, rated, onChanged }: {
  plan: PlanReport;
  /** Whether the nine ratings were read out of the PDF — if not, offer to read them. */
  rated: boolean;
  /** Called after parse-report writes the ratings back, so the view reloads. */
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const pdfUrl = useSignedUrl("report-pdfs", plan.report_pdf_url);
  const [showPdf, setShowPdf] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Same call the upload sheet makes automatically — here for the plan whose
  // automatic read failed or predates the parser.
  const parse = async () => {
    if (!plan.report_pdf_url) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-report", {
        body: { report_id: plan.id, pdf_path: plan.report_pdf_url }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Ratings read", description: "The nine areas were read out of the PDF." });
      onChanged?.();
    } catch (err) {
      toast({ title: "Could not read the PDF", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const details = [
    { label: "Programme", value: plan.programme, hidden: !plan.programme },
    { label: "Region", value: [plan.county, plan.region].filter(Boolean).join(", "), hidden: !plan.county && !plan.region },
    { label: "Individual coach", value: plan.individual_coach, hidden: !plan.individual_coach },
    { label: "National coach", value: plan.national_coach, hidden: !plan.national_coach },
  ];

  return (
    <div className="space-y-3">
      {plan.report_pdf_url && (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className={cn(!pdfUrl && "pointer-events-none opacity-50")}>
            <a href={pdfUrl ?? "#"} target="_blank" rel="noopener noreferrer" aria-disabled={!pdfUrl}>
              <Download /> Download PDF
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPdf((v) => !v)} disabled={!pdfUrl} aria-expanded={showPdf}>
            <FileText /> {showPdf ? "Hide PDF" : "View PDF here"}
          </Button>
          {!rated && (
            <Button variant="tonal" size="sm" onClick={parse} disabled={parsing}>
              <FileSearch /> {parsing ? "Reading…" : "Read the nine ratings from the PDF"}
            </Button>
          )}
        </div>
      )}

      {showPdf && pdfUrl && (
        <Surface className="overflow-hidden">
          <iframe src={pdfUrl} title={`${plan.report_title} PDF`} className="h-[70vh] w-full border-0" />
        </Surface>
      )}

      <KeyValueList items={details} />

      {plan.programme_review.length > 0 && plan.talent_characteristics.length > 0 && (
        <div className="space-y-1.5">
          <p className="px-0.5 text-[13px] font-medium text-foreground">Programme review</p>
          <ProgrammeReview plan={plan} />
        </div>
      )}

      <ScheduleText title="Weekly schedule" text={plan.weekly_schedule} />
      <ScheduleText title="Competitive schedule" text={plan.competitive_schedule} />
    </div>
  );
}
