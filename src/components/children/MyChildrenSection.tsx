import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, User, Calendar, ChevronRight, Trash2, Sparkles, Pencil, Star, Zap, Trophy, CreditCard, RefreshCw, ExternalLink } from "lucide-react";
import freddiePhoto from "@/assets/freddie-sutton.jpeg";
import AddChildForm from "./AddChildForm";
import EditChildForm from "./EditChildForm";
import PlayerReportView from "./PlayerReportView";
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
  }, [user]);

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

  if (selectedChild) {
    if (reportsLoading) {
      return (
        <div className="text-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full mx-auto" />
        </div>
      );
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">My Children</h2>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Add your children's details and view their performance reports.
          </p>
        </div>
        {!showForm && (
          <div className="flex items-center gap-2">
            {children.length === 0 && (
              <button
                onClick={seedDemoData}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground font-display font-bold text-sm hover:bg-muted/80 transition-all disabled:opacity-50"
              >
                <Sparkles size={16} /> {seeding ? "Loading..." : "Load Demo"}
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all"
            >
              <Plus size={16} /> Add Child
            </button>
          </div>
        )}
      </div>

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
        <div className="text-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full mx-auto" />
        </div>
      ) : children.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <User size={40} className="mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-display text-lg font-bold text-foreground mb-2">No Children Added Yet</h3>
          <p className="text-muted-foreground font-body max-w-md mx-auto mb-6">
            Add your child's details so coaches can upload their performance reports.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all"
          >
            <Plus size={16} /> Add Your First Child
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {children.map((child, i) => {
            const age = child.date_of_birth
              ? Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : null;

            // LTA age group: age on Sept 1 of current season
            const getAgeGroup = (dob: string | null): string | null => {
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

            const ageGroup = getAgeGroup(child.date_of_birth);

            return (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 relative"
              >
                {/* Bold ranking badges — top right (large screens only, to avoid overlap on tablet) */}
                {ageGroup && ageGroup !== "8U" && (
                  <div className="hidden lg:flex absolute top-0 right-0 gap-2 p-4 z-10">
                    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/25">
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider leading-none">County</span>
                      <span className="text-xl font-black text-white leading-tight">{(child as any).county_rank ?? "—"}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-lta-cyan to-sky-500 shadow-lg shadow-lta-cyan/25">
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider leading-none">National</span>
                      <span className="text-xl font-black text-white leading-tight">{(child as any).national_rank ?? "—"}</span>
                    </div>
                  </div>
                )}

                <div className="p-6 sm:p-8">
                  <div className="flex items-start gap-4 sm:gap-6 mb-5">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-muted overflow-hidden shrink-0 ring-2 ring-border">
                      <SignedImage
                        bucket="child-photos"
                        value={child.photo_url}
                        alt={child.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="pt-1 lg:pr-40 min-w-0 flex-1">
                      <h3 className="font-display text-xl font-bold text-foreground group-hover:text-lta-cyan transition-colors">{child.name}</h3>
                      {age !== null && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Calendar size={14} /> Age {age}
                        </p>
                      )}
                      {ageGroup && (
                        <span className="inline-block mt-1.5 px-3 py-1 rounded-full bg-lta-cyan/10 text-lta-cyan text-xs font-display font-bold">
                          {ageGroup} Programme
                        </span>
                      )}
                      {child.date_of_birth && (
                        <p className="text-xs text-muted-foreground mt-1">
                          DOB: {new Date(child.date_of_birth).toLocaleDateString("en-GB")}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Inline ranking badges — mobile & tablet */}
                  {ageGroup && ageGroup !== "8U" && (
                    <div className="flex lg:hidden gap-2 mb-4">
                      <div className="flex flex-col items-center justify-center flex-1 py-2 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-md shadow-amber-500/25">
                        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider leading-none">County</span>
                        <span className="text-lg font-black text-white leading-tight">{(child as any).county_rank ?? "—"}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center flex-1 py-2 rounded-xl bg-gradient-to-br from-lta-cyan to-sky-500 shadow-md shadow-lta-cyan/25">
                        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider leading-none">National</span>
                        <span className="text-lg font-black text-white leading-tight">{(child as any).national_rank ?? "—"}</span>
                      </div>
                    </div>
                  )}
                  {ageGroup && ageGroup !== "8U" && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => handleSyncRanking(child)}
                        disabled={syncingId === child.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-lta-cyan/10 text-lta-cyan text-xs font-bold hover:bg-lta-cyan/20 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={syncingId === child.id ? "animate-spin" : ""} />
                        {syncingId === child.id ? "Syncing…" : "Sync rankings from LTA"}
                      </button>
                      <a
                        href={`https://competitions.lta.org.uk/ranking/category.aspx?id=51942`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-lta-cyan transition-colors"
                      >
                        Open LTA <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                  {child.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-2">{child.description}</p>
                  )}
                  {(child.favorite_player || child.favorite_shot) && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {child.favorite_player && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold">
                          <Star size={11} />
                          {getPlayerFlag(child.favorite_player) && (
                            <span className="text-sm leading-none">{getPlayerFlag(child.favorite_player)}</span>
                          )}
                          {child.favorite_player}
                        </span>
                      )}
                      {child.favorite_shot && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-bold">
                          <Zap size={11} /> {child.favorite_shot}
                        </span>
                      )}
                    </div>
                  )}
                  {ageGroup === "8U" && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                        <Trophy size={11} /> Rankings begin at 9U
                      </span>
                    </div>
                  )}
                  {(child as any).btm_number && (
                    <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                      <CreditCard size={11} /> BTM: {(child as any).btm_number}
                    </p>
                  )}
                  {((child as any).has_medical_needs || (child as any).medical_conditions?.length || (child as any).medical_details) && (
                    <div className="mt-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                      <p className="text-xs font-display font-bold text-rose-600 dark:text-rose-400 mb-1">Medical needs</p>
                      {(child as any).medical_conditions?.length > 0 && (
                        <p className="text-xs text-foreground">{(child as any).medical_conditions.join(", ")}</p>
                      )}
                      {(child as any).medical_details && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{(child as any).medical_details}</p>
                      )}
                    </div>
                  )}
                  {((child as any).has_send_needs || (child as any).send_conditions?.length || (child as any).send_details) && (
                    <div className="mt-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                      <p className="text-xs font-display font-bold text-violet-600 dark:text-violet-400 mb-1">SEND / additional needs</p>
                      {(child as any).send_conditions?.length > 0 && (
                        <p className="text-xs text-foreground">{(child as any).send_conditions.join(", ")}</p>
                      )}
                      {(child as any).send_details && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{(child as any).send_details}</p>
                      )}
                    </div>
                  )}
                  {!(child as any).has_medical_needs && !(child as any).has_send_needs && child.medical_needs && (
                    <p className="text-xs text-muted-foreground/70 italic mt-2">Medical: {child.medical_needs}</p>
                  )}
                </div>

                <div className="border-t border-border px-8 py-4 flex items-center gap-3">
                  <button
                    onClick={() => handleSelectChild(child)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all"
                  >
                    View Player Performance Plan <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingChild(child); }}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-lta-cyan hover:border-lta-cyan/30 hover:bg-lta-cyan/5 transition-all font-display font-semibold text-sm"
                    title="Edit child"
                  >
                    <Pencil size={16} />
                    <span>Edit</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default MyChildrenSection;
