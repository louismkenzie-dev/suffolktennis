import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Loader2, Mail, MailX, Phone, Plus, Search, ShieldCheck, Users,
  UserMinus, UserPlus,
} from "lucide-react";

// The generated Supabase types predate these tables, and the rest of the admin
// panels take the same escape hatch rather than regenerating a 48KB file.
const db = supabase as unknown as {
  from: (t: string) => any;
  functions: { invoke: (n: string, o: unknown) => Promise<{ data: unknown; error: unknown }> };
};

type EmailGroup = { id: string; name: string; managed_key: string | null };

/** One call site for admin-email so auth and error shapes stay consistent. */
async function callAdminEmail<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke("admin-email", { body: payload });
  const detail = (data as { error?: string } | null)?.error;
  if (error || detail) throw new Error(detail ?? (error as Error).message);
  return data as T;
}

const blankCoach = () => ({
  first_name: "", last_name: "", email: "", mobile: "",
  organisation: "", role: "Coach", accreditation_tier: "", qualification_level: "",
  lta_number: "",
});

type Affiliation = { organisation: string; role: string | null };

export type DirectoryCoach = {
  id: string;
  lta_number: string;
  coach_code: string | null;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string | null;
  home_phone: string | null;
  work_phone: string | null;
  accreditation_tier: string | null;
  qualification_level: number | null;
  accreditation_expires: string | null;
  dbs_date: string | null;
  swit_expires: string | null;
  never_call: boolean;
  lta_marketing_opt_in: boolean | null;
  active: boolean;
  county_coach_affiliations: Affiliation[];
};

const fullName = (c: DirectoryCoach) => `${c.first_name} ${c.last_name}`.trim();

/** dd Mmm yyyy, or a dash — these are all plain date columns. */
const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** True when an accreditation or DBS date has already passed. */
const isExpired = (d: string | null) => !!d && d < new Date().toISOString().slice(0, 10);

const CoachDirectory = ({ onEmailCoaches }: { onEmailCoaches?: (groupId: string) => void }) => {
  const [coaches, setCoaches] = useState<DirectoryCoach[]>([]);
  const [unsubscribed, setUnsubscribed] = useState<Set<string>>(new Set());
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [club, setClub] = useState("all");
  const [status, setStatus] = useState("active");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [addToGroup, setAddToGroup] = useState(false);
  const [targetGroup, setTargetGroup] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState("");
  const [addCoach, setAddCoach] = useState(false);
  const [draft, setDraft] = useState(blankCoach());

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: prefs }, { data: gs }] = await Promise.all([
      db.from("county_coaches")
        .select("*, county_coach_affiliations(organisation, role)")
        .order("last_name").order("first_name"),
      db.from("email_preferences").select("email, unsubscribed_at"),
      db.from("email_groups").select("id, name, managed_key").order("name"),
    ]);
    if (error) toast.error(error.message ?? "Could not load the coach directory");
    setCoaches((data as DirectoryCoach[]) ?? []);
    setUnsubscribed(new Set(
      ((prefs as Array<{ email: string; unsubscribed_at: string | null }>) ?? [])
        .filter((p) => p.unsubscribed_at).map((p) => p.email),
    ));
    const list = (gs as EmailGroup[]) ?? [];
    setGroups(list);
    setGroupId(list.find((g) => g.managed_key === "county_coaches")?.id ?? null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const clubs = useMemo(() => {
    const s = new Set<string>();
    coaches.forEach((c) => c.county_coach_affiliations?.forEach((a) => s.add(a.organisation)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [coaches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return coaches.filter((c) => {
      if (status === "active" && !c.active) return false;
      if (status === "inactive" && c.active) return false;
      if (status === "unsubscribed" && !unsubscribed.has(c.email)) return false;
      if (club !== "all" && !c.county_coach_affiliations?.some((a) => a.organisation === club)) return false;
      if (!q) return true;
      return (
        fullName(c).toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.mobile ?? "").includes(q) ||
        c.county_coach_affiliations?.some((a) => a.organisation.toLowerCase().includes(q))
      );
    });
  }, [coaches, search, club, status, unsubscribed]);

  const mailable = useMemo(
    () => coaches.filter((c) => c.active && !unsubscribed.has(c.email)).length,
    [coaches, unsubscribed],
  );

  const setSubscription = async (email: string, subscribe: boolean) => {
    setBusy(email);
    try {
      await callAdminEmail({ action: "set_subscription", email, subscribed: subscribe });
    } catch (e) {
      setBusy(null);
      toast.error(e instanceof Error ? e.message : "Could not update");
      return;
    }
    setBusy(null);
    setUnsubscribed((prev) => {
      const next = new Set(prev);
      if (subscribe) next.delete(email); else next.add(email);
      return next;
    });
    toast.success(subscribe ? "Resubscribed" : "Unsubscribed");
  };

  /**
   * Copy the ticked coaches into a group. This is how a targeted mailing gets
   * built — the directory itself is untouched, so pruning or deleting the
   * group never loses a coach.
   */
  const addSelectedToGroup = async () => {
    const emails = coaches.filter((c) => selected.has(c.id)).map((c) => c.email.toLowerCase());
    if (emails.length === 0) return;
    setBusy("group");
    try {
      // Group writes go through admin-email: RLS on email_groups is read-only
      // for the browser, and the function also seeds unsubscribe tokens.
      let gid = targetGroup;
      if (gid === "__new") {
        const name = newGroupName.trim();
        if (!name) { toast.error("Give the new group a name"); return; }
        const created = await callAdminEmail<{ group: EmailGroup }>({ action: "group_create", name });
        gid = created.group.id;
      }
      if (!gid) { toast.error("Choose a group"); return; }
      await callAdminEmail({ action: "group_add", group_id: gid, emails });
      toast.success(`Added ${emails.length} ${emails.length === 1 ? "coach" : "coaches"} to the group`);
      setAddToGroup(false); setSelected(new Set()); setNewGroupName(""); setTargetGroup("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add to the group");
    } finally { setBusy(null); }
  };

  /** Add someone the LTA report does not cover — a new or non-affiliated coach. */
  const createCoach = async () => {
    const email = draft.email.trim().toLowerCase();
    if (!draft.first_name.trim() || !draft.last_name.trim() || !email) {
      toast.error("First name, last name and email are required"); return;
    }
    setBusy("create");
    try {
      const { data, error } = await db.from("county_coaches").insert({
        // Coaches added by hand have no LTA number; key them on something
        // stable and obviously local so a later LTA import cannot collide.
        lta_number: draft.lta_number.trim() || `LOCAL-${crypto.randomUUID().slice(0, 8)}`,
        first_name: draft.first_name.trim(),
        last_name: draft.last_name.trim(),
        email,
        mobile: draft.mobile.trim() || null,
        accreditation_tier: draft.accreditation_tier.trim() || null,
        qualification_level: draft.qualification_level ? Number(draft.qualification_level) : null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      if (draft.organisation.trim()) {
        await db.from("county_coach_affiliations").insert({
          coach_id: (data as { id: string }).id,
          organisation: draft.organisation.trim(),
          role: draft.role.trim() || "Coach",
        });
      }
      toast.success(`${draft.first_name} ${draft.last_name} added`);
      setAddCoach(false); setDraft(blankCoach()); load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add the coach";
      toast.error(msg.includes("county_coaches_email_key") ? "That email is already in the directory" : msg);
    } finally { setBusy(null); }
  };

  const setActive = async (c: DirectoryCoach, active: boolean) => {
    setBusy(c.id);
    const { error } = await db.from("county_coaches").update({ active }).eq("id", c.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setCoaches((prev) => prev.map((x) => (x.id === c.id ? { ...x, active } : x)));
    toast.success(active ? `${fullName(c)} is back in the directory` : `${fullName(c)} deactivated`);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Suffolk coach directory ({coaches.length})</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Imported from the LTA Coach Affiliation Report. Separate from the coaches above, who are
              the ones published on the website — nothing here is public.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAddCoach(true)}>
              <Plus className="w-4 h-4 mr-2" />Add a coach
            </Button>
            <Button variant="outline" disabled={selected.size === 0}
              onClick={() => { setTargetGroup(""); setAddToGroup(true); }}>
              <Users className="w-4 h-4 mr-2" />
              Add {selected.size || ""} to a group
            </Button>
            <Button
              onClick={() => groupId && onEmailCoaches?.(groupId)}
              disabled={!groupId || mailable === 0}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email all coaches ({mailable})
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name, email, mobile or club"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={club} onValueChange={setClub}>
            <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clubs ({clubs.length})</SelectItem>
              {clubs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Deactivated</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
              <SelectItem value="allrows">Everyone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))}
                      onCheckedChange={(v) => setSelected((prev) => {
                        const next = new Set(prev);
                        filtered.forEach((c) => (v ? next.add(c.id) : next.delete(c.id)));
                        return next;
                      })}
                      aria-label="Select all shown"
                    />
                  </TableHead>
                  <TableHead className="w-8" />
                  <TableHead>Coach</TableHead>
                  <TableHead>Clubs</TableHead>
                  <TableHead>Accreditation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const off = unsubscribed.has(c.email);
                  const open = expanded === c.id;
                  return [
                    <TableRow key={c.id} className={c.active ? "" : "opacity-50"}>
                      <TableCell className="align-top pt-4">
                        <Checkbox
                          checked={selected.has(c.id)}
                          onCheckedChange={(v) => setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(c.id); else next.delete(c.id);
                            return next;
                          })}
                          aria-label={`Select ${fullName(c)}`}
                        />
                      </TableCell>
                      <TableCell className="align-top pt-4">
                        <button onClick={() => setExpanded(open ? null : c.id)} aria-label="Details">
                          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium">{fullName(c)}</div>
                        <div className="text-xs text-muted-foreground break-all">{c.email}</div>
                        {off && <Badge variant="secondary" className="mt-1">Unsubscribed</Badge>}
                        {!c.active && <Badge variant="outline" className="mt-1 ml-1">Deactivated</Badge>}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {(c.county_coach_affiliations ?? []).map((a, i) => (
                            <Badge key={i} variant="outline" className="font-normal">
                              {a.organisation}{a.role && a.role !== "Coach" ? ` · ${a.role}` : ""}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        <div>{c.accreditation_tier ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.qualification_level != null ? `LTA Level ${c.qualification_level} · ` : ""}
                          <span className={isExpired(c.accreditation_expires) ? "text-destructive font-medium" : ""}>
                            expires {fmtDate(c.accreditation_expires)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="outline" disabled={busy === c.email}
                          onClick={() => setSubscription(c.email, off)}
                          title={off ? "Resubscribe to broadcasts" : "Unsubscribe from broadcasts"}>
                          {busy === c.email ? <Loader2 className="w-4 h-4 animate-spin" />
                            : off ? <Mail className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === c.id}
                          onClick={() => setActive(c, !c.active)}
                          title={c.active ? "Remove from the directory" : "Restore to the directory"}>
                          {c.active ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>,
                    open && (
                      <TableRow key={`${c.id}-detail`} className="bg-muted/30">
                        <TableCell />
                        <TableCell />
                        <TableCell colSpan={4} className="text-sm">
                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Contact</p>
                              {c.mobile && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.mobile}</p>}
                              {c.home_phone && <p className="text-muted-foreground">Home: {c.home_phone}</p>}
                              {c.work_phone && <p className="text-muted-foreground">Work: {c.work_phone}</p>}
                              {c.never_call && <Badge variant="destructive" className="mt-1">Do not call</Badge>}
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Safeguarding</p>
                              <p className={isExpired(c.dbs_date) ? "" : ""}>DBS: {fmtDate(c.dbs_date)}</p>
                              <p className={isExpired(c.swit_expires) ? "text-destructive" : ""}>
                                SWIT expires: {fmtDate(c.swit_expires)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">LTA</p>
                              <p>No. {c.lta_number}</p>
                              {c.coach_code && <p className="text-muted-foreground">Code {c.coach_code}</p>}
                              <p className="flex items-center gap-1 text-muted-foreground">
                                <ShieldCheck className="w-3 h-3" />
                                LTA marketing: {c.lta_marketing_opt_in == null ? "unknown" : c.lta_marketing_opt_in ? "opted in" : "opted out"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Roles</p>
                              {(c.county_coach_affiliations ?? []).map((a, i) => (
                                <p key={i} className="text-muted-foreground">{a.role ?? "Coach"} — {a.organisation}</p>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  ];
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No coaches match that search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {coaches.length}. "Email all coaches" goes to the {mailable} active
          coaches who have not unsubscribed. To mail a subset, tick the ones you want and add them to a
          group — the directory is the master list, so emptying or deleting a group never loses anyone.
          The LTA marketing flag in each row is the LTA's own record and does not gate sending.
        </p>
      </CardContent>

      {/* Build a targeted mailing list out of the ticked coaches. */}
      <Dialog open={addToGroup} onOpenChange={setAddToGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {selected.size} {selected.size === 1 ? "coach" : "coaches"} to a group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Group</Label>
              <Select value={targetGroup} onValueChange={setTargetGroup}>
                <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new">➕ New group…</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}{g.managed_key ? " (auto-maintained)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {targetGroup === "__new" && (
              <div>
                <Label>New group name</Label>
                <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Head coaches — west Suffolk" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Coaches stay in the directory either way; this only copies their addresses into the group.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddToGroup(false)}>Cancel</Button>
            <Button onClick={addSelectedToGroup} disabled={busy === "group" || !targetGroup}>
              {busy === "group" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add to group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Someone the LTA report does not cover. */}
      <Dialog open={addCoach} onOpenChange={setAddCoach}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a coach</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>First name *</Label>
              <Input value={draft.first_name} onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} /></div>
            <div><Label>Last name *</Label>
              <Input value={draft.last_name} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Email *</Label>
              <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
            <div><Label>Mobile</Label>
              <Input value={draft.mobile} onChange={(e) => setDraft({ ...draft, mobile: e.target.value })} /></div>
            <div><Label>LTA number</Label>
              <Input value={draft.lta_number} onChange={(e) => setDraft({ ...draft, lta_number: e.target.value })}
                placeholder="Leave blank if they have none" /></div>
            <div><Label>Club or school</Label>
              <Input value={draft.organisation} onChange={(e) => setDraft({ ...draft, organisation: e.target.value })} /></div>
            <div><Label>Role</Label>
              <Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></div>
            <div><Label>Accreditation</Label>
              <Input value={draft.accreditation_tier} onChange={(e) => setDraft({ ...draft, accreditation_tier: e.target.value })}
                placeholder="Registration / Coach Licence" /></div>
            <div><Label>LTA level</Label>
              <Input type="number" min={0} max={5} value={draft.qualification_level}
                onChange={(e) => setDraft({ ...draft, qualification_level: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            They are added to the directory and the auto-maintained coach group, and get an unsubscribe
            link on anything you send.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCoach(false)}>Cancel</Button>
            <Button onClick={createCoach} disabled={busy === "create"}>
              {busy === "create" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add coach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CoachDirectory;
