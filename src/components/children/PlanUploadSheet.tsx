/**
 * Upload an LTA camp report PDF as a performance plan. The file goes to the
 * report-pdfs bucket, manage-reports creates the player_reports row, and
 * parse-report then reads the nine ratings out of the PDF so the plan plots
 * with the coach's session reports. Storage path and request bodies are the
 * ones the old Performance plan view used — the edge functions are unchanged.
 */
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/app";

const DEFAULT_TITLE = "Regional Performance Camp Progress Report";

export default function PlanUploadSheet({ open, onOpenChange, childId, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  /** The row exists (and again once the ratings are read) — reload the view. */
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState(DEFAULT_TITLE);
  const [uploadDate, setUploadDate] = useState("");
  const [uploading, setUploading] = useState(false);

  const close = () => onOpenChange(false);

  const handleUploadReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !uploadFile || !uploadDate) return;
    setUploading(true);
    try {
      // Upload PDF to storage
      const ext = uploadFile.name.split(".").pop();
      const path = `${user.id}/${childId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("report-pdfs").upload(path, uploadFile);
      if (uploadErr) throw uploadErr;

      // Create report via edge function
      const { error: fnErr } = await supabase.functions.invoke("manage-reports", {
        body: {
          action: "add_report",
          child_id: childId,
          report: {
            report_title: uploadTitle.trim(),
            report_date: uploadDate,
            programme: null,
            national_coach: null,
            individual_coach: null,
            region: null,
            county: null,
            talent_characteristics: [],
            programme_review: [],
            coach_comments: null,
            weekly_schedule: null,
            competitive_schedule: null,
            report_pdf_url: path,
          }
        }
      });
      if (fnErr) throw fnErr;
      toast({ title: "Plan uploaded", description: "Reading the nine ratings out of the PDF…" });
      // The row exists: the sheet's job is done. The parse below can take
      // tens of seconds and must not keep the dialog locked, so release it
      // here rather than in a finally that would wait for the parse.
      setUploading(false);
      close();
      setUploadFile(null);
      setUploadDate("");
      onDone();
      void readRatings(path);
    } catch (err) {
      setUploading(false);
      toast({ title: "Could not upload", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  /**
   * Read the nine ratings out of the PDF just uploaded. invoke() resolves
   * with { error } on a non-2xx rather than throwing, so both that and the
   * function's own { error } body have to be checked before claiming success.
   */
  const readRatings = async (path: string) => {
    try {
      const { data: newReports } = await supabase
        .from("player_reports")
        .select("id")
        .eq("child_id", childId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!newReports?.[0]) return;
      const { data, error } = await supabase.functions.invoke("parse-report", {
        body: { report_id: newReports[0].id, pdf_path: path }
      });
      if (error || data?.error) {
        toast({ title: "Could not read the ratings", description: "The plan is saved with its PDF. Open it and try \"Read the nine ratings\" again, or we can add them by hand." });
        return;
      }
      toast({ title: "Ratings read", description: "The nine areas were read out of the PDF." });
      onDone();
    } catch {
      // The plan is listed with its PDF and can be read later from its row.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!uploading) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a performance plan</DialogTitle>
          <DialogDescription>
            The PDF report from an LTA camp. Suffolk Tennis reads the nine ratings out of it so it plots alongside the coach's session reports.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUploadReport} className="space-y-4">
          <Field label="Title" htmlFor="plan-title" required>
            <Input id="plan-title" required value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
          </Field>
          <Field label="Report date" htmlFor="plan-date" required hint="The date on the report, not today.">
            <Input id="plan-date" type="date" required value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
          </Field>
          <Field label="PDF" htmlFor="plan-file" required>
            <Input id="plan-file" type="file" accept=".pdf,application/pdf" required onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className="pt-2.5 md:pt-2" />
          </Field>
          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={close} disabled={uploading}>Cancel</Button>
            <Button type="submit" disabled={uploading || !uploadFile || !uploadDate}>{uploading ? "Uploading…" : "Upload"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
