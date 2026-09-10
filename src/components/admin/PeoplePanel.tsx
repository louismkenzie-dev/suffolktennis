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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ChevronRight, Link2, Loader2, Pencil, Plus, RefreshCw, Trash2, Unlink, UserPlus, Users } from "lucide-react";
import {
  PageHeader, SegmentedControl, SearchField, Chip, ChipRow, ListGroup, ListRow, EmptyState, SkeletonRows,
  ActionBar, FilterButton, FilterSheet,
} from "@/components/app";

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
    setEditing(null);
    load();
  };

  // ---------- linking ----------
  const setLink = async (rosterId: string, childId: string | null) => {
    const { error } = await db.from("player_roster").update({ linked_child_id: childId }).eq("id", rosterId);
    if (error) { toast.error(error.message); return; }
    toast.success(childId ? "Linked to the parent's account" : "Unlinked");
    setLinkTarget(null);
    setRosterForChild(null);
    setEditing(null);
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
  const [tab, setTab] = useState<"players" | "unlinked">("players");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const activeFilters = [genderFilter, tagFilter, linkFilter].filter((v) => v !== "all").length;
  const resetFilters = () => { setAgeFilter("all"); setGenderFilter("all"); setTagFilter("all"); setLinkFilter("all"); };
  const toggleSelected = (id: string, on: boolean) => {
    const next = new Set(selected);
    on ? next.add(id) : next.delete(id);
    setSelected(next);
  };
  const genderText = (g: string | null) => (g ?? "").toLowerCase() === "male" ? "Boy" : (g ?? "").toLowerCase() === "female" ? "Girl" : g ? g : null;

  const filterControls = (
    <>
      <div>
        <Label>Gender</Label>
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="male">Boys</SelectItem>
            <SelectItem value="female">Girls</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Tag</Label>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Parent account</Label>
        <Select value={linkFilter} onValueChange={setLinkFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Linked or not</SelectItem>
            <SelectItem value="linked">Has an account</SelectItem>
            <SelectItem value="unlinked">No account</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="People"
        hideTitleOnPhone
        description={loading ? "Loading the county database…" : `${roster.length} players on the county database · ${children.length} registered by parents · ${unlinkedChildren.length} not yet linked`}
        className="mb-0"
        actions={
          <>
            <Button variant="outline" size="icon" aria-label="Refresh" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
            <Button size="sm" onClick={() => openEdit("new")}><Plus className="w-4 h-4" /> Add a player</Button>
          </>
        }
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "players", label: "Players", count: roster.length },
          { value: "unlinked", label: "Not on database", count: unlinkedChildren.length },
        ]}
        className="md:max-w-md"
      />

      {/* ---------------- Players ---------------- */}
      {tab === "players" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <SearchField value={search} onChange={setSearch} placeholder="Search name, parent, email or LTA number" className="flex-1" />
            <FilterButton className="md:hidden" activeCount={activeFilters} onClick={() => setFiltersOpen(true)} />
          </div>
          <ChipRow>
            <Chip active={ageFilter === "all"} onClick={() => setAgeFilter("all")}>All ages</Chip>
            {AGE_GROUPS.map((g) => <Chip key={g} active={ageFilter === `${g}U`} onClick={() => setAgeFilter(`${g}U`)}>{g}U</Chip>)}
            <Chip active={ageFilter === "Open"} onClick={() => setAgeFilter("Open")}>Open</Chip>
          </ChipRow>
          <div className="hidden gap-2 md:grid md:grid-cols-3 md:max-w-2xl">{filterControls}</div>

          <div className="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
            <span className="tabular">{filtered.length} shown{selected.size > 0 ? ` · ${selected.size} selected` : ""}</span>
            <button type="button" className="inline-flex min-h-8 items-center font-medium text-primary" onClick={() => {
              const next = new Set(selected);
              filtered.forEach((r) => allShownSelected ? next.delete(r.id) : next.add(r.id));
              setSelected(next);
            }}>{allShownSelected ? "Unselect all shown" : "Select all shown"}</button>
          </div>

          {loading && roster.length === 0 ? <SkeletonRows rows={8} avatar={false} /> : filtered.length === 0 ? (
            <EmptyState icon={Users} title="No players match" description="Try another name, or clear the filters." action={activeFilters + (ageFilter !== "all" ? 1 : 0) + (search ? 1 : 0) > 0 ? <Button variant="outline" size="sm" onClick={() => { resetFilters(); setSearch(""); }}>Clear filters</Button> : undefined} compact />
          ) : (
            <>
              {/* Phone rows */}
              <ListGroup className="md:hidden">
                {filtered.map((r) => {
                  const child = r.linked_child_id ? childById.get(r.linked_child_id) : null;
                  const isSel = selected.has(r.id);
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 ${isSel ? "bg-primary/[0.06]" : "bg-card"}`}>
                      <Checkbox aria-label={`Select ${fullName(r)}`} checked={isSel} onCheckedChange={(v) => toggleSelected(r.id, v === true)} />
                      <button type="button" className="press flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openEdit(r)}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-medium">{fullName(r)}</span>
                            <span className="shrink-0 rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{r.age_group ?? "?"}</span>
                            {child && <Link2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Account linked" />}
                          </div>
                          <div className="truncate text-[13px] text-muted-foreground">
                            {r.contact_email ?? <span className="text-red-600">no email</span>}{r.contact_name ? ` · ${r.contact_name}` : ""}
                          </div>
                          {(r.tags ?? []).length > 0 && <div className="truncate text-[12px] text-muted-foreground/80">{(r.tags ?? []).join(" · ")}</div>}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      </button>
                    </div>
                  );
                })}
              </ListGroup>

              {/* Desktop table */}
              <div className="hidden max-h-[65vh] overflow-auto rounded-2xl border border-border bg-card md:block">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead className="hidden lg:table-cell">Tags</TableHead>
                      <TableHead className="hidden lg:table-cell">Email groups</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const child = r.linked_child_id ? childById.get(r.linked_child_id) : null;
                      return (
                        <TableRow key={r.id} className={selected.has(r.id) ? "bg-primary/[0.06]" : undefined}>
                          <TableCell>
                            <Checkbox aria-label={`Select ${fullName(r)}`} checked={selected.has(r.id)} onCheckedChange={(v) => toggleSelected(r.id, v === true)} />
                          </TableCell>
                          <TableCell>
                            <button className="font-medium text-left hover:underline" onClick={() => openEdit(r)}>{fullName(r)}</button>
                            <div className="text-[11px] text-muted-foreground">
                              {r.lta_number ? `LTA ${r.lta_number}` : "no LTA number"}
                              {r.singles_wtn != null ? ` · WTN ${r.singles_wtn}` : ""}
                              {child ? <span className="text-emerald-700"> · account linked</span> : ""}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{r.age_group ?? "?"}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{genderText(r.gender) ?? "—"}</TableCell>
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
                            <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                            {child ? (
                              <Button variant="ghost" size="icon-sm" aria-label={`Unlink from ${child.parent_email ?? "account"}`} onClick={() => setLink(r.id, null)}><Unlink className="w-4 h-4" /></Button>
                            ) : (
                              <Button variant="ghost" size="icon-sm" aria-label="Link to a registered child" onClick={() => { setLinkChildId(""); setLinkTarget(r); }}><Link2 className="w-4 h-4" /></Button>
                            )}
                            <Button variant="ghost" size="icon-sm" className="text-red-600" aria-label="Remove from database" onClick={() => setDeleteTarget(r)}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Selection action bar */}
          {selected.size > 0 && (
            <ActionBar aboveNav>
              <span className="!flex-none text-sm font-medium tabular">{selected.size} selected</span>
              <Button variant="outline" onClick={() => setBulkOpen(true)}>Bulk actions</Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </ActionBar>
          )}
        </div>
      )}

      {/* ---------------- Unlinked children ---------------- */}
      {tab === "unlinked" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Children their parents have registered on the site who aren't matched to a row on the county database.
            Add them to the database (they'll be linked automatically) or link them to an existing player.
          </p>
          {unlinkedChildren.length === 0 ? (
            <EmptyState icon={Link2} title="Everyone is linked" description="Every registered child is on the database." compact />
          ) : (
            <ListGroup>
              {unlinkedChildren.map((c) => (
                <div key={c.id} className="bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-medium">{c.name}</span>
                        <span className="shrink-0 rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{ageGroupOf(c.date_of_birth) ?? "?"}</span>
                      </div>
                      <div className="truncate text-[13px] text-muted-foreground">{c.parent_email ?? "—"}{c.parent_name ? ` · ${c.parent_name}` : ""}</div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => { setRosterSearch(c.name.split(" ").slice(-1)[0] ?? ""); setRosterForChild(c); }}>
                      <Link2 className="w-4 h-4" /> Link to existing
                    </Button>
                    <Button size="sm" className="flex-1 sm:flex-none" onClick={() => addChildToRoster(c)}><UserPlus className="w-4 h-4" /> Add to database</Button>
                  </div>
                </div>
              ))}
            </ListGroup>
          )}
        </div>
      )}

      {/* Filters (phone) */}
      <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} onReset={resetFilters}>
        {filterControls}
      </FilterSheet>

      {/* Bulk actions */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected.size} selected</DialogTitle>
            <DialogDescription>Changes apply to every selected player.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label>Move to age group</Label>
              <div className="flex gap-2">
                <Select value={bulkAge} onValueChange={setBulkAge}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((g) => <SelectItem key={g} value={`${g}U`}>{g}U</SelectItem>)}
                    <SelectItem value="Open">Open</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" disabled={bulkBusy || !bulkAge} onClick={applyAge}>Move</Button>
              </div>
            </div>
            <div>
              <Label>Tag</Label>
              <Input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} list="people-tags" placeholder="e.g. 10U county squad" />
              <datalist id="people-tags">{allTags.map((t) => <option key={t} value={t} />)}</datalist>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="flex-1" disabled={bulkBusy || !bulkTag.trim()} onClick={() => applyTag(true)}>Add tag</Button>
                <Button variant="ghost" className="flex-1" disabled={bulkBusy || !bulkTag.trim()} onClick={() => applyTag(false)}>Remove tag</Button>
              </div>
            </div>
            <div>
              <Label>Email group</Label>
              <Select value={bulkGroup} onValueChange={setBulkGroup}>
                <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({g.member_count})</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="flex-1" disabled={bulkBusy || !bulkGroup} onClick={() => applyGroup(true)}>Add parents</Button>
                <Button variant="ghost" className="flex-1" disabled={bulkBusy || !bulkGroup} onClick={() => applyGroup(false)}>Remove</Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{selectedEmails.length} parent email{selectedEmails.length === 1 ? "" : "s"} among the selection.</p>
            </div>
            {bulkBusy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Working…</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / add */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="md:max-w-lg">
          <DialogHeader><DialogTitle>{editing === "new" ? "Add a player" : "Edit player"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input autoComplete="given-name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input autoComplete="family-name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
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
            <div className="col-span-2"><Label>Parent name</Label><Input autoComplete="name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Parent email</Label><Input type="email" inputMode="email" autoComplete="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Mobile</Label><Input type="tel" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div><Label>LTA number</Label><Input inputMode="numeric" value={form.lta_number} onChange={(e) => setForm({ ...form, lta_number: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Tags (comma separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="10U county squad, 11-18 county squad" />
            </div>
          </div>
          {editing && editing !== "new" && (
            <div className="space-y-2 rounded-xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">
                {editing.linked_child_id
                  ? `Linked to ${childById.get(editing.linked_child_id)?.parent_email ?? "a parent account"}.`
                  : "Not linked to a parent account yet."}
              </p>
              {groupsOf(editing.contact_email).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {groupsOf(editing.contact_email).map((g) => (
                    <Badge key={g.id} variant="outline" className="gap-1 bg-card">
                      {g.name}
                      <button aria-label={`Remove from ${g.name}`} onClick={() => removeFromGroup(editing, g)} className="text-muted-foreground hover:text-red-600">×</button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {editing.linked_child_id ? (
                  <Button variant="outline" size="sm" onClick={() => setLink(editing.id, null)}><Unlink className="w-4 h-4" /> Unlink account</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => { setLinkChildId(""); setLinkTarget(editing); }}><Link2 className="w-4 h-4" /> Link to account</Button>
                )}
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(editing)}><Trash2 className="w-4 h-4" /> Remove</Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editing === "new" ? "Add player" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link a roster row to a registered child */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => !o && setLinkTarget(null)}>
        <DialogContent className="md:max-w-md">
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
        <DialogContent className="md:max-w-md">
          <DialogHeader><DialogTitle>Link {rosterForChild?.name} to a database player</DialogTitle></DialogHeader>
          <SearchField value={rosterSearch} onChange={setRosterSearch} placeholder="Search the database by name" autoFocus />
          <ListGroup>
            {rosterMatches.map((r) => (
              <ListRow key={r.id} size="sm" onClick={() => rosterForChild && setLink(r.id, rosterForChild.id)} title={fullName(r)} subtitle={`${r.age_group ?? "?"} · ${r.contact_email ?? "no email"}`} chevron />
            ))}
            {rosterSearch.trim() && rosterMatches.length === 0 && (
              <p className="bg-card px-3 py-4 text-center text-sm text-muted-foreground">No unlinked players match.</p>
            )}
            {!rosterSearch.trim() && <p className="bg-card px-3 py-4 text-center text-sm text-muted-foreground">Type a name to search.</p>}
          </ListGroup>
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
