import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, User, ChevronRight, Sparkles, Pencil, Star, Zap, Trophy, CreditCard, RefreshCw, ExternalLink, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, EmptyState, SkeletonCards } from "@/components/app";
import AddChildForm from "./AddChildForm";
import EditChildForm from "./EditChildForm";
import PlayerReportView from "./PlayerReportView";
import ChildReportsView from "./ChildReportsView";
import { useToast } from "@/hooks/use-toast";
import { SignedImage } from "@/components/SignedImage";
import { getPlayerFlag } from "./playerCountries";

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
  description: string | null;
  medical_needs: string | null;
  photo_url: string | null;
  favorite_player: string | null;
  favorite_shot: string | null;
  county_rank?: number | null;
  national_rank?: number | null;
  btm_number?: string | null;
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
  talent_characteristics: any[];
  programme_review: any[];
  coach_comments: string | null;
  weekly_schedule: string | null;
  competitive_schedule: string | null;
  report_pdf_url: string | null;
};

const MyChildrenSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  // Coach session reports drill-down (the LTA nine-area reports), separate
  // from the performance plan. Deep-linkable as /parent-hub?tab=children&reports=<childId>
  // so a booking's "See session reports" link lands here.
  const [reportsChild, setReportsChild] = useState<Child | null>(null);

  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSyncRanking = async (child: Child) => {
    const ageGroup = (() => {
      if (!child.date_of_birth) return null;
      const birth = new Date(child.date_of_birth);
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);
      const ageOnJan1 = jan1.getFullYear() - birth.getFullYear() -
        (jan1 < new Date(jan1.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
      if (ageOnJan1 <= 7) return "8U";
      if (ageOnJan1 <= 8) return "9U";
      if (ageOnJan1 <= 9) return "10U";
      if (ageOnJan1 <= 10) return "11U";
      if (ageOnJan1 <= 11) return "12U";
      if (ageOnJan1 <= 13) return "14U";
      if (ageOnJan1 <= 15) return "16U";
      if (ageOnJan1 <= 17) return "18U";
      return null;
    })();
    const gender = (child as any).gender as string | undefined;
    if (!ageGroup || ageGroup === "8U") {
      toast({ title: "Not eligible", description: "LTA rankings start at 9U.", variant: "destructive" });
      return;
    }
    setSyncingId(child.id);
    try {
      const { data, error } = await supabase.functions.invoke("lta-rankings", {
        body: {
          name: child.name,
          ageGroup,
          gender,
          dateOfBirth: child.date_of_birth,
          county: "Suffolk",
        },
      });
      if (error) throw error;
      if (!data?.success) {
        toast({
          title: "Could not auto-match",
          description: data?.message || "Open the LTA rankings page to check manually.",
          variant: "destructive",
        });
        return;
      }
      const { error: upErr } = await supabase
        .from("children")
        .update({
          county_rank: data.countyRank ?? null,
          national_rank: data.nationalRank ?? null,
        } as any)
        .eq("id", child.id);
      if (upErr) throw upErr;
      toast({
        title: "Rankings updated",
        description: `Matched ${data.matchedName} · County #${data.countyRank} · National #${data.nationalRank ?? "—"}`,
      });
      fetchChildren();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  const seedDemoData = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      // Create Freddie Sutton as a child
      const { data: child, error: childErr } = await supabase.from("children").insert({
        parent_user_id: user.id,
        name: "Freddie Sutton",
        date_of_birth: "2017-02-12",
        description: "Right-handed player. Loves competing and training at David Lloyd Ipswich. Part of the LTA Regional Performance Camp programme. Confident attacker with great athletic qualities.",
        medical_needs: null,
        photo_url: null,
      }).select().single();

      if (childErr) throw childErr;

      // Insert Freddie's RPC report from the PDF
      const { error: reportErr } = await supabase.functions.invoke("manage-reports", {
        body: {
          action: "add_report",
          child_id: child.id,
          report: {
            report_title: "RPC Progress Report — 9&U Jan/Feb 2026",
            report_date: "2026-02-01",
            programme: "David Lloyd Ipswich",
            national_coach: "Anthony Orton",
            individual_coach: "Ollie Sutton",
            region: "C&E",
            county: "Suffolk",
            talent_characteristics: [
              { name: "Confident to Attack", descriptor: "Proactive, composed, loose", rating: 2 },
              { name: "Comfortable in Rally", descriptor: "Consistency, repeatable, contact point, tempo", rating: 2 },
              { name: "Chases Every Ball", descriptor: "Defending qualities, determined, adaptable", rating: 2 },
              { name: "Creative in Play", descriptor: "Skillfulness, chopper grip, feel, variety, adaptable", rating: 1 },
              { name: "Athletic Qualities", descriptor: "Agility, balance, coordination, speed", rating: 4 },
              { name: "Reads the Ball", descriptor: "Anticipation, perception, tennis specific movement", rating: 3 },
              { name: "Loves the Game", descriptor: "Inner drive, maximises training opportunity", rating: 2 },
              { name: "Loves to Compete", descriptor: "Competitive, commitment, relish challenge", rating: 1 },
            ],
            programme_review: [
              { period: "Sep/Oct-25", level: "RPC - 8&U", ratings: [null, null, null, null, null, null, null, null] },
              { period: "Jan/Feb-26", level: "RPC - 9&U", ratings: [2, 2, 2, 1, 4, 3, 2, 1] },
              { period: "Apr/May-26", level: "RPC - 9&U", ratings: [2, 2, 2, 1, 4, 3, 2, 1] },
            ],
            coach_comments: "Freddie has shown excellent development through the Regional Performance Camp. His attacking confidence and competitive spirit are standout qualities. He's comfortable in the rally with good consistency and contact point. His creativity in play is exceptional — excelling with variety and feel. Athletic qualities remain a focus area, particularly agility, balance, coordination and speed. His ability to read the ball is progressing well with improving anticipation and tennis-specific movement. Freddie's love for the game and desire to compete are clear — he maximises every training opportunity and relishes challenges. A very promising young player with a bright future.",
            weekly_schedule: null,
            competitive_schedule: null,
            report_pdf_url: null,
          }
        }
      });

      if (reportErr) throw new Error("Failed to add report");
      toast({ title: "Demo data added!", description: "Freddie Sutton's profile and RPC report have been created." });
      fetchChildren();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const fetchChildren = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("children")
      .select("*")
      .eq("parent_user_id", user.id)
      .order("created_at", { ascending: true });
    setChildren((data as Child[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchChildren();
    // user?.id, not user: the object is replaced on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (loading || reportsChild) return;
    const wanted = new URLSearchParams(window.location.search).get("reports");
    const match = wanted ? children.find((c) => c.id === wanted) : null;
    if (match) setReportsChild(match);
    // Only on first load of the list — a later change of children should not re-open the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const closeReports = () => {
    setReportsChild(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("reports")) {
      url.searchParams.delete("reports");
      window.history.replaceState(null, "", url.toString());
    }
  };

  const handleSelectChild = async (child: Child) => {
    setSelectedChild(child);
    setReportsLoading(true);
    const { data } = await supabase
      .from("player_reports")
      .select("*")
      .eq("child_id", child.id)
      .order("report_date", { ascending: false });
    setReports((data as Report[]) || []);
    setReportsLoading(false);
  };

  const handleDeleteChild = async (childId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this child?")) return;
    const { error } = await supabase.from("children").delete().eq("id", childId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed", description: "Child removed successfully." });
      fetchChildren();
    }
  };

  if (reportsChild) {
    return <ChildReportsView childId={reportsChild.id} childName={reportsChild.name} onBack={closeReports} />;
  }

  if (selectedChild) {
    if (reportsLoading) {
      return <SkeletonCards count={2} className="md:grid-cols-1 lg:grid-cols-1" />;
    }
    return (
      <PlayerReportView
        child={selectedChild}
        reports={reports}
        onBack={() => setSelectedChild(null)}
        onReportsChanged={() => handleSelectChild(selectedChild)}
        onDeleteChild={async (childId) => {
          const { error } = await supabase.from("children").delete().eq("id", childId);
          if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
          } else {
            toast({ title: "Removed", description: "Child removed successfully." });
            setSelectedChild(null);
            fetchChildren();
          }
        }}
      />
    );
  }

  const ageGroupOf = (dob: string | null): string | null => {
    if (!dob) return null;
    const birth = new Date(dob);
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const ageOnJan1 = jan1.getFullYear() - birth.getFullYear() -
      (jan1 < new Date(jan1.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    if (ageOnJan1 <= 7) return "8U";
    if (ageOnJan1 <= 8) return "9U";
    if (ageOnJan1 <= 9) return "10U";
    if (ageOnJan1 <= 10) return "11U";
    if (ageOnJan1 <= 11) return "12U";
    if (ageOnJan1 <= 13) return "14U";
    if (ageOnJan1 <= 15) return "16U";
    if (ageOnJan1 <= 17) return "18U";
    return "Senior";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      {!showForm && !editingChild && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {children.length === 0 ? "Add your children so coaches can invite them and share reports." : `${children.length} ${children.length === 1 ? "child" : "children"}`}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {children.length === 0 && (
              <Button variant="outline" size="sm" onClick={seedDemoData} disabled={seeding}>
                <Sparkles size={16} /> {seeding ? "Loading…" : "Load demo"}
              </Button>
            )}
            <Button size="sm" onClick={() => setShowForm(true)}><Plus size={16} /> Add child</Button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-6">
          <AddChildForm
            onChildAdded={() => { setShowForm(false); fetchChildren(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {editingChild && (
        <div className="mb-6">
          <EditChildForm
            child={editingChild}
            onSaved={() => { setEditingChild(null); fetchChildren(); }}
            onCancel={() => setEditingChild(null)}
          />
        </div>
      )}

      {loading ? (
        <SkeletonCards count={2} className="md:grid-cols-2 lg:grid-cols-2" />
      ) : children.length === 0 && !showForm ? (
        <EmptyState
          icon={User}
          title="No children added yet"
          description="Add your child's details so coaches can invite them to sessions and upload their performance reports."
          action={<Button onClick={() => setShowForm(true)}><Plus size={16} /> Add your first child</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child, i) => {
            const age = child.date_of_birth
              ? Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : null;
            const ageGroup = ageGroupOf(child.date_of_birth);
            const ranked = ageGroup && ageGroup !== "8U";
            const c = child as any;
            const hasMedical = c.has_medical_needs || c.medical_conditions?.length || c.medical_details;
            const hasSend = c.has_send_needs || c.send_conditions?.length || c.send_details;

            return (
              <motion.article
                key={child.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
              >
                <div className="p-4 md:p-5">
                  <div className="flex items-start gap-4">
                    <button type="button" onClick={() => handleSelectChild(child)} className="press shrink-0 overflow-hidden rounded-2xl bg-muted ring-1 ring-border" aria-label={`Open ${child.name}'s performance plan`}>
                      <div className="h-20 w-20 md:h-24 md:w-24">
                        <SignedImage bucket="child-photos" value={child.photo_url} alt={child.name} className="h-full w-full object-cover" />
                      </div>
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-display text-lg font-semibold leading-tight text-foreground md:text-xl">{child.name}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {[age !== null ? `Age ${age}` : null, child.date_of_birth ? new Date(child.date_of_birth).toLocaleDateString("en-GB") : null].filter(Boolean).join(" · ") || "Date of birth to add"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ageGroup && <StatusBadge tone="brand" dot={false}>{ageGroup} programme</StatusBadge>}
                        {c.btm_number && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"><CreditCard size={11} /> BTM {c.btm_number}</span>}
                      </div>
                    </div>
                  </div>

                  {ranked ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-muted/70 px-3 py-2.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">County rank</p>
                        <p className="mt-0.5 text-xl font-semibold leading-none text-foreground tabular">{c.county_rank ?? "—"}</p>
                      </div>
                      <div className="rounded-xl bg-muted/70 px-3 py-2.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">National rank</p>
                        <p className="mt-0.5 text-xl font-semibold leading-none text-foreground tabular">{c.national_rank ?? "—"}</p>
                      </div>
                      <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button
                          type="button"
                          onClick={() => handleSyncRanking(child)}
                          disabled={syncingId === child.id}
                          className="inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-primary disabled:opacity-50"
                        >
                          <RefreshCw size={13} className={syncingId === child.id ? "animate-spin" : ""} />
                          {syncingId === child.id ? "Syncing…" : "Sync from LTA"}
                        </button>
                        <a href="https://competitions.lta.org.uk/ranking/category.aspx?id=51942" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                          Open LTA <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ) : ageGroup === "8U" ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Trophy size={12} /> Rankings begin at 9U</p>
                  ) : null}

                  {child.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{child.description}</p>}

                  {(child.favorite_player || child.favorite_shot) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {child.favorite_player && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/15">
                          <Star size={11} />
                          {getPlayerFlag(child.favorite_player) && <span className="text-sm leading-none">{getPlayerFlag(child.favorite_player)}</span>}
                          {child.favorite_player}
                        </span>
                      )}
                      {child.favorite_shot && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-600/15">
                          <Zap size={11} /> {child.favorite_shot}
                        </span>
                      )}
                    </div>
                  )}

                  {hasMedical ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
                      <p className="text-xs font-semibold text-red-800">Medical needs</p>
                      {c.medical_conditions?.length > 0 && <p className="mt-0.5 text-xs text-red-900">{c.medical_conditions.join(", ")}</p>}
                      {c.medical_details && <p className="mt-0.5 text-xs text-red-900/80">{c.medical_details}</p>}
                    </div>
                  ) : null}
                  {hasSend ? (
                    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5">
                      <p className="text-xs font-semibold text-violet-800">SEND / additional needs</p>
                      {c.send_conditions?.length > 0 && <p className="mt-0.5 text-xs text-violet-900">{c.send_conditions.join(", ")}</p>}
                      {c.send_details && <p className="mt-0.5 text-xs text-violet-900/80">{c.send_details}</p>}
                    </div>
                  ) : null}
                  {!c.has_medical_needs && !c.has_send_needs && child.medical_needs && (
                    <p className="mt-2 text-xs italic text-muted-foreground">Medical: {child.medical_needs}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-border px-4 py-3 md:px-5">
                  <Button onClick={() => handleSelectChild(child)} className="flex-1">
                    Performance plan <ChevronRight size={16} />
                  </Button>
                  <Button variant="outline" aria-label={`${child.name}'s session reports`} onClick={(e) => { e.stopPropagation(); setReportsChild(child); }}>
                    <BarChart3 size={16} /> Reports
                  </Button>
                  <Button variant="outline" size="icon" aria-label={`Edit ${child.name}`} onClick={(e) => { e.stopPropagation(); setEditingChild(child); }}>
                    <Pencil size={16} />
                  </Button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default MyChildrenSection;
