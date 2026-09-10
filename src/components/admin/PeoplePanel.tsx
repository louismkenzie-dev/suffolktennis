// Admin "People" tab: the county player database in one place.
//
// The roster (player_roster) is the master list Ollie invites and emails from;
// registered children (children) are what parents create when they sign up.
// The two meet through player_roster.linked_child_id. This page lets an admin
// search and edit the roster, add or remove people, fix age groups and tags in
// bulk, move parents in and out of email groups, and link registered children
// to their roster row — or add them when the LTA export never had them.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link2, Loader2, Pencil, Plus, RefreshCw, Trash2, Unlink, UserPlus, Users } from "lucide-react";

const db = supabase as any;

type RosterRow = {
  id: string; lta_number: string | null; first_name: string; last_name: string;
  gender: string | null; age_group: string | null; contact_email: string | null;
  contact_name: string | null; mobile: string | null; tags: string[] | null;
  linked_child_id: string | null; source: string | null; singles_wtn: number | null;
};
type Child = {
  id: string; name: string; date_of_birth: string | null; gender: string | null;
  parent_user_id: string; parent_email: string | null; parent_name: string | null;
};
type Group = { id: string; name: string; member_count: number };

const AGE_GROUPS = [8, 9, 10, 11, 12, 14, 16, 18];
const ageGroupOf = (dob: string | null): string | null => {
  if (!dob) return null;
  const ageAtYearEnd = new Date().getFullYear() - new Date(dob).getFullYear();
  const g = AGE_GROUPS.find((n) => ageAtYearEnd <= n);
  return g ? `${g}U` : "Open";
};
const fullName = (r: RosterRow) => `${r.first_name} ${r.last_name}`.trim();
const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

/** One call site for admin-email so auth and error shapes stay consistent. */
async function callAdminEmail<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke("admin-email", { body: payload });
  const detail = (data as { error?: string } | null)?.error;
  if (error || detail) throw new Error(detail ?? (error as Error).message);
  return data as T;
}

const blankForm = () => ({
  first_name: "", last_name: "", gender: "", age_group: "", contact_name: "",
  contact_email: "", mobile: "", lta_number: "", tags: "",
});

const PeoplePanel = () => {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [membersByGroup, setMembersByGroup] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");

  // Selection + bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAge, setBulkAge] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Dialogs
  const [editing, setEditing] = useState<RosterRow | "new" | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [linkTarget, setLinkTarget] = useState<RosterRow | null>(null);
  const [linkChildId, setLinkChildId] = useState("");
  const [rosterForChild, setRosterForChild] = useState<Child | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RosterRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rows }, { data: kids }, { data: emails }, { data: profiles }] = await Promise.all([
      db.from("player_roster")
        .select("id, lta_number, first_name, last_name, gender, age_group, contact_email, contact_name, mobile, tags, linked_child_id, source, singles_wtn")
        .order("last_name").order("first_name"),
      db.from("children").select("id, name, date_of_birth, gender, parent_user_id").order("name"),
      db.rpc("get_parent_emails"),
      db.from("profiles").select("user_id, first_name, last_name"),
    ]);
    const emailOf = new Map<string, string>((emails ?? []).map((e: any) => [e.user_id, e.email]));
    const nameOf = new Map<string, string>((profiles ?? []).map((p: any) => [p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
    setRoster(rows ?? []);
    setChildren((kids ?? []).map((k: any) => ({
      ...k,
      parent_email: emailOf.get(k.parent_user_id) ?? null,
      parent_name: nameOf.get(k.parent_user_id) || null,
    })));

    // Email groups are read through admin-email (RLS keeps the tables
    // read-only for the browser, and membership edits go the same way).
    try {
      const { groups: gs } = await callAdminEmail<{ groups: Group[] }>({ action: "groups" });
      setGroups(gs);
      const entries = await Promise.all(gs.map(async (g) => {
        const { members } = await callAdminEmail<{ members: Array<{ email: string }> }>({ action: "group_members", group_id: g.id });
        return [g.id, new Set(members.map((m) => norm(m.email)))] as const;
      }));
      setMembersByGroup(new Map(entries));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load email groups");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    roster.forEach((r) => (r.tags ?? []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [roster]);

  const childById = useMemo(() => new Map(children.map((c) => [c.id, c])), [children]);
  const linkedChildIds = useMemo(() => new Set(roster.map((r) => r.linked_child_id).filter(Boolean) as string[]), [roster]);
  const unlinkedChildren = useMemo(() => children.filter((c) => !linkedChildIds.has(c.id)), [children, linkedChildIds]);

  const groupsOf = useCallback((email: string | null) => {
    const e = norm(email);
    if (!e) return [] as Group[];
    return groups.filter((g) => membersByGroup.get(g.id)?.has(e));
  }, [groups, membersByGroup]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((r) => {
      if (ageFilter !== "all" && (r.age_group ?? "") !== ageFilter) return false;
      if (genderFilter !== "all" && (r.gender ?? "").toLowerCase() !== genderFilter) return false;
      if (tagFilter !== "all" && !(r.tags ?? []).includes(tagFilter)) return false;
      if (linkFilter === "linked" && !r.linked_child_id) return false;
      if (linkFilter === "unlinked" && r.linked_child_id) return false;
      if (q) {
        const hay = `${fullName(r)} ${r.contact_email ?? ""} ${r.contact_name ?? ""} ${r.lta_number ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roster, search, ageFilter, genderFilter, tagFilter, linkFilter]);

  // ---------- edit / add ----------
  const openEdit = (r: RosterRow | "new") => {
    setForm(r === "new" ? blankForm() : {
      first_name: r.first_name, last_name: r.last_name, gender: (r.gender ?? "").toLowerCase(),
      age_group: r.age_group ?? "", contact_name: r.contact_name ?? "", contact_email: r.contact_email ?? "",
      mobile: r.mobile ?? "", lta_number: r.lta_number ?? "", tags: (r.tags ?? []).join(", "),
    });
    setEditing(r);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const first = form.first_name.trim();
    const last = form.last_name.trim();
    if (!first || !last) { toast.error("First and last name are required"); return; }
    setSaving(true);
    const row = {
      first_name: first, last_name: last,
      gender: form.gender || null,
      age_group: form.age_group || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: norm(form.contact_email) || null,
      mobile: form.mobile.trim() || null,
      lta_number: form.lta_number.trim() || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const { error } = editing === "new"
      ? await db.from("player_roster").insert({ ...row, source: "admin" })
      : await db.from("player_roster").update(row).eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing === "new" ? `${first} ${last} added` : `${first} ${last} updated`);
    setEditing(null);
    load();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const { error } = await db.from("player_roster").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${fullName(deleteTarget)} removed from the database`);
    setDeleteTarget(null);
    load();
  };

  // ---------- linking ----------
  const setLink = async (rosterId: string, childId: string | null) => {
    const { error } = await db.from("player_roster").update({ linked_child_id: childId }).eq("id", rosterId);
    if (error) { toast.error(error.message); return; }
    toast.success(childId ? "Linked to the parent's account" : "Unlinked");
    setLinkTarget(null);
    setRosterForChild(null);
    load();
  };

  /** A registered child the LTA export never had: create their roster row. */
  const addChildToRoster = async (c: Child) => {
    const [first, ...rest] = c.name.trim().split(/\s+/);
    const { error } = await db.from("player_roster").insert({
      first_name: first ?? c.name,
      last_name: rest.join(" ") || "—",
      gender: c.gender ?? null,
      age_group: ageGroupOf(c.date_of_birth),
      contact_email: norm(c.parent_email) || null,
      contact_name: c.parent_name,
      linked_child_id: c.id,
      source: "parent-registration",
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${c.name} added to the database and linked`);
    load();
  };

  // ---------- bulk ----------
  const selectedRows = useMemo(() => roster.filter((r) => selected.has(r.id)), [roster, selected]);
  const selectedEmails = useMemo(
    () => [...new Set(selectedRows.map((r) => norm(r.contact_email)).filter(Boolean))],
    [selectedRows],
  );

  const bulk = async (fn: () => Promise<void>, done: string) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try { await fn(); toast.success(done); setSelected(new Set()); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Bulk update failed"); }
    finally { setBulkBusy(false); }
  };

  const applyAge = () => bulk(async () => {
    const { error } = await db.from("player_roster").update({ age_group: bulkAge || null }).in("id", [...selected]);
    if (error) throw new Error(error.message);
  }, `${selected.size} players moved to ${bulkAge || "no age group"}`);

  const applyTag = (add: boolean) => bulk(async () => {
    const tag = bulkTag.trim();
    if (!tag) throw new Error("Type a tag first");
    for (const r of selectedRows) {
      const tags = new Set(r.tags ?? []);
      add ? tags.add(tag) : tags.delete(tag);
      const { error } = await db.from("player_roster").update({ tags: [...tags] }).eq("id", r.id);
      if (error) throw new Error(error.message);
    }
  }, `Tag “${bulkTag.trim()}” ${add ? "added to" : "removed from"} ${selected.size} players`);

  const applyGroup = (add: boolean) => bulk(async () => {
    if (!bulkGroup) throw new Error("Choose a group first");
    if (selectedEmails.length === 0) throw new Error("None of the selected players has a parent email");
    await callAdminEmail({ action: add ? "group_add" : "group_remove", group_id: bulkGroup, emails: selectedEmails });
  }, `${selectedEmails.length} parent${selectedEmails.length === 1 ? "" : "s"} ${add ? "added to" : "removed from"} ${groups.find((g) => g.id === bulkGroup)?.name ?? "the group"}`);

  const removeFromGroup = async (r: RosterRow, g: Group) => {
    try {
      await callAdminEmail({ action: "group_remove", group_id: g.id, emails: [norm(r.contact_email)] });
      toast.success(`${r.contact_email} removed from ${g.name}`);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update the group"); }
  };

  const rosterMatches = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return [] as RosterRow[];
    return roster.filter((r) => !r.linked_child_id && fullName(r).toLowerCase().includes(q)).slice(0, 12);
  }, [roster, rosterSearch]);

  const allShownSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> People</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {roster.length} players on the county database · {children.length} registered by parents · {unlinkedChildren.length} not yet linked
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
            <Button size="sm" onClick={() => openEdit("new")}><Plus className="w-4 h-4 mr-1" /> Add a player</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="players">
            <TabsList>
              <TabsTrigger value="players">Players ({roster.length})</TabsTrigger>
              <TabsTrigger value="unlinked">
                Registered, not on database ({unlinkedChildren.length})
              </TabsTrigger>
            </TabsList>

            {/* ---------------- Players ---------------- */}
            <TabsContent value="players" className="space-y-3 pt-3">
              <div className="flex flex-wrap gap-2">
                <Input placeholder="Search name, parent, email or LTA number…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[14rem]" />
                <Select value={ageFilter} onValueChange={setAgeFilter}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ages</SelectItem>
                    {AGE_GROUPS.map((g) => <SelectItem key={g} value={`${g}U`}>{g}U</SelectItem>)}
                    <SelectItem value="Open">Open</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="male">Boys</SelectItem>
                    <SelectItem value="female">Girls</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Tag" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tags</SelectItem>
                    {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={linkFilter} onValueChange={setLinkFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Linked or not</SelectItem>
                    <SelectItem value="linked">Has an account</SelectItem>
                    <SelectItem value="unlinked">No account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selected.size > 0 && (
                <div className="rounded-md border bg-muted/40 p-3 flex flex-wrap items-end gap-3 text-sm">
                  <span className="font-medium self-center">{selected.size} selected:</span>
                  <div className="flex items-end gap-1">
                    <div>
                      <Label className="text-xs">Age group</Label>
                      <Select value={bulkAge} onValueChange={setBulkAge}>
                        <SelectTrigger className="w-24 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {AGE_GROUPS.map((g) => <SelectItem key={g} value={`${g}U`}>{g}U</SelectItem>)}
                          <SelectItem value="Open">Open</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" variant="outline" className="h-8" disabled={bulkBusy || !bulkAge} onClick={applyAge}>Move</Button>
                  </div>
                  <div className="flex items-end gap-1">
                    <div>
                      <Label className="text-xs">Tag</Label>
                      <Input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} list="people-tags" className="w-40 h-8" placeholder="e.g. 10U county squad" />
                      <datalist id="people-tags">{allTags.map((t) => <option key={t} value={t} />)}</datalist>
                    </div>
                    <Button size="sm" variant="outline" className="h-8" disabled={bulkBusy || !bulkTag.trim()} onClick={() => applyTag(true)}>Add</Button>
                    <Button size="sm" variant="ghost" className="h-8" disabled={bulkBusy || !bulkTag.trim()} onClick={() => applyTag(false)}>Remove</Button>
                  </div>
                  <div className="flex items-end gap-1">
                    <div>
                      <Label className="text-xs">Email group</Label>
                      <Select value={bulkGroup} onValueChange={setBulkGroup}>
                        <SelectTrigger className="w-44 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({g.member_count})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" variant="outline" className="h-8" disabled={bulkBusy || !bulkGroup} onClick={() => applyGroup(true)}>Add</Button>
                    <Button size="sm" variant="ghost" className="h-8" disabled={bulkBusy || !bulkGroup} onClick={() => applyGroup(false)}>Remove</Button>
                  </div>
                  {bulkBusy && <Loader2 className="w-4 h-4 animate-spin self-center" />}
                  <button className="text-xs underline text-muted-foreground self-center ml-auto" onClick={() => setSelected(new Set())}>Clear selection</button>
                </div>
              )}

              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>{filtered.length} shown</span>
                <button className="underline" onClick={() => {
                  const next = new Set(selected);
                  filtered.forEach((r) => allShownSelected ? next.delete(r.id) : next.add(r.id));
                  setSelected(next);
                }}>{allShownSelected ? "Unselect all shown" : "Select all shown"}</button>
              </div>

              <div className="border rounded-md overflow-x-auto max-h-[65vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead className="hidden sm:table-cell">Gender</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead className="hidden lg:table-cell">Tags</TableHead>
                      <TableHead className="hidden lg:table-cell">Email groups</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && roster.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filtered.map((r) => {
                      const child = r.linked_child_id ? childById.get(r.linked_child_id) : null;
                      return (
                        <TableRow key={r.id} className={selected.has(r.id) ? "bg-muted/40" : undefined}>
                          <TableCell>
                            <Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => {
                              const next = new Set(selected);
                              v === true ? next.add(r.id) : next.delete(r.id);
                              setSelected(next);
                            }} />
                          </TableCell>
                          <TableCell>
                            <button className="font-medium text-left hover:underline" onClick={() => openEdit(r)}>{fullName(r)}</button>
                            <div className="text-[11px] text-muted-foreground">
                              {r.lta_number ? `LTA ${r.lta_number}` : "no LTA number"}
                              {r.singles_wtn != null ? ` · WTN ${r.singles_wtn}` : ""}
                              {child ? <span className="text-green-700"> · account linked</span> : ""}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{r.age_group ?? "?"}</Badge></TableCell>
                          <TableCell className="hidden sm:table-cell capitalize text-muted-foreground">{r.gender ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="truncate max-w-[14rem]">{r.contact_email ?? <span className="text-red-600">no email</span>}</div>
                            {r.contact_name && <div className="truncate max-w-[14rem]">{r.contact_name}</div>}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(r.tags ?? []).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {groupsOf(r.contact_email).map((g) => (
                                <Badge key={g.id} variant="outline" className="text-[10px] gap-1">
                                  {g.name}
                                  <button aria-label={`Remove from ${g.name}`} onClick={() => removeFromGroup(r, g)} className="text-muted-foreground hover:text-red-600">×</button>
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                            {child ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8" title={`Unlink from ${child.parent_email ?? "account"}`} onClick={() => setLink(r.id, null)}><Unlink className="w-4 h-4" /></Button>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Link to a registered child" onClick={() => { setLinkChildId(""); setLinkTarget(r); }}><Link2 className="w-4 h-4" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Remove from database" onClick={() => setDeleteTarget(r)}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && filtered.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No players match.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ---------------- Unlinked children ---------------- */}
            <TabsContent value="unlinked" className="space-y-3 pt-3">
              <p className="text-sm text-muted-foreground">
                Children their parents have registered on the site who aren't matched to a row on the county database.
                Add them to the database (they'll be linked automatically) or link them to an existing player.
              </p>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Child</TableHead><TableHead>Age</TableHead><TableHead>Parent</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {unlinkedChildren.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{ageGroupOf(c.date_of_birth) ?? "?"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{c.parent_email ?? "—"}</div>
                          {c.parent_name && <div>{c.parent_name}</div>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="outline" size="sm" className="mr-2" onClick={() => { setRosterSearch(c.name.split(" ").slice(-1)[0] ?? ""); setRosterForChild(c); }}>
                            <Link2 className="w-4 h-4 mr-1" /> Link to existing
                          </Button>
                          <Button size="sm" onClick={() => addChildToRoster(c)}><UserPlus className="w-4 h-4 mr-1" /> Add to database</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {unlinkedChildren.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Every registered child is on the database.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit / add */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing === "new" ? "Add a player" : "Edit player"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div>
              <Label>Age group</Label>
              <Select value={form.age_group} onValueChange={(v) => setForm({ ...form, age_group: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {AGE_GROUPS.map((g) => <SelectItem key={g} value={`${g}U`}>{g}U</SelectItem>)}
                  <SelectItem value="Open">Open</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Boy</SelectItem>
                  <SelectItem value="female">Girl</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Parent name</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div><Label>Parent email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div><Label>LTA number</Label><Input value={form.lta_number} onChange={(e) => setForm({ ...form, lta_number: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Tags (comma separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="10U county squad, 11-18 county squad" />
            </div>
          </div>
          {editing && editing !== "new" && (
            <p className="text-xs text-muted-foreground">
              {editing.linked_child_id
                ? `Linked to ${childById.get(editing.linked_child_id)?.parent_email ?? "a parent account"}.`
                : "Not linked to a parent account — use the link button on the row to match them."}
              {" "}Email group membership is edited from the row.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editing === "new" ? "Add player" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link a roster row to a registered child */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => !o && setLinkTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link {linkTarget ? fullName(linkTarget) : ""} to a parent account</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Only children not already linked to another player are listed.</p>
          <Select value={linkChildId} onValueChange={setLinkChildId}>
            <SelectTrigger><SelectValue placeholder="Choose the registered child" /></SelectTrigger>
            <SelectContent>
              {unlinkedChildren.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} — {c.parent_email ?? "no email"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkTarget(null)}>Cancel</Button>
            <Button disabled={!linkChildId} onClick={() => linkTarget && setLink(linkTarget.id, linkChildId)}>Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link a registered child to an existing roster row */}
      <Dialog open={!!rosterForChild} onOpenChange={(o) => !o && setRosterForChild(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link {rosterForChild?.name} to a database player</DialogTitle></DialogHeader>
          <Input placeholder="Search the database by name…" value={rosterSearch} onChange={(e) => setRosterSearch(e.target.value)} autoFocus />
          <div className="max-h-64 overflow-y-auto divide-y border rounded-md">
            {rosterMatches.map((r) => (
              <button key={r.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => rosterForChild && setLink(r.id, rosterForChild.id)}>
                <span className="font-medium">{fullName(r)}</span>
                <span className="text-muted-foreground text-xs"> · {r.age_group ?? "?"} · {r.contact_email ?? "no email"}</span>
              </button>
            ))}
            {rosterSearch.trim() && rosterMatches.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-4 text-center">No unlinked players match.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget ? fullName(deleteTarget) : ""} from the database?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll disappear from the invite picker and from any roster-based email group. The parent's own
              account and any bookings already made are not affected. You can add them back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PeoplePanel;
