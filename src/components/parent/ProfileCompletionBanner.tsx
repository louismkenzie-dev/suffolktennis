import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronRight, User, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  onGoToParent: () => void;
  onGoToChildren: () => void;
};

type ChecklistItem = { label: string; done: boolean; group: "parent" | "children" };

const ProfileCompletionBanner = ({ onGoToParent, onGoToChildren }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [hasChildren, setHasChildren] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const refresh = async () => {
      const [{ data: profile }, { data: children }] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name,last_name,primary_phone,address_line1,address_city,address_postcode")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("children")
          .select("id,name,date_of_birth,gender,btm_number")
          .eq("parent_user_id", user.id),
      ]);
      if (cancelled) return;

      const kids = children ?? [];
      setHasChildren(kids.length > 0);

      const allKidsHave = (fn: (c: typeof kids[number]) => boolean) =>
        kids.length > 0 && kids.every(fn);

      const list: ChecklistItem[] = [
        { group: "parent", label: "Your name", done: !!(profile?.first_name && profile?.last_name) },
        { group: "parent", label: "Primary phone number", done: !!profile?.primary_phone?.trim() },
        { group: "parent", label: "Home address", done: !!(profile?.address_line1?.trim() && profile?.address_city?.trim() && profile?.address_postcode?.trim()) },
        { group: "children", label: "Add at least one child", done: kids.length > 0 },
        { group: "children", label: "Date of birth for each child", done: allKidsHave((c) => !!c.date_of_birth) },
        { group: "children", label: "Gender for each child", done: allKidsHave((c) => !!c.gender) },
        { group: "children", label: "BTM number for each child", done: allKidsHave((c) => !!c.btm_number?.trim()) },
      ];
      setItems(list);
    };

    refresh();

    // Live updates: refresh whenever this user's profile or any of their children change
    const channel = supabase
      .channel(`profile-completion-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "children", filter: `parent_user_id=eq.${user.id}` }, refresh)
      .subscribe();

    // Also refresh when the tab regains focus (covers any missed events)
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  if (!items) return null;

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / total) * 100);
  if (pct === 100) return null;

  const parentDone = items.filter((i) => i.group === "parent" && i.done).length;
  const parentTotal = items.filter((i) => i.group === "parent").length;
  const childrenDone = items.filter((i) => i.group === "children" && i.done).length;
  const childrenTotal = items.filter((i) => i.group === "children").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border-2 border-lta-cyan/40 bg-gradient-to-br from-lta-cyan/10 via-card to-card shadow-lg overflow-hidden"
    >
      <div className="p-5 md:p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-lta-cyan/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-lta-cyan" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <h3 className="font-display text-lg md:text-xl font-black text-foreground">
              Complete your Parent Hub profile
            </h3>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {hasChildren
                ? "Please finish adding your personal and child details so our coaches and county staff can contact you, invite your child to events and track their progress."
                : "Please add your personal details and register each of your children so our coaches and county staff can contact you and invite them to events."}
            </p>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-display font-bold text-foreground mb-1.5">
                <span>{done} of {total} steps complete</span>
                <span className="text-lta-cyan">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full bg-lta-cyan"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="grid md:grid-cols-2 gap-3 mt-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-lta-cyan" />
                <p className="font-display font-bold text-sm text-foreground">Your details</p>
              </div>
              <span className="text-xs font-body text-muted-foreground">{parentDone}/{parentTotal}</span>
            </div>
            <ul className="space-y-1.5">
              {items.filter((i) => i.group === "parent").map((i) => (
                <li key={i.label} className="flex items-center gap-2 text-sm font-body">
                  {i.done ? (
                    <CheckCircle2 className="w-4 h-4 text-lta-cyan shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                  )}
                  <span className={i.done ? "text-muted-foreground line-through" : "text-foreground"}>{i.label}</span>
                </li>
              ))}
            </ul>
            {parentDone < parentTotal && (
              <button
                onClick={onGoToParent}
                className="mt-3 inline-flex items-center gap-1 text-sm font-display font-bold text-lta-cyan hover:underline"
              >
                Fill in your details <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-lta-cyan" />
                <p className="font-display font-bold text-sm text-foreground">Your children</p>
              </div>
              <span className="text-xs font-body text-muted-foreground">{childrenDone}/{childrenTotal}</span>
            </div>
            <ul className="space-y-1.5">
              {items.filter((i) => i.group === "children").map((i) => (
                <li key={i.label} className="flex items-center gap-2 text-sm font-body">
                  {i.done ? (
                    <CheckCircle2 className="w-4 h-4 text-lta-cyan shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                  )}
                  <span className={i.done ? "text-muted-foreground line-through" : "text-foreground"}>{i.label}</span>
                </li>
              ))}
            </ul>
            {childrenDone < childrenTotal && (
              <button
                onClick={onGoToChildren}
                className="mt-3 inline-flex items-center gap-1 text-sm font-display font-bold text-lta-cyan hover:underline"
              >
                {hasChildren ? "Update your children" : "Add your first child"} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileCompletionBanner;
