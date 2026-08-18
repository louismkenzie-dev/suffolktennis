import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, User, MapPin, Calendar, ChevronLeft, Award, Download, ChevronDown, ChevronUp, ExternalLink, Info, Upload, Plus, X, Trophy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import GoalsTournamentSection from "./GoalsTournamentSection";

type TalentChar = {
  name: string;
  descriptor: string;
  rating: number; // 1=Excelling, 2=Consistent, 3=Progressing, 4=Next Step Focus
};

type ProgrammeEntry = {
  period: string;
  level: string;
  ratings: (number | null)[];
};

type Report = {
  id: string;
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
};

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
  description: string | null;
  medical_needs: string | null;
  photo_url: string | null;
  county_rank?: number | null;
  national_rank?: number | null;
};

type Props = {
  child: Child;
  reports: Report[];
  onBack: () => void;
  onReportsChanged?: () => void;
  onDeleteChild?: (childId: string) => void;
};

const ratingConfig: Record<number, { label: string; short: string; color: string; bg: string; bgLight: string; border: string }> = {
  1: { label: "Excelling", short: "EXC", color: "text-emerald-400", bg: "bg-emerald-500", bgLight: "bg-emerald-500/20", border: "border-emerald-500/30" },
  2: { label: "Consistent", short: "CON", color: "text-sky-400", bg: "bg-sky-500", bgLight: "bg-sky-500/20", border: "border-sky-500/30" },
  3: { label: "Progressing", short: "PRO", color: "text-amber-400", bg: "bg-amber-500", bgLight: "bg-amber-500/20", border: "border-amber-500/30" },
  4: { label: "Next Step Focus", short: "NSF", color: "text-rose-400", bg: "bg-rose-500", bgLight: "bg-rose-500/20", border: "border-rose-500/30" },
};

const RatingBadge = ({ rating }: { rating: number }) => {
  const cfg = ratingConfig[rating];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bgLight} ${cfg.color} ${cfg.border} border`}>
      {cfg.label}
    </span>
  );
};

const RadarChart = ({ characteristics }: { characteristics: TalentChar[] }) => {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 95;
  const n = characteristics.length;

  const getPoint = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const ringLabels = ["Excelling", "Consistent", "Progressing", "Next Step"];
  const dataPoints = characteristics.map((c, i) => {
    const val = ((5 - c.rating) / 4) * maxR;
    return getPoint(i, val);
  });

  const pathD = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(187 100% 42%)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(187 100% 42%)" stopOpacity="0.05" />
        </radialGradient>
      </defs>
      {rings.map((r, ri) => (
        <polygon
          key={r}
          points={Array.from({ length: n }, (_, i) => {
            const p = getPoint(i, maxR * r);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="0.5"
          opacity={0.6}
        />
      ))}
      {characteristics.map((_, i) => {
        const p = getPoint(i, maxR);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="hsl(var(--border))" strokeWidth="0.3" opacity={0.4} />;
      })}
      <path d={pathD} fill="url(#radarFill)" stroke="hsl(187 100% 42%)" strokeWidth="2" strokeLinejoin="round" />
      {characteristics.map((c, i) => {
        const p = getPoint(i, maxR + 22);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" className="fill-foreground" fontSize="6.5" fontWeight="700">
            {c.name.length > 16 ? c.name.split(" ").slice(0, 2).join(" ") : c.name}
          </text>
        );
      })}
      {dataPoints.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill="hsl(187 100% 42% / 0.2)" />
          <circle cx={p.x} cy={p.y} r="3" fill="hsl(187 100% 42%)" />
        </g>
      ))}
    </svg>
  );
};

const PlayerReportView = ({ child, reports, onBack, onReportsChanged, onDeleteChild }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedReportIdx, setSelectedReportIdx] = useState(0);
  const [showAllReports, setShowAllReports] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("Regional Performance Camp Progress Report");
  const [uploadDate, setUploadDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const report = reports[selectedReportIdx];
  const childPhotoUrl = useSignedUrl("child-photos", child.photo_url);
  const reportPdfUrl = useSignedUrl("report-pdfs", report?.report_pdf_url);
  const age = child.date_of_birth
    ? Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const hasStructuredData = report?.talent_characteristics && report.talent_characteristics.length > 0;

  const handleParseReport = async (reportToParse: Report) => {
    if (!reportToParse.report_pdf_url) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-report", {
        body: { report_id: reportToParse.id, pdf_path: reportToParse.report_pdf_url }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Report parsed!", description: "Talent characteristics and data have been extracted from the PDF." });
      onReportsChanged?.();
    } catch (err: any) {
      toast({ title: "Parse error", description: err.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !uploadFile || !uploadDate) return;
    setUploading(true);
    try {
      // Upload PDF to storage
      const ext = uploadFile.name.split(".").pop();
      const path = `${user.id}/${child.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("report-pdfs").upload(path, uploadFile);
      if (uploadErr) throw uploadErr;

      // Create report via edge function
      const { error: fnErr } = await supabase.functions.invoke("manage-reports", {
        body: {
          action: "add_report",
          child_id: child.id,
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
      toast({ title: "Report uploaded", description: `Analysing PDF to extract performance data...` });
      setShowUpload(false);
      setUploadFile(null);
      setUploadDate("");
      onReportsChanged?.();

      // Auto-parse the uploaded report in the background
      try {
        const { data: newReports } = await supabase
          .from("player_reports")
          .select("id")
          .eq("child_id", child.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (newReports?.[0]) {
          await supabase.functions.invoke("parse-report", {
            body: { report_id: newReports[0].id, pdf_path: path }
          });
          toast({ title: "Analysis complete", description: "Report data has been extracted from the PDF." });
          onReportsChanged?.();
        }
      } catch {
        // Non-critical - user can manually parse later
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft size={16} /> Back to My Children
      </button>

      {/* Player Header — LTA Style */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl"
      >
        <div className="bg-gradient-to-br from-suffolk-navy via-suffolk-navy to-[hsl(210,60%,15%)] p-6 md:p-8">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-lta-cyan/5 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-lta-cyan via-lta-yellow to-transparent" />
          <div className="flex flex-col sm:flex-row items-start gap-6 relative z-10">
            <div className="w-24 h-24 rounded-2xl bg-primary-foreground/10 overflow-hidden shrink-0 ring-2 ring-lta-cyan/20">
              {childPhotoUrl ? (
                <img src={childPhotoUrl} alt={child.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={40} className="text-primary-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-display text-2xl md:text-3xl font-black text-primary-foreground">{child.name}</h2>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-primary-foreground/60">
                {child.date_of_birth && (
                  <span className="flex items-center gap-1.5"><Calendar size={13} /> DOB: {new Date(child.date_of_birth).toLocaleDateString("en-GB")}{age !== null && ` (Age ${age})`}</span>
                )}
                {report?.county && (
                  <span className="flex items-center gap-1.5"><MapPin size={13} /> {report.county}, {report.region}</span>
                )}
                {report?.programme && (
                  <span className="flex items-center gap-1.5"><Award size={13} /> {report.programme}</span>
                )}
              </div>
              {(() => {
                // Determine age group to check if rankings apply (9U+)
                const getAgeGroup = (dob: string | null) => {
                  if (!dob) return null;
                  const birth = new Date(dob);
                  const now = new Date();
                  const jan1 = new Date(now.getFullYear(), 0, 1);
                  const ageOnJan1 = jan1.getFullYear() - birth.getFullYear() -
                    (jan1 < new Date(jan1.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
                  if (ageOnJan1 <= 7) return "8U";
                  if (ageOnJan1 <= 8) return "9U";
                  if (ageOnJan1 <= 9) return "10U";
                  return "10U+";
                };
                const ag = getAgeGroup(child.date_of_birth);
                const rankingsApply = ag && ag !== "8U";

                return (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-sm text-primary-foreground/60">
                    {rankingsApply ? (
                      <>
                        <span className="flex items-center gap-1.5">
                          <Trophy size={13} className="text-amber-400" /> County: <span className="text-primary-foreground/90 font-bold">{child.county_rank ?? "TBC"}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Trophy size={13} className="text-lta-cyan" /> National: <span className="text-primary-foreground/90 font-bold">{child.national_rank ?? "TBC"}</span>
                        </span>
                        <a
                          href="https://competitions.lta.org.uk/ranking/ranking.aspx?id=50752"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-lta-cyan/70 hover:text-lta-cyan transition-colors"
                        >
                          View LTA Rankings <ExternalLink size={10} />
                        </a>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-primary-foreground/40">
                        <Trophy size={13} /> Rankings begin at 9U ·{" "}
                        <a
                          href="https://competitions.lta.org.uk/ranking/ranking.aspx?id=50752"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-lta-cyan/70 hover:text-lta-cyan transition-colors inline-flex items-center gap-0.5"
                        >
                          View LTA Rankings <ExternalLink size={10} />
                        </a>
                      </span>
                    )}
                  </div>
                );
              })()}
              {report && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-primary-foreground/40">
                  {report.individual_coach && <span>Coach: <span className="text-primary-foreground/70 font-medium">{report.individual_coach}</span></span>}
                  {report.national_coach && <span>National Coach: <span className="text-primary-foreground/70 font-medium">{report.national_coach}</span></span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Goals & Tournament Plan — Side by Side */}
      <GoalsTournamentSection childId={child.id} childName={child.name} sideBySide />

      {/* Upload Report Button + Form */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground">Performance Reports</h3>
        {!showUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all"
          >
            <Upload size={14} /> Upload Report
          </button>
        )}
      </div>

      {showUpload && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h4 className="font-display font-bold text-foreground">Upload RPC Report PDF</h4>
            <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <form onSubmit={handleUploadReport} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Report Title</label>
              <input
                required
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Report Date *</label>
                <input
                  type="date"
                  required
                  value={uploadDate}
                  onChange={e => setUploadDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">PDF File *</label>
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm cursor-pointer hover:border-lta-cyan/50 transition-all">
                  <Upload size={14} className="text-muted-foreground" />
                  <span className={uploadFile ? "text-foreground" : "text-muted-foreground"}>
                    {uploadFile ? uploadFile.name : "Choose PDF..."}
                  </span>
                  <input type="file" accept=".pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={uploading || !uploadFile} className="px-6 py-2.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50">
                {uploading ? "Uploading..." : "Upload Report"}
              </button>
              <button type="button" onClick={() => setShowUpload(false)} className="px-6 py-2.5 rounded-xl bg-muted text-muted-foreground font-display font-bold text-sm hover:bg-muted/80 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {reports.length === 0 && !showUpload ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <FileText size={40} className="mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-display text-lg font-bold text-foreground mb-2">No Reports Yet</h3>
          <p className="text-muted-foreground font-body max-w-md mx-auto">
            Upload your RPC progress reports or wait for your coaching team to add them.
          </p>
        </div>
      ) : reports.length > 0 && (
        <>
          {/* Report selector if multiple */}
          {reports.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {reports.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReportIdx(i)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    i === selectedReportIdx
                      ? "bg-suffolk-navy text-primary-foreground shadow-lg"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {new Date(r.report_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} — {r.report_title.split("—")[0].trim().substring(0, 30)}
                </button>
              ))}
            </div>
          )}

          {/* Report Title Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">{report.report_title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(report.report_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {report.report_pdf_url && !hasStructuredData && (
                <button
                  onClick={() => handleParseReport(report)}
                  disabled={parsing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-suffolk-navy text-primary-foreground text-sm font-display font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {parsing ? (
                    <>
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                      Analysing...
                    </>
                  ) : (
                    <>
                      <FileText size={14} /> Analyse Report
                    </>
                  )}
                </button>
              )}
              {report.report_pdf_url && reportPdfUrl && (
                <a
                  href={reportPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lta-cyan/10 text-lta-cyan text-sm font-display font-bold hover:bg-lta-cyan/20 transition-all"
                >
                  <Download size={14} /> Download PDF
                </a>
              )}
            </div>
          </motion.div>

          {/* PDF Viewer */}
          {report.report_pdf_url && reportPdfUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <iframe
                src={reportPdfUrl}
                className="w-full h-[700px] border-0"
                title={`${report.report_title} PDF`}
              />
            </motion.div>
          )}

          {/* Talent Characteristics — main section */}
          {report.talent_characteristics && report.talent_characteristics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border">
                <h3 className="font-display text-lg font-bold text-foreground">Talent Characteristics</h3>
                <p className="text-xs text-muted-foreground mt-1">Assessment of key performance qualities observed during the camp</p>
              </div>

              <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                {/* Radar */}
                <div className="p-6 flex flex-col items-center justify-center">
                  <RadarChart characteristics={report.talent_characteristics} />
                  <div className="flex flex-wrap justify-center gap-3 mt-5">
                    {Object.entries(ratingConfig).map(([k, v]) => (
                      <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={`w-2.5 h-2.5 rounded-full ${v.bg}`} />
                        {v.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="p-6">
                  <div className="space-y-2">
                    {report.talent_characteristics.map((tc, i) => {
                      const cfg = ratingConfig[tc.rating];
                      const pct = ((5 - tc.rating) / 4) * 100;
                      return (
                        <motion.div
                          key={tc.name}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.04 }}
                          className="group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="text-xs font-bold text-foreground">{tc.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-2 hidden sm:inline">{tc.descriptor}</span>
                            </div>
                            <RatingBadge rating={tc.rating} />
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 1, delay: 0.2 + i * 0.05, ease: "easeOut" }}
                              className={`h-full rounded-full ${cfg?.bg || "bg-muted-foreground"}`}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Programme Review Table */}
          {report.programme_review && report.programme_review.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border">
                <h3 className="font-display text-lg font-bold text-foreground">Programme Review</h3>
                <p className="text-xs text-muted-foreground mt-1">Progress across camp periods</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 pl-6 text-xs font-bold text-muted-foreground">Characteristic</th>
                      {report.programme_review.map((pr) => (
                        <th key={pr.period} className="text-center p-3 text-xs font-bold text-muted-foreground min-w-[90px]">
                          <div>{pr.level}</div>
                          <div className="text-[10px] font-normal text-muted-foreground/60">{pr.period}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.talent_characteristics.map((tc, ti) => (
                      <tr key={tc.name} className="border-b border-border/50 last:border-0">
                        <td className="p-3 pl-6 text-xs font-medium text-foreground">{tc.name}</td>
                        {report.programme_review.map((pr) => {
                          const val = pr.ratings[ti];
                          const cfg = val ? ratingConfig[val] : null;
                          return (
                            <td key={pr.period} className="text-center p-3">
                              {val === null ? (
                                <span className="text-muted-foreground/30 text-xs">N/A</span>
                              ) : (
                                <span className={`inline-flex w-7 h-7 items-center justify-center rounded-lg text-[11px] font-bold ${cfg?.bgLight} ${cfg?.color}`}>
                                  {val}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Coach Comments */}
          {report.coach_comments && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border">
                <h3 className="font-display text-lg font-bold text-foreground">Coach's Assessment</h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-muted-foreground font-body leading-relaxed whitespace-pre-line">{report.coach_comments}</p>
              </div>
            </motion.div>
          )}

          {/* Definitions & Notes */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-muted/50 border border-border rounded-2xl p-6"
          >
            <div className="flex items-start gap-3">
              <Info size={16} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-3 text-xs text-muted-foreground">
                <div>
                  <p className="font-bold text-foreground mb-1">Rating Definitions</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(ratingConfig).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${v.bg}`} />
                        <span><strong>{v.label}:</strong> {
                          k === "1" ? "Shows standout qualities" :
                          k === "2" ? "Reliable and steady" :
                          k === "3" ? "Developing & seen more often" :
                          "Priority area to develop"
                        }</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p>This report is a snapshot based on observations from today's camp, not a full evaluation of the player. Camp invitations are made in isolation — there should be no expectation that a player will attend every camp.</p>
                <p>To maintain the same rating as players move from 8&U into 9&U or 10&U, the qualities shown will need to be displayed at a higher level, as the standard naturally rises with age.</p>
                <a
                  href="https://www.lta.org.uk/compete/performance/aspirational-standards/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-lta-cyan font-medium hover:underline"
                >
                  View LTA Aspirational Standards <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Danger Zone — Delete Child */}
      {onDeleteChild && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-destructive/20 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-display font-bold text-foreground text-sm">Remove {child.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">This will permanently delete this child's profile, goals, schedule, and all reports.</p>
            </div>
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to permanently remove ${child.name}? This cannot be undone.`)) {
                  onDeleteChild(child.id);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-destructive/30 text-destructive text-sm font-display font-bold hover:bg-destructive/10 transition-all shrink-0"
            >
              <Trash2 size={14} /> Remove Child
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PlayerReportView;
