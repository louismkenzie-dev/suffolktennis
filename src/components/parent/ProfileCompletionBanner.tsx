import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  onGoToParent: () => void;
  onGoToChildren: () => void;
};

type ChecklistItem = { label: string; done: boolean; group: "parent" | "children" };

/**
 * A quiet, single-purpose nudge: how far through set-up the parent is and
 * the one next thing to do. The full checklist folds away on phones so the
 * page's real content is never pushed below the fold.
 */
const ProfileCompletionBanner = ({ onGoToParent, onGoToChildren }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [hasChildren, setHasChildren] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const parentTodo = items.filter((i) => i.group === "parent" && !i.done);
  const childrenTodo = items.filter((i) => i.group === "children" && !i.done);
  // The one next step: children first when none exist, otherwise parent details.
  const next = !hasChildren
    ? { label: "Add your first child", onClick: onGoToChildren }
    : parentTodo.length > 0
      ? { label: "Fill in your details", onClick: onGoToParent }
      : { label: "Update your children", onClick: onGoToChildren };

  const Group = ({ title, list, onClick }: { title: string; list: ChecklistItem[]; onClick: () => void }) => (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {list.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-sm">
            {i.done
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
            <span className={i.done ? "text-muted-foreground line-through" : "text-foreground"}>{i.label}</span>
          </li>
        ))}
      </ul>
      {list.some((i) => !i.done) && (
        <button type="button" onClick={onClick} className="mt-2 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary">
          {title === "Your details" ? "Fill in your details" : hasChildren ? "Update your children" : "Add your first child"} <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-label="Profile completion"
      className="mb-5 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 md:mb-7 md:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-foreground">Finish setting up</h3>
            <span className="shrink-0 text-xs font-medium text-muted-foreground tabular">{done} of {total} · {pct}%</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasChildren
              ? "A few details let coaches contact you and invite your child to sessions."
              : "Add your details and register each child so we can invite them to training and events."}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} className="h-full rounded-full bg-primary" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={next.onClick}>{next.label} <ChevronRight className="h-4 w-4" /></Button>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              className="inline-flex min-h-9 items-center gap-1 px-1 text-sm font-medium text-muted-foreground hover:text-foreground md:hidden"
            >
              {expanded ? "Hide" : "What's missing"} <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>
      <div className={`${expanded ? "grid" : "hidden"} mt-4 gap-4 border-t border-primary/10 pt-4 sm:grid-cols-2 md:grid`}>
        <Group title="Your details" list={items.filter((i) => i.group === "parent")} onClick={onGoToParent} />
        <Group title="Your children" list={items.filter((i) => i.group === "children")} onClick={onGoToChildren} />
      </div>
      {parentTodo.length + childrenTodo.length === 0 ? null : null}
    </motion.section>
  );
};

export default ProfileCompletionBanner;
