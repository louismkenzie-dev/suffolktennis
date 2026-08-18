import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SignedImage } from "@/components/SignedImage";
import {
  Plus, ChevronLeft, ChevronRight, Clock, MapPin, Trash2, X, Pencil, Repeat,
  Calendar as CalIcon, Target, Dumbbell, Trophy, Activity, BarChart3, Swords
} from "lucide-react";

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
  photo_url: string | null;
};

type ScheduleEntry = {
  id: string;
  child_id: string;
  parent_user_id: string;
  title: string;
  category: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  is_tournament: boolean;
  recurrence_rule: string | null;
  recurrence_end_date: string | null;
  recurrence_group_id: string | null;
};

// ── Categories aligned to LTA Pathway ──────────────────────────
// TENNIS HOURS (Weekly)
//   - Individual Lessons
//   - Squad Training
//   - Free Play / Practice Matches
// ATHLETIC DEVELOPMENT (Weekly)
//   - Tennis Specific (S&C)
//   - Other Sports
// MATCHES (Yearly)
//   - Official Match (singles & doubles)
// OTHER
//   - Tournament (multi-day event)

const CATEGORY_GROUPS = [
  {
    group: "Tennis Hours",
    items: [
      { value: "individual_lesson", label: "Individual Lesson", icon: Target, color: "bg-lta-cyan", textColor: "text-lta-cyan", light: "bg-lta-cyan/10" },
      { value: "squad_training", label: "Squad Training", icon: Activity, color: "bg-sky-500", textColor: "text-sky-400", light: "bg-sky-500/10" },
      { value: "free_play", label: "Free Play / Practice Match", icon: Swords, color: "bg-emerald-500", textColor: "text-emerald-400", light: "bg-emerald-500/10" },
    ],
  },
  {
    group: "Athletic Development",
    items: [
      { value: "tennis_sc", label: "Tennis Specific (S&C)", icon: Dumbbell, color: "bg-violet-500", textColor: "text-violet-400", light: "bg-violet-500/10" },
      { value: "other_sport", label: "Other Sport", icon: Activity, color: "bg-orange-500", textColor: "text-orange-400", light: "bg-orange-500/10" },
    ],
  },
  {
    group: "Matches & Competitions",
    items: [
      { value: "official_match", label: "Official Match", icon: Swords, color: "bg-emerald-600", textColor: "text-emerald-500", light: "bg-emerald-500/10" },
      { value: "tournament", label: "Tournament", icon: Trophy, color: "bg-amber-500", textColor: "text-amber-400", light: "bg-amber-500/10" },
    ],
  },
];

const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.items);

const getCategoryConfig = (cat: string) => {
  // Map legacy categories to new ones
  const legacy: Record<string, string> = {
    tennis_training: "squad_training",
    tennis_match: "official_match",
    physical_training: "tennis_sc",
    coaching: "individual_lesson",
    other: "other_sport",
  };
  const mapped = legacy[cat] || cat;
  return ALL_CATEGORIES.find(c => c.value === mapped) || ALL_CATEGORIES[0];
};

const TENNIS_CATS = ["individual_lesson", "squad_training", "free_play", "tennis_training", "tennis_match", "coaching"];
const ATHLETIC_CATS = ["tennis_sc", "other_sport", "physical_training", "other"];
const MATCH_CATS = ["official_match", "tournament"];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// LTA recommended targets by age group
const LTA_TARGETS: Record<string, {
  tennis: number; // total tennis hours/week
  individual: number; // individual lesson hours/week
  squad: number; // squad training hours/week
  freePlay: number; // free play hours/week
  athletic: number; // total athletic dev hours/week (sessions count)
  sc_sessions: number; // tennis S&C sessions/week
  other_sessions: number; // other sport sessions/week
  matches_yearly: number; // official matches per year
}> = {
  "7U":  { tennis: 4, individual: 1, squad: 2, freePlay: 1, athletic: 4, sc_sessions: 2, other_sessions: 2, matches_yearly: 40 },
  "8U":  { tennis: 5, individual: 1, squad: 3, freePlay: 1, athletic: 5, sc_sessions: 2, other_sessions: 3, matches_yearly: 60 },
  "9U":  { tennis: 8, individual: 2, squad: 4, freePlay: 2, athletic: 6, sc_sessions: 3, other_sessions: 3, matches_yearly: 120 },
  "10U": { tennis: 9, individual: 2, squad: 5, freePlay: 2, athletic: 6, sc_sessions: 3, other_sessions: 3, matches_yearly: 100 },
  "11U": { tennis: 10, individual: 2, squad: 6, freePlay: 2, athletic: 6, sc_sessions: 3, other_sessions: 3, matches_yearly: 80 },
  "12U": { tennis: 12, individual: 3, squad: 7, freePlay: 2, athletic: 7, sc_sessions: 3, other_sessions: 4, matches_yearly: 80 },
  "14U": { tennis: 14, individual: 3, squad: 8, freePlay: 3, athletic: 8, sc_sessions: 4, other_sessions: 4, matches_yearly: 70 },
  "16U": { tennis: 16, individual: 3, squad: 10, freePlay: 3, athletic: 8, sc_sessions: 4, other_sessions: 4, matches_yearly: 60 },
  "18U": { tennis: 18, individual: 4, squad: 10, freePlay: 4, athletic: 8, sc_sessions: 4, other_sessions: 4, matches_yearly: 50 },
};

function getWeekDates(offset: number) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonthDates(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

// ── Activity Form ───────────────────────────────────────────────
const ActivityForm = ({ children, onSaved, onCancel, prefillDate, editEntry }: {
  children: Child[];
  onSaved: () => void;
  onCancel: () => void;
  prefillDate?: string;
  editEntry?: ScheduleEntry | null;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = !!editEntry;

  const [childId, setChildId] = useState(editEntry?.child_id || children[0]?.id || "");
  const [title, setTitle] = useState(editEntry?.title || "");
  const [category, setCategory] = useState(editEntry?.category || "individual_lesson");
  const [eventDate, setEventDate] = useState(editEntry?.event_date || prefillDate || toDateStr(new Date()));
  const [startTime, setStartTime] = useState(editEntry?.start_time?.slice(0, 5) || "09:00");
  const [endTime, setEndTime] = useState(editEntry?.end_time?.slice(0, 5) || "10:00");
  const [duration, setDuration] = useState(editEntry?.duration_minutes || 60);
  const [location, setLocation] = useState(editEntry?.location || "");
  const [notes, setNotes] = useState(editEntry?.notes || "");
  const [isTournament, setIsTournament] = useState(editEntry?.is_tournament || false);
  const [saving, setSaving] = useState(false);

  // Recurrence
  const [repeatType, setRepeatType] = useState<"none" | "weekly">(editEntry?.recurrence_rule ? "weekly" : "none");
  const [repeatDays, setRepeatDays] = useState<number[]>(() => {
    const d = new Date(editEntry?.event_date || prefillDate || toDateStr(new Date()));
    return [d.getDay()];
  });
  const [repeatEndDate, setRepeatEndDate] = useState(editEntry?.recurrence_end_date || "");
  const [ongoing, setOngoing] = useState(!editEntry?.recurrence_end_date && editEntry?.recurrence_rule === "weekly");

  const DAY_LABELS = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
    { value: 0, label: "Sun" },
  ];

  const toggleDay = (day: number) => {
    setRepeatDays(prev =>
      prev.includes(day) ? (prev.length > 1 ? prev.filter(d => d !== day) : prev) : [...prev, day]
    );
  };

  useEffect(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins > 0) setDuration(mins);
    }
  }, [startTime, endTime]);

  useEffect(() => {
    if (repeatType === "weekly" && eventDate) {
      const d = new Date(eventDate);
      const dayNum = d.getDay();
      setRepeatDays(prev => prev.includes(dayNum) ? prev : [...prev, dayNum]);
    }
  }, [eventDate]);

  const generateRecurringDates = (): string[] => {
    const startDate = new Date(eventDate);
    const endDate = ongoing ? new Date(startDate.getTime() + 52 * 7 * 24 * 60 * 60 * 1000) : new Date(repeatEndDate);
    if (!ongoing && !repeatEndDate) return [];

    const dates: string[] = [];
    let current = new Date(startDate);
    const startDay = current.getDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() + mondayOffset);

    let weekCurrent = new Date(weekStart);
    while (weekCurrent <= endDate) {
      for (const day of repeatDays) {
        const offset = day === 0 ? 6 : day - 1;
        const dateForDay = new Date(weekCurrent);
        dateForDay.setDate(weekCurrent.getDate() + offset);
        if (dateForDay >= startDate && dateForDay <= endDate) {
          dates.push(toDateStr(dateForDay));
        }
      }
      weekCurrent.setDate(weekCurrent.getDate() + 7);
    }
    return [...new Set(dates)].sort();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !childId || !title.trim()) return;
    setSaving(true);

    const isMatch = category === "official_match";
    const isTournCat = category === "tournament";

    const baseData = {
      child_id: childId,
      parent_user_id: user.id,
      title: title.trim(),
      category,
      start_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: duration,
      location: location.trim() || null,
      notes: notes.trim() || null,
      is_tournament: isTournCat || isTournament,
      recurrence_rule: repeatType === "weekly" ? `weekly:${repeatDays.sort().join(",")}` : null,
      recurrence_end_date: repeatType === "weekly" && !ongoing && repeatEndDate ? repeatEndDate : null,
    };

    try {
      if (isEdit) {
        const { error } = await supabase.from("sporting_schedule")
          .update({ ...baseData, event_date: eventDate })
          .eq("id", editEntry.id);
        if (error) throw error;
        toast({ title: "Updated", description: `${title} has been updated.` });
      } else if (repeatType === "weekly") {
        const dates = generateRecurringDates();
        if (dates.length === 0) throw new Error("No dates generated. Check your date range.");
        const groupId = crypto.randomUUID();
        for (let i = 0; i < dates.length; i += 100) {
          const chunk = dates.slice(i, i + 100).map(d => ({ ...baseData, event_date: d, recurrence_group_id: groupId }));
          const { error } = await supabase.from("sporting_schedule").insert(chunk);
          if (error) throw error;
        }
        const dayNames = repeatDays.map(d => DAY_LABELS.find(l => l.value === d)?.label).join(", ");
        toast({ title: "Added", description: `${dates.length} sessions created (${dayNames})${ongoing ? " — ongoing" : ""}.` });
      } else {
        const { error } = await supabase.from("sporting_schedule").insert({ ...baseData, event_date: eventDate });
        if (error) throw error;
        toast({ title: "Added", description: `${title} added to schedule.` });
      }
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-bold text-foreground">{isEdit ? "Edit Activity" : "Add Activity"}</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Child *</label>
            <select value={childId} onChange={e => setChildId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50">
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Activity Type</label>
            <select value={category} onChange={e => { setCategory(e.target.value); setIsTournament(e.target.value === "tournament"); }} className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50">
              {CATEGORY_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Title *</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Group coaching session" className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">{isEdit ? "Date *" : "Start Date *"}</label>
            <input type="date" required value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Start</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">End</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Duration (min)</label>
            <input type="number" min={5} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
          </div>
        </div>

        {/* Recurrence section */}
        {!isEdit && (
          <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Repeat size={14} className="text-lta-cyan" />
              <label className="text-sm font-medium text-foreground">Repeat</label>
            </div>
            <select value={repeatType} onChange={e => setRepeatType(e.target.value as any)} className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50">
              <option value="none">No repeat (one-off)</option>
              <option value="weekly">Every week</option>
            </select>

            {repeatType === "weekly" && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Which days?</p>
                  <div className="flex gap-1.5">
                    {DAY_LABELS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`flex-1 py-2 rounded-lg text-xs font-display font-bold transition-all ${
                          repeatDays.includes(d.value)
                            ? "bg-lta-cyan text-suffolk-navy shadow"
                            : "bg-background border border-border text-muted-foreground hover:border-lta-cyan/50"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 items-start">
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2.5 rounded-xl bg-background border border-border">
                    <input
                      type="checkbox"
                      checked={ongoing}
                      onChange={e => setOngoing(e.target.checked)}
                      className="rounded border-border text-lta-cyan focus:ring-lta-cyan/50"
                    />
                    <span className="text-sm text-foreground font-medium">Ongoing (no end date)</span>
                  </label>
                  {!ongoing && (
                    <div>
                      <input type="date" value={repeatEndDate} onChange={e => setRepeatEndDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
                      <p className="text-[10px] text-muted-foreground mt-1">Repeats until this date</p>
                    </div>
                  )}
                </div>

                {(ongoing || repeatEndDate) && (() => {
                  const dates = generateRecurringDates();
                  const dayNames = repeatDays.map(d => DAY_LABELS.find(l => l.value === d)?.label).join(", ");
                  return (
                    <p className="text-xs text-lta-cyan font-medium">
                      Will create {dates.length} session{dates.length !== 1 ? "s" : ""} ({dayNames})
                      {ongoing ? " — ongoing for 1 year" : ""}
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. David Lloyd Ipswich" className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-lta-cyan/50" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50">
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add to Schedule"}
          </button>
          <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl bg-muted text-muted-foreground font-display font-bold text-sm hover:bg-muted/80 transition-all">Cancel</button>
        </div>
      </form>
    </motion.div>
  );
};

// ── Hour Summary Bar ────────────────────────────────────────────
const HourBar = ({ label, hours, target, color, unit = "h" }: { label: string; hours: number; target: number; color: string; unit?: string }) => {
  const pct = Math.min((hours / target) * 100, 100);
  const met = hours >= target;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className={met ? "text-emerald-400 font-bold" : "text-muted-foreground"}>
          {hours.toFixed(1)}{unit} / {target}{unit} {met ? "✓" : ""}
        </span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color} ${met ? "opacity-100" : "opacity-70"}`}
        />
      </div>
    </div>
  );
};

// ── Breakdown Sub-row ───────────────────────────────────────────
const SubRow = ({ label, hours, target, color }: { label: string; hours: number; target: number; color: string }) => {
  const met = hours >= target;
  return (
    <div className="flex items-center justify-between text-[11px] px-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={met ? "text-emerald-400 font-bold" : "text-muted-foreground font-medium"}>
        {hours.toFixed(1)}h / {target}h
      </span>
    </div>
  );
};

// ── Helper: calculate breakdown from entries ────────────────────
function calcBreakdown(entries: ScheduleEntry[]) {
  const individual = entries.filter(e => ["individual_lesson", "coaching"].includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0) / 60;
  const squad = entries.filter(e => ["squad_training", "tennis_training"].includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0) / 60;
  const freePlay = entries.filter(e => e.category === "free_play").reduce((s, e) => s + e.duration_minutes, 0) / 60;
  const totalTennis = individual + squad + freePlay;

  const sc = entries.filter(e => ["tennis_sc", "physical_training"].includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0) / 60;
  const otherSport = entries.filter(e => ["other_sport", "other"].includes(e.category)).reduce((s, e) => s + e.duration_minutes, 0) / 60;
  const totalAthletic = sc + otherSport;

  // Count sessions for athletic dev
  const scSessions = entries.filter(e => ["tennis_sc", "physical_training"].includes(e.category)).length;
  const otherSessions = entries.filter(e => ["other_sport", "other"].includes(e.category)).length;
  const totalAthleticSessions = scSessions + otherSessions;

  const matches = entries.filter(e => ["official_match", "tennis_match"].includes(e.category)).length;
  const tournaments = entries.filter(e => e.is_tournament || e.category === "tournament").length;

  return { individual, squad, freePlay, totalTennis, sc, otherSport, totalAthletic, scSessions, otherSessions, totalAthleticSessions, matches, tournaments };
}

// ── Main Component ──────────────────────────────────────────────
const SportingTimetable = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedChildId, setSelectedChildId] = useState<string | "all">("");
  const [view, setView] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [monthYear, setMonthYear] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });

  useEffect(() => {
    if (!user) return;
    supabase.from("children").select("id, name, date_of_birth, photo_url").eq("parent_user_id", user.id)
      .then(({ data }) => {
        const kids = (data as Child[]) || [];
        setChildren(kids);
        if (!selectedChildId && kids.length > 0) {
          setSelectedChildId(kids[0].id);
        }
      });
  }, [user]);

  const fetchEntries = async () => {
    if (!user) return;
    setLoading(true);
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    const end = new Date();
    end.setMonth(end.getMonth() + 12);
    const { data } = await supabase
      .from("sporting_schedule")
      .select("*")
      .eq("parent_user_id", user.id)
      .gte("event_date", toDateStr(start))
      .lte("event_date", toDateStr(end))
      .order("event_date", { ascending: true });
    setEntries((data as ScheduleEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [user]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const filteredEntries = useMemo(() =>
    selectedChildId === "all" ? entries : entries.filter(e => e.child_id === selectedChildId),
    [entries, selectedChildId]
  );

  const weekEntries = useMemo(() =>
    filteredEntries.filter(e => {
      const d = new Date(e.event_date);
      return d >= weekDates[0] && d <= weekDates[6];
    }),
    [filteredEntries, weekDates]
  );

  const weekBreakdown = useMemo(() => calcBreakdown(weekEntries), [weekEntries]);

  const getChildAgeGroup = (childId: string) => {
    const child = children.find(c => c.id === childId);
    if (!child?.date_of_birth) return "10U";
    const birth = new Date(child.date_of_birth);
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
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

  const ageGroup = useMemo(() => {
    if (selectedChildId !== "all") return getChildAgeGroup(selectedChildId);
    if (children.length === 0) return "10U";
    return getChildAgeGroup(children[0].id);
  }, [selectedChildId, children]);
  const target = LTA_TARGETS[ageGroup] || LTA_TARGETS["10U"];

  // Monthly
  const monthEntries = useMemo(() => {
    const { start, end } = getMonthDates(monthYear.year, monthYear.month);
    return filteredEntries.filter(e => {
      const d = new Date(e.event_date);
      return d >= start && d <= end;
    });
  }, [filteredEntries, monthYear]);

  const monthBreakdown = useMemo(() => calcBreakdown(monthEntries), [monthEntries]);

  // Yearly matches
  const currentYear = new Date().getFullYear();
  const yearEntries = useMemo(() =>
    filteredEntries.filter(e => new Date(e.event_date).getFullYear() === currentYear),
    [filteredEntries, currentYear]
  );
  const yearBreakdown = useMemo(() => calcBreakdown(yearEntries), [yearEntries]);

  const yearTournaments = useMemo(() =>
    filteredEntries.filter(e => e.is_tournament || e.category === "tournament"),
    [filteredEntries]
  );

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sporting_schedule").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchEntries();
    }
  };

  if (children.length === 0 && !loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <CalIcon size={40} className="mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-display text-lg font-bold text-foreground mb-2">Add a Child First</h3>
          <p className="text-muted-foreground font-body max-w-md mx-auto">
            Head to the My Children tab to add your child before setting up their schedule.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Sporting Timetable</h2>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Track training, matches & athletic development against LTA pathway targets.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingEntry(null); setPrefillDate(undefined); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all"
        >
          <Plus size={16} /> Add Activity
        </button>
      </div>

      {(showForm || editingEntry) && (
        <ActivityForm
          children={children}
          prefillDate={prefillDate}
          editEntry={editingEntry}
          onSaved={() => { setShowForm(false); setEditingEntry(null); fetchEntries(); }}
          onCancel={() => { setShowForm(false); setEditingEntry(null); }}
        />
      )}

      {/* Child selector buttons + View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {children.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {children.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedChildId(c.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-bold transition-all ${
                  selectedChildId === c.id
                    ? "bg-suffolk-navy text-primary-foreground shadow-lg"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <SignedImage
                  bucket="child-photos"
                  value={c.photo_url}
                  alt={c.name}
                  className="w-6 h-6 rounded-full object-cover"
                  fallbackClassName="w-6 h-6 rounded-full bg-border flex items-center justify-center text-[10px] font-bold text-muted-foreground"
                  fallbackText={c.name.charAt(0)}
                />
                {c.name.split(" ")[0]}
              </button>
            ))}
            <button
              onClick={() => setSelectedChildId("all")}
              className={`px-4 py-2 rounded-xl text-sm font-display font-bold transition-all ${
                selectedChildId === "all"
                  ? "bg-suffolk-navy text-primary-foreground shadow-lg"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              All Children
            </button>
          </div>
        )}
        <div className="flex rounded-xl bg-muted p-0.5 sm:ml-auto">
          {(["weekly", "monthly", "yearly"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === v ? "bg-suffolk-navy text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "weekly" ? "Weekly" : v === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full mx-auto" />
        </div>
      ) : (
        <>
          {/* ── Weekly View ─────────────────────────────────── */}
          {view === "weekly" && (
            <div className="space-y-6">
              {/* Week navigation */}
              <div className="flex items-center justify-between">
                <button onClick={() => setWeekOffset(o => o - 1)} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all"><ChevronLeft size={18} /></button>
                <div className="text-center">
                  <p className="font-display font-bold text-foreground">
                    {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {weekOffset !== 0 && (
                    <button onClick={() => setWeekOffset(0)} className="text-xs text-lta-cyan hover:underline">Today</button>
                  )}
                </div>
                <button onClick={() => setWeekOffset(o => o + 1)} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all"><ChevronRight size={18} /></button>
              </div>

              {/* Targets summary — LTA Breakdown */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-lta-cyan" />
                  <h4 className="font-display font-bold text-foreground text-sm">Weekly Hours vs LTA Target ({ageGroup})</h4>
                </div>

                {/* Tennis Hours */}
                <div className="space-y-2">
                  <h5 className="text-xs font-display font-bold text-foreground uppercase tracking-wider">Total Tennis Hours</h5>
                  <HourBar label="Tennis Total" hours={weekBreakdown.totalTennis} target={target.tennis} color="bg-lta-cyan" />
                  <div className="ml-2 space-y-1 border-l-2 border-lta-cyan/20 pl-3">
                    <SubRow label="Individual Lessons" hours={weekBreakdown.individual} target={target.individual} color="text-lta-cyan" />
                    <SubRow label="Squad Training" hours={weekBreakdown.squad} target={target.squad} color="text-sky-400" />
                    <SubRow label="Free Play / Practice Matches" hours={weekBreakdown.freePlay} target={target.freePlay} color="text-emerald-400" />
                  </div>
                </div>

                {/* Athletic Development */}
                <div className="space-y-2">
                  <h5 className="text-xs font-display font-bold text-foreground uppercase tracking-wider">Athletic Development</h5>
                  <HourBar label="Athletic Dev Total" hours={weekBreakdown.totalAthletic} target={target.athletic} color="bg-violet-500" />
                  <div className="ml-2 space-y-1 border-l-2 border-violet-500/20 pl-3">
                    <SubRow label="Tennis Specific (S&C)" hours={weekBreakdown.sc} target={0} color="text-violet-400" />
                    <SubRow label="Other Sports" hours={weekBreakdown.otherSport} target={0} color="text-orange-400" />
                    <div className="flex items-center justify-between text-[11px] px-1">
                      <span className="text-muted-foreground">S&C Sessions</span>
                      <span className={`font-medium ${weekBreakdown.scSessions >= target.sc_sessions ? "text-emerald-400 font-bold" : "text-muted-foreground"}`}>
                        {weekBreakdown.scSessions} / {target.sc_sessions} sessions
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] px-1">
                      <span className="text-muted-foreground">Other Sport Sessions</span>
                      <span className={`font-medium ${weekBreakdown.otherSessions >= target.other_sessions ? "text-emerald-400 font-bold" : "text-muted-foreground"}`}>
                        {weekBreakdown.otherSessions} / {target.other_sessions}+ sessions
                      </span>
                    </div>
                  </div>
                </div>

                {/* Yearly Match Counter */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <h5 className="text-xs font-display font-bold text-foreground uppercase tracking-wider">Matches (Yearly — {currentYear})</h5>
                  <HourBar label="Official Matches" hours={yearBreakdown.matches} target={target.matches_yearly} color="bg-emerald-500" unit="" />
                  <p className="text-[10px] text-muted-foreground italic">Official singles & doubles matches tracked year-to-date</p>
                </div>

                {/* Summary stats */}
                <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <p className="text-2xl font-display font-black text-lta-cyan">{weekBreakdown.totalTennis.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Tennis hrs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-display font-black text-violet-400">{weekBreakdown.totalAthletic.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Athletic hrs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-display font-black text-foreground">{(weekBreakdown.totalTennis + weekBreakdown.totalAthletic).toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Total hrs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-display font-black text-emerald-400">{yearBreakdown.matches}</p>
                    <p className="text-[10px] text-muted-foreground">Matches YTD</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-display font-black text-foreground">{weekEntries.length}</p>
                    <p className="text-[10px] text-muted-foreground">Sessions</p>
                  </div>
                </div>
              </div>

              {/* Day columns */}
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((date, di) => {
                  const dateStr = toDateStr(date);
                  const isToday = toDateStr(new Date()) === dateStr;
                  const dayEntries = weekEntries.filter(e => e.event_date === dateStr);

                  return (
                    <div key={di} className={`rounded-2xl border ${isToday ? "border-lta-cyan bg-lta-cyan/5" : "border-border bg-card"} min-h-[160px]`}>
                      <div className={`text-center py-2 border-b ${isToday ? "border-lta-cyan/20" : "border-border"}`}>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{DAYS[di]}</p>
                        <p className={`text-sm font-display font-bold ${isToday ? "text-lta-cyan" : "text-foreground"}`}>
                          {date.getDate()}
                        </p>
                      </div>
                      <div className="p-1.5 space-y-1">
                        {dayEntries.map(entry => {
                          const cfg = getCategoryConfig(entry.category);
                          return (
                            <div key={entry.id} className={`${cfg.light} rounded-lg p-1.5 group relative cursor-pointer`} onClick={() => setEditingEntry(entry)}>
                              <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingEntry(entry); }}
                                  className="w-4 h-4 rounded-full bg-lta-cyan text-suffolk-navy flex items-center justify-center"
                                >
                                  <Pencil size={7} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                  className="w-4 h-4 rounded-full bg-destructive text-primary-foreground flex items-center justify-center"
                                >
                                  <X size={8} />
                                </button>
                              </div>
                              <p className={`text-[9px] font-bold ${cfg.textColor} leading-tight line-clamp-2`}>{entry.title}</p>
                              <p className="text-[8px] text-muted-foreground">{entry.duration_minutes}min</p>
                              {entry.start_time && (
                                <p className="text-[8px] text-muted-foreground">{entry.start_time.slice(0, 5)}</p>
                              )}
                              {entry.recurrence_rule && <Repeat size={7} className="text-muted-foreground mt-0.5" />}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => { setPrefillDate(dateStr); setShowForm(true); }}
                          className="w-full py-1 rounded-lg border border-dashed border-border/50 text-muted-foreground/30 hover:text-lta-cyan hover:border-lta-cyan/30 transition-all"
                        >
                          <Plus size={10} className="mx-auto" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Monthly View ────────────────────────────────── */}
          {view === "monthly" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button onClick={() => setMonthYear(my => { const m = my.month - 1; return m < 0 ? { month: 11, year: my.year - 1 } : { ...my, month: m }; })} className="p-2 rounded-lg bg-muted hover:bg-muted/80"><ChevronLeft size={18} /></button>
                <p className="font-display font-bold text-foreground">
                  {new Date(monthYear.year, monthYear.month).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                </p>
                <button onClick={() => setMonthYear(my => { const m = my.month + 1; return m > 11 ? { month: 0, year: my.year + 1 } : { ...my, month: m }; })} className="p-2 rounded-lg bg-muted hover:bg-muted/80"><ChevronRight size={18} /></button>
              </div>

              {/* Monthly targets */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h4 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-lta-cyan" /> Monthly Summary ({ageGroup})
                </h4>
                <div className="space-y-2">
                  <h5 className="text-xs font-display font-bold text-foreground uppercase tracking-wider">Tennis Hours</h5>
                  <HourBar label="Tennis Total" hours={monthBreakdown.totalTennis} target={target.tennis * 4.3} color="bg-lta-cyan" />
                  <div className="ml-2 space-y-1 border-l-2 border-lta-cyan/20 pl-3">
                    <SubRow label="Individual Lessons" hours={monthBreakdown.individual} target={target.individual * 4.3} color="text-lta-cyan" />
                    <SubRow label="Squad Training" hours={monthBreakdown.squad} target={target.squad * 4.3} color="text-sky-400" />
                    <SubRow label="Free Play / Practice Matches" hours={monthBreakdown.freePlay} target={target.freePlay * 4.3} color="text-emerald-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h5 className="text-xs font-display font-bold text-foreground uppercase tracking-wider">Athletic Development</h5>
                  <HourBar label="Athletic Dev Total" hours={monthBreakdown.totalAthletic} target={target.athletic * 4.3} color="bg-violet-500" />
                </div>
                <div className="flex flex-wrap gap-6 pt-4 border-t border-border">
                  <div><p className="text-2xl font-display font-black text-lta-cyan">{monthBreakdown.totalTennis.toFixed(1)}</p><p className="text-[10px] text-muted-foreground">Tennis hrs</p></div>
                  <div><p className="text-2xl font-display font-black text-violet-400">{monthBreakdown.totalAthletic.toFixed(1)}</p><p className="text-[10px] text-muted-foreground">Athletic hrs</p></div>
                  <div><p className="text-2xl font-display font-black text-emerald-400">{monthBreakdown.matches}</p><p className="text-[10px] text-muted-foreground">Matches</p></div>
                  <div><p className="text-2xl font-display font-black text-foreground">{monthEntries.length}</p><p className="text-[10px] text-muted-foreground">Total sessions</p></div>
                </div>
              </div>

              {/* Weekly breakdown within month */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h4 className="font-display font-bold text-foreground text-sm">Week-by-Week Breakdown</h4>
                </div>
                <div className="divide-y divide-border">
                  {(() => {
                    const { start, end } = getMonthDates(monthYear.year, monthYear.month);
                    const weeks: { start: Date; end: Date; entries: ScheduleEntry[] }[] = [];
                    let ws = new Date(start);
                    while (ws <= end) {
                      const we = new Date(ws);
                      we.setDate(ws.getDate() + 6);
                      const wEntries = monthEntries.filter(e => {
                        const d = new Date(e.event_date);
                        return d >= ws && d <= we;
                      });
                      weeks.push({ start: new Date(ws), end: new Date(we > end ? end : we), entries: wEntries });
                      ws.setDate(ws.getDate() + 7);
                    }
                    return weeks.map((w, wi) => {
                      const wb = calcBreakdown(w.entries);
                      return (
                        <div key={wi} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {w.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {w.end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </p>
                            <p className="text-xs text-muted-foreground">{w.entries.length} sessions</p>
                          </div>
                          <div className="flex gap-4">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${wb.totalTennis >= target.tennis ? "text-emerald-400" : "text-lta-cyan"}`}>{wb.totalTennis.toFixed(1)}h</p>
                              <p className="text-[9px] text-muted-foreground">Tennis</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${wb.totalAthletic >= target.athletic ? "text-emerald-400" : "text-violet-400"}`}>{wb.totalAthletic.toFixed(1)}h</p>
                              <p className="text-[9px] text-muted-foreground">Athletic</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-500">{wb.matches}</p>
                              <p className="text-[9px] text-muted-foreground">Matches</p>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* All entries list */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h4 className="font-display font-bold text-foreground text-sm">All Activities</h4>
                </div>
                {monthEntries.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No activities this month</div>
                ) : (
                  <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                    {monthEntries.map(entry => {
                      const cfg = getCategoryConfig(entry.category);
                      const childName = children.find(c => c.id === entry.child_id)?.name;
                      return (
                        <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${cfg.light} flex items-center justify-center`}>
                              <cfg.icon size={14} className={cfg.textColor} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{entry.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(entry.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                {entry.start_time && ` · ${entry.start_time.slice(0, 5)}`}
                                {childName && ` · ${childName}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">{entry.duration_minutes}min</span>
                            {entry.recurrence_rule && <Repeat size={11} className="text-muted-foreground/40" />}
                            <button onClick={() => setEditingEntry(entry)} className="p-1 rounded text-muted-foreground/20 hover:text-lta-cyan opacity-0 group-hover:opacity-100 transition-all">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(entry.id)} className="p-1 rounded text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Yearly View ──────────────────────────────────── */}
          {view === "yearly" && (
            <div className="space-y-6">
              {/* Yearly Match Tracker */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h4 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
                  <Swords size={16} className="text-emerald-400" /> Match Tracker {currentYear} ({ageGroup})
                </h4>
                <HourBar label="Official Singles & Doubles Matches" hours={yearBreakdown.matches} target={target.matches_yearly} color="bg-emerald-500" unit="" />
                <div className="flex flex-wrap gap-6 pt-3 border-t border-border">
                  <div>
                    <p className="text-3xl font-display font-black text-emerald-400">{yearBreakdown.matches}</p>
                    <p className="text-[10px] text-muted-foreground">Official Matches</p>
                  </div>
                  <div>
                    <p className="text-3xl font-display font-black text-amber-400">{yearBreakdown.tournaments}</p>
                    <p className="text-[10px] text-muted-foreground">Tournaments</p>
                  </div>
                  <div>
                    <p className="text-3xl font-display font-black text-muted-foreground">{target.matches_yearly}+</p>
                    <p className="text-[10px] text-muted-foreground">LTA Target</p>
                  </div>
                </div>
              </div>

              {/* Tournament Planner */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h4 className="font-display font-bold text-foreground text-sm mb-1 flex items-center gap-2">
                  <Trophy size={16} className="text-amber-400" /> Tournament Planner {currentYear}
                </h4>
                <p className="text-xs text-muted-foreground mb-4">All scheduled tournaments and competitions</p>

                {yearTournaments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No tournaments scheduled yet. Add activities with the "Tournament" or "Official Match" category.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from({ length: 12 }, (_, mi) => {
                      const monthTournaments = yearTournaments.filter(t => new Date(t.event_date).getMonth() === mi);
                      if (monthTournaments.length === 0) return null;
                      return (
                        <div key={mi}>
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                            {new Date(currentYear, mi).toLocaleDateString("en-GB", { month: "long" })}
                          </p>
                          <div className="space-y-2">
                            {monthTournaments.map(t => {
                              const childName = children.find(c => c.id === t.child_id)?.name;
                              const cfg = getCategoryConfig(t.category);
                              return (
                                <div key={t.id} className="flex items-center justify-between p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl group">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                      <cfg.icon size={18} className={cfg.textColor} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-foreground">{t.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(t.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                        {t.location && ` · ${t.location}`}
                                        {childName && ` · ${childName}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => setEditingEntry(t)} className="p-1 rounded text-muted-foreground/20 hover:text-lta-cyan opacity-0 group-hover:opacity-100 transition-all">
                                      <Pencil size={13} />
                                    </button>
                                    <button onClick={() => handleDelete(t.id)} className="p-1 rounded text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Yearly calendar grid */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h4 className="font-display font-bold text-foreground text-sm mb-4">Calendar Overview</h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Array.from({ length: 12 }, (_, mi) => {
                    const mEntries = yearEntries.filter(e => new Date(e.event_date).getMonth() === mi);
                    const mb = calcBreakdown(mEntries);
                    return (
                      <div key={mi} className={`rounded-xl border p-3 ${mb.tournaments > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border"}`}>
                        <p className="text-xs font-bold text-foreground mb-1">
                          {new Date(currentYear, mi).toLocaleDateString("en-GB", { month: "short" })}
                        </p>
                        <p className="text-lg font-display font-black text-lta-cyan">{mb.totalTennis.toFixed(0)}<span className="text-[9px] text-muted-foreground font-normal">h</span></p>
                        <p className="text-[9px] text-muted-foreground">{mEntries.length} sessions</p>
                        {mb.matches > 0 && (
                          <p className="text-[9px] font-bold text-emerald-400 mt-1">{mb.matches} match{mb.matches !== 1 ? "es" : ""}</p>
                        )}
                        {mb.tournaments > 0 && (
                          <p className="text-[9px] font-bold text-amber-400">{mb.tournaments} tourn.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default SportingTimetable;
