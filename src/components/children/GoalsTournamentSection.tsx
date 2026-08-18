import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Trophy, Plus, X, Check, Clock, MapPin, ChevronRight,
  Flame, Dumbbell, Crosshair, Brain, Zap, CircleCheckBig, Circle
} from "lucide-react";

type Goal = {
  id: string;
  child_id: string;
  parent_user_id: string;
  title: string;
  description: string | null;
  category: string;
  target_date: string | null;
  progress: number;
  completed: boolean;
  set_by: string | null;
};

type ScheduleEntry = {
  id: string;
  child_id: string;
  title: string;
  category: string;
  event_date: string;
  start_time: string | null;
  duration_minutes: number;
  location: string | null;
  is_tournament: boolean;
};

const GOAL_CATEGORIES = [
  { value: "technical", label: "Technical", icon: Crosshair, color: "text-lta-cyan", bg: "bg-lta-cyan/10" },
  { value: "tactical", label: "Tactical", icon: Brain, color: "text-violet-400", bg: "bg-violet-500/10" },
  { value: "physical", label: "Physical", icon: Dumbbell, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { value: "mental", label: "Mental", icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10" },
  { value: "competition", label: "Competition", icon: Trophy, color: "text-rose-400", bg: "bg-rose-500/10" },
];

const getGoalCategory = (cat: string) => GOAL_CATEGORIES.find(c => c.value === cat) || GOAL_CATEGORIES[0];

const getGoalTerm = (targetDate: string | null): { label: string; color: string; bg: string } => {
  if (!targetDate) return { label: "Ongoing", color: "text-slate-400", bg: "bg-slate-500/10" };
  const daysAway = Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysAway <= 30) return { label: "Short-term", color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (daysAway <= 90) return { label: "Medium-term", color: "text-amber-400", bg: "bg-amber-500/10" };
  return { label: "Long-term", color: "text-violet-400", bg: "bg-violet-500/10" };
};

type Props = {
  childId: string;
  childName: string;
  sideBySide?: boolean;
};

const GoalsTournamentSection = ({ childId, childName, sideBySide = false }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tournaments, setTournaments] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);

  // Form state
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [goalCategory, setGoalCategory] = useState("technical");
  const [goalDate, setGoalDate] = useState("");
  const [goalSetBy, setGoalSetBy] = useState("coach");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [goalsRes, scheduleRes] = await Promise.all([
      supabase.from("tennis_goals").select("*").eq("child_id", childId).order("completed", { ascending: true }).order("target_date", { ascending: true }),
      supabase.from("sporting_schedule").select("*").eq("child_id", childId).gte("event_date", new Date().toISOString().split("T")[0]).order("event_date", { ascending: true }),
    ]);

    setGoals((goalsRes.data as Goal[]) || []);
    const upcoming = ((scheduleRes.data as ScheduleEntry[]) || []).filter(e => e.is_tournament || e.category === "tournament");
    setTournaments(upcoming);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, childId]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !goalTitle.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("tennis_goals").insert({
        child_id: childId,
        parent_user_id: user.id,
        title: goalTitle.trim(),
        description: goalDesc.trim() || null,
        category: goalCategory,
        target_date: goalDate || null,
        set_by: goalSetBy,
      });
      if (error) throw error;
      toast({ title: "Goal added", description: `${goalTitle} added for ${childName}.` });
      setGoalTitle(""); setGoalDesc(""); setGoalDate(""); setShowGoalForm(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleGoalComplete = async (goal: Goal) => {
    const newCompleted = !goal.completed;
    await supabase.from("tennis_goals").update({ completed: newCompleted, progress: newCompleted ? 100 : goal.progress }).eq("id", goal.id);
    fetchData();
  };

  const updateProgress = async (goalId: string, progress: number) => {
    await supabase.from("tennis_goals").update({ progress, completed: progress >= 100 }).eq("id", goalId);
    fetchData();
  };

  const deleteGoal = async (goalId: string) => {
    await supabase.from("tennis_goals").delete().eq("id", goalId);
    fetchData();
  };

  const activeGoals = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-lta-cyan border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className={sideBySide ? "grid lg:grid-cols-2 gap-6" : "space-y-6"}>
      {/* ── Tennis Goals ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lta-cyan/10 flex items-center justify-center">
              <Target size={20} className="text-lta-cyan" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Tennis Goals</h3>
              <p className="text-xs text-muted-foreground">{activeGoals.length} active · {completedGoals.length} completed</p>
            </div>
          </div>
          {!showGoalForm && (
            <button
              onClick={() => setShowGoalForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-lta-cyan/10 text-lta-cyan text-sm font-display font-bold hover:bg-lta-cyan/20 transition-all"
            >
              <Plus size={14} /> Add Goal
            </button>
          )}
        </div>

        {showGoalForm && (
          <div className="p-6 border-b border-border bg-muted/30">
            <form onSubmit={handleAddGoal} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">New Goal</p>
                <button type="button" onClick={() => setShowGoalForm(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
              </div>
              <input required value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="e.g. Improve second serve consistency" className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
              <input value={goalDesc} onChange={e => setGoalDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
              <div className="grid grid-cols-3 gap-3">
                <select value={goalCategory} onChange={e => setGoalCategory(e.target.value)} className="px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50">
                  {GOAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select value={goalSetBy} onChange={e => setGoalSetBy(e.target.value)} className="px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50">
                  <option value="coach">Set by Coach</option>
                  <option value="parent">Set by Parent</option>
                  <option value="player">Set by Player</option>
                </select>
                <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
              </div>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50">
                {saving ? "Saving..." : "Add Goal"}
              </button>
            </form>
          </div>
        )}

        <div className="divide-y divide-border">
          {activeGoals.length === 0 && completedGoals.length === 0 ? (
            <div className="p-8 text-center">
              <Target size={32} className="mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No goals set yet. Add a goal to start tracking progress.</p>
            </div>
          ) : (
            <>
              {activeGoals.map((goal) => {
                const cfg = getGoalCategory(goal.category);
                return (
                  <div key={goal.id} className="p-5 hover:bg-muted/20 transition-colors group">
                    <div className="flex items-start gap-4">
                      <button onClick={() => toggleGoalComplete(goal)} className="mt-0.5 shrink-0">
                        <Circle size={22} className="text-muted-foreground/30 hover:text-lta-cyan transition-colors" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                            <cfg.icon size={10} /> {cfg.label}
                          </span>
                          {(() => {
                            const term = getGoalTerm(goal.target_date);
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${term.bg} ${term.color}`}>
                                {term.label}
                              </span>
                            );
                          })()}
                          {goal.set_by && (
                            <span className="text-[10px] text-muted-foreground/50">Set by {goal.set_by}</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-foreground">{goal.title}</p>
                        {goal.description && <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>}
                        {goal.target_date && (
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock size={10} /> Target: {new Date(goal.target_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                        {/* Progress bar */}
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${goal.progress}%` }}
                              transition={{ duration: 0.6 }}
                              className="h-full rounded-full bg-lta-cyan"
                            />
                          </div>
                          <span className="text-xs font-bold text-foreground w-10 text-right">{goal.progress}%</span>
                        </div>
                        {/* Progress quick buttons */}
                        <div className="flex items-center gap-1 mt-2">
                          {[0, 25, 50, 75, 100].map(p => (
                            <button
                              key={p}
                              onClick={() => updateProgress(goal.id, p)}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                goal.progress === p ? "bg-lta-cyan text-suffolk-navy" : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => deleteGoal(goal.id)} className="p-1 text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {completedGoals.length > 0 && (
                <>
                  <div className="px-5 py-3 bg-muted/30">
                    <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <Check size={12} /> Completed ({completedGoals.length})
                    </p>
                  </div>
                  {completedGoals.map((goal) => {
                    const cfg = getGoalCategory(goal.category);
                    return (
                      <div key={goal.id} className="p-5 opacity-60 group">
                        <div className="flex items-start gap-4">
                          <button onClick={() => toggleGoalComplete(goal)} className="mt-0.5 shrink-0">
                            <CircleCheckBig size={22} className="text-emerald-400" />
                          </button>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground line-through">{goal.title}</p>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color} mt-1`}>
                              <cfg.icon size={10} /> {cfg.label}
                            </span>
                          </div>
                          <button onClick={() => deleteGoal(goal.id)} className="p-1 text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* ── Upcoming Tournament Plan ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Trophy size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Tournament Plan</h3>
              <p className="text-xs text-muted-foreground">
                {tournaments.length} upcoming event{tournaments.length !== 1 ? "s" : ""} · Add tournaments in the Sporting Timetable tab
              </p>
            </div>
          </div>
        </div>

        {tournaments.length === 0 ? (
          <div className="p-8 text-center">
            <Trophy size={32} className="mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground mb-1">No upcoming tournaments scheduled.</p>
            <p className="text-xs text-muted-foreground/60">Add tournaments via the Sporting Timetable tab to see them here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Group by month */}
            {(() => {
              const months = new Map<string, ScheduleEntry[]>();
              tournaments.forEach(t => {
                const key = new Date(t.event_date).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
                if (!months.has(key)) months.set(key, []);
                months.get(key)!.push(t);
              });
              return Array.from(months.entries()).map(([month, events]) => (
                <div key={month}>
                  <div className="px-6 py-2.5 bg-muted/30">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{month}</p>
                  </div>
                  {events.map(event => {
                    const d = new Date(event.event_date);
                    const daysAway = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={event.id} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                        <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex flex-col items-center justify-center shrink-0">
                          <span className="text-lg font-display font-black text-amber-400">{d.getDate()}</span>
                          <span className="text-[9px] font-bold text-amber-400/60 uppercase">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{event.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {event.location && (
                              <span className="flex items-center gap-1"><MapPin size={11} /> {event.location}</span>
                            )}
                            {event.start_time && (
                              <span className="flex items-center gap-1"><Clock size={11} /> {event.start_time.slice(0, 5)}</span>
                            )}
                            <span>{event.duration_minutes}min</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-bold ${daysAway <= 7 ? "text-amber-400" : "text-muted-foreground"}`}>
                            {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway} days`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default GoalsTournamentSection;
