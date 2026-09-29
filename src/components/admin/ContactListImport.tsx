// The upload dialog's second mode: a file of schools, clubs or coaches with
// email addresses but no players (the county "Mail Merge ALL SUFFOLK
// SCHOOLS" sheet is the case this was built for). Those addresses don't
// belong on the player database; they belong in an email group, which is
// what the Email tab sends to. So the admin picks which sheets to take,
// which group to put them in (or a new one), and adds them.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import type { ContactList } from "@/lib/rosterImport";

type Group = { id: string; name: string; member_count: number };

/** admin-email, with the server's own message on failure rather than "non-2xx". */
async function adminEmail<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-email", { body: payload });
  if (error) {
    let detail: string | undefined = (data as { error?: string } | null)?.error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { detail ??= (await (error as any).context?.json?.())?.error; } catch { /* not JSON */ }
    throw new Error(detail ?? error.message);
  }
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

/** "Mail_Merge_ALL_SUFFOLK_SCHOOLS.xlsx" → "Mail Merge All Suffolk Schools". */
const groupNameFromFile = (file: string) =>
  file.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
    .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 120);

const CHUNK = 1000;

export function ContactListImport({ file, list, onBack, onClose }: {
  file: string;
  list: ContactList;
  onBack: () => void;
  onClose: () => void;
}) {
  const [sheets, setSheets] = useState<Set<string>>(() => new Set(list.sheets.map((s) => s.sheet)));
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [target, setTarget] = useState<string>("new");
  const [newName, setNewName] = useState(() => groupNameFromFile(file));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ added: number; skipped: number; group: string } | null>(null);

  useEffect(() => {
    adminEmail<{ groups: Group[] }>({ action: "groups" })
      .then((r) => setGroups(r.groups))
      .catch((e) => { toast.error(e instanceof Error ? e.message : "Couldn't load email groups"); setGroups([]); });
  }, []);

  const chosen = useMemo(
    () => list.sheets.filter((s) => sheets.has(s.sheet)).flatMap((s) => s.contacts),
    [list, sheets],
  );
  const total = list.sheets.reduce((n, s) => n + s.contacts.length, 0);

  const toggle = (sheet: string, on: boolean) => {
    const next = new Set(sheets);
    if (on) next.add(sheet); else next.delete(sheet);
    setSheets(next);
  };

  const add = async () => {
    if (!chosen.length) return;
    if (target === "new" && !newName.trim()) { toast.error("Give the new group a name"); return; }
    setBusy(true);
    try {
      let groupId = target;
      let groupName = groups?.find((g) => g.id === target)?.name ?? "";
      if (target === "new") {
        const { group } = await adminEmail<{ group: { id: string; name: string } }>({
          action: "group_create", name: newName.trim(),
          description: `Imported from ${file} (${[...sheets].join(", ")})`,
        });
        groupId = group.id; groupName = group.name;
      }
      const emails = chosen.map((c) => c.email);
      let added = 0, skipped = 0;
      for (let i = 0; i < emails.length; i += CHUNK) {
        const r = await adminEmail<{ added: number; skipped?: string[] }>({ action: "group_add", group_id: groupId, emails: emails.slice(i, i + CHUNK) });
        added += r.added; skipped += r.skipped?.length ?? 0;
      }
      setDone({ added, skipped, group: groupName });
      toast.success(`${added} addresses added to ${groupName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the addresses");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          <div>
            <p className="font-medium">{done.added} addresses are in “{done.group}”</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Find it under Email → Groups to send to it.{done.skipped ? ` ${done.skipped} couldn't be used and were left out.` : ""} Nothing was added to the player database.
            </p>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div className="flex gap-3 rounded-xl bg-muted/60 p-3 text-sm">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <span className="font-medium">{file}</span> is a contact list rather than a list of players — {total} email address{total === 1 ? "" : "es"} and no player names.
          Add them to an email group so you can send to them from the Email tab. Nothing goes on the player database.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Sheets to include</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {list.sheets.map((s) => (
            <label key={s.sheet} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <Checkbox checked={sheets.has(s.sheet)} onCheckedChange={(v) => toggle(s.sheet, v === true)} aria-label={`Include ${s.sheet}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{s.sheet}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.contacts.length} · e.g. {s.contacts[0].name || s.contacts[0].email}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {(list.fixed.length > 0 || list.invalid.length > 0 || list.missing.length > 0 || list.duplicates > 0) && (
        <div className="space-y-1 rounded-xl border border-border p-3 text-xs text-muted-foreground">
          {list.fixed.map((f) => (
            <p key={`${f.sheet}-${f.line}`}>Fixed <span className="font-mono">{f.from}</span> → <span className="font-mono text-foreground">{f.to}</span> ({f.sheet}, row {f.line})</p>
          ))}
          {list.invalid.length > 0 && <p className="text-amber-800">Left out, not a usable address: {list.invalid.slice(0, 6).map((x) => `${x.raw}${x.name ? ` (${x.name})` : ""}`).join(", ")}{list.invalid.length > 6 ? "…" : ""}</p>}
          {list.missing.length > 0 && <p>{list.missing.length} row{list.missing.length === 1 ? " has" : "s have"} a name but no email: {list.missing.slice(0, 4).map((m) => m.name).join(", ")}{list.missing.length > 4 ? "…" : ""}</p>}
          {list.duplicates > 0 && <p>{list.duplicates} address{list.duplicates === 1 ? " appears" : "es appear"} twice and will be added once.</p>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Add to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">A new group…</SelectItem>
              {(groups ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({g.member_count})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {target === "new" && (
          <div>
            <Label htmlFor="new-group-name">New group name</Label>
            <Input id="new-group-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
        )}
      </div>

      <DialogFooter className="items-center gap-2 sm:justify-between">
        <p className="text-xs text-muted-foreground">Anyone who has unsubscribed stays unsubscribed.</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack} disabled={busy}>Another file</Button>
          <Button onClick={add} disabled={busy || !chosen.length || groups === null}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add {chosen.length} address{chosen.length === 1 ? "" : "es"}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}
