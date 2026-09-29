// Upload a spreadsheet of players and add the ones the database doesn't have.
//
// The admin drops in a CSV or Excel file — an LTA RCP export, a club's list,
// a coach's nominations — and sees, before anything is saved, who would be
// added, who is already on the database, who needs a second look (same name
// as someone on the database but a different parent email) and which rows
// couldn't be read. They untick anyone they don't want, then confirm.
//
// Additions only. This never updates or removes a player; editing is the
// per-player form, and removing is the explicit per-player action.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { SegmentedControl, ListGroup, EmptyState } from "@/components/app";
import {
  analyseRows, findHeader, readContactList, readWorkbook, FIELD_LABELS,
  type Classified, type ContactList, type ExistingPlayer, type ImportField, type ImportRow, type ParsedSheet,
} from "@/lib/rosterImport";
import { ContactListImport } from "@/components/admin/ContactListImport";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const ACCEPT = ".csv,.tsv,.txt,.xlsx,.xlsm,.xls,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CHUNK = 100;

type View = "add" | "review" | "existing" | "skipped";
type Stage =
  | { name: "pick" }
  | { name: "reading" }
  | { name: "preview"; file: string; sheet: ParsedSheet; rowsRead: number }
  | { name: "contacts"; file: string; list: ContactList }
  | { name: "saving"; done: number; total: number }
  | { name: "done"; added: number; failed: number };

const genderText = (g: string | null) => (g ?? "").toLowerCase() === "male" ? "Boy" : (g ?? "").toLowerCase() === "female" ? "Girl" : g;

function RowSummary({ row }: { row: ImportRow }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-[15px] font-medium">{row.first_name} {row.last_name}</span>
        <span className="rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{row.age_group ?? "no age group"}</span>
        {genderText(row.gender) && <span className="text-[12px] text-muted-foreground">{genderText(row.gender)}</span>}
        {row.lta_number && <span className="text-[12px] text-muted-foreground">LTA {row.lta_number}</span>}
      </div>
      <div className="truncate text-[13px] text-muted-foreground">
        {row.contact_email ?? <span className="text-red-600">no parent email</span>}{row.contact_name ? ` · ${row.contact_name}` : ""}{row.mobile ? ` · ${row.mobile}` : ""}
      </div>
      {row.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">{row.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
      )}
    </div>
  );
}

export function RosterImportDialog({ open, onOpenChange, onAdded }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after players were added (even if some failed) so the page reloads. */
  onAdded: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const [existing, setExisting] = useState<ExistingPlayer[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [view, setView] = useState<View>("add");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fresh copy of the database each time the dialog opens, so the matching
  // sees players added a minute ago.
  useEffect(() => {
    if (!open) return;
    setStage({ name: "pick" });
    setChecked(new Set());
    setView("add");
    setExisting(null);
    db.from("player_roster").select("id, lta_number, first_name, last_name, age_group, contact_email")
      .then(({ data, error }: { data: ExistingPlayer[] | null; error: { message: string } | null }) => {
        if (error) { toast.error(error.message); onOpenChange(false); return; }
        setExisting(data ?? []);
      });
  }, [open, onOpenChange]);

  const handleFile = useCallback(async (file: File) => {
    if (!existing) return;
    setStage({ name: "reading" });
    try {
      const book = await readWorkbook(file);
      if (!book.some((s) => s.rows.some((r) => r.some((c) => c)))) throw new Error("The file is empty.");
      // Players are read from the first sheet that names them. A file with no
      // player names but email addresses (schools, clubs, coaches) is a
      // contact list: offer it to an email group instead of refusing it.
      const playerSheet = book.find((s) => findHeader(s.rows) !== -1);
      if (!playerSheet) {
        const list = readContactList(book);
        if (list) { setStage({ name: "contacts", file: file.name, list }); return; }
        throw new Error("Couldn't find any players or email addresses in that file. For players it needs a name column (First name and Last name, or Name).");
      }
      const rows = playerSheet.rows;
      const sheet = analyseRows(rows, existing);
      setChecked(new Set(sheet.rows.filter((r) => r.kind === "new").map((r) => r.line)));
      setView(sheet.counts.new > 0 ? "add" : sheet.counts.review > 0 ? "review" : "existing");
      setStage({ name: "preview", file: file.name, sheet, rowsRead: sheet.rowsRead });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file");
      setStage({ name: "pick" });
    }
  }, [existing]);

  const toggle = (line: number, on: boolean) => {
    const next = new Set(checked);
    if (on) next.add(line); else next.delete(line);
    setChecked(next);
  };

  const confirm = async () => {
    if (stage.name !== "preview") return;
    const rows = stage.sheet.rows
      .filter((r): r is Extract<Classified, { kind: "new" | "review" }> => (r.kind === "new" || r.kind === "review") && checked.has(r.line))
      .map((r) => ({ ...r.row, source: "admin_upload" }));
    if (rows.length === 0) return;
    setStage({ name: "saving", done: 0, total: rows.length });
    let added = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await db.from("player_roster").insert(slice);
      if (error) {
        toast.error(`Stopped after ${added} of ${rows.length}: ${error.message}`);
        if (added > 0) onAdded();
        setStage({ name: "done", added, failed: rows.length - added });
        return;
      }
      added += slice.length;
      setStage({ name: "saving", done: added, total: rows.length });
    }
    toast.success(added === 1 ? "1 player added" : `${added} players added`);
    onAdded();
    setStage({ name: "done", added, failed: 0 });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const preview = stage.name === "preview" ? stage : null;
  const shown: Classified[] = preview
    ? preview.sheet.rows.filter((r) =>
        view === "add" ? r.kind === "new"
        : view === "review" ? r.kind === "review"
        : view === "existing" ? r.kind === "existing"
        : r.kind === "skipped" || r.kind === "duplicate")
    : [];
  const selectedCount = preview
    ? preview.sheet.rows.filter((r) => (r.kind === "new" || r.kind === "review") && checked.has(r.line)).length
    : 0;
  const recognised = preview ? (Object.keys(preview.sheet.columns) as ImportField[]).map((f) => FIELD_LABELS[f]) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (stage.name !== "saving") onOpenChange(o); }}>
      <DialogContent className="max-h-dialog flex flex-col md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{stage.name === "contacts" ? "Upload a contact list" : "Upload a list of players"}</DialogTitle>
          <DialogDescription>
            A CSV or Excel file — an LTA export, a club list, coach nominations. New players are shown first for you to check; nobody already on the database is changed or removed.
          </DialogDescription>
        </DialogHeader>

        {(stage.name === "pick" || stage.name === "reading") && (
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/40"}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {stage.name === "reading" || !existing ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{existing ? "Reading the file and checking it against the database…" : "Loading the database…"}</p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-9 w-9 text-muted-foreground" />
                <div>
                  <p className="font-medium">Drop a file here, or choose one</p>
                  <p className="mt-1 text-xs text-muted-foreground">.csv, .xlsx or .xls. It needs a name column; LTA number, gender, age group or date of birth, parent name, parent email, mobile and tags are picked up when they're there.</p>
                </div>
                <Button variant="outline" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Choose a file</Button>
                <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" data-testid="roster-import-file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </>
            )}
          </div>
        )}

        {preview && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{preview.file}</span> · {preview.rowsRead} row{preview.rowsRead === 1 ? "" : "s"} read.
              {" "}Recognised: {recognised.join(", ")}.
              {preview.sheet.ignoredColumns.length > 0 && <> Ignored: {preview.sheet.ignoredColumns.join(", ")}.</>}
            </div>

            <SegmentedControl
              ariaLabel="Upload results"
              size="sm"
              value={view}
              onChange={(v) => setView(v as View)}
              options={[
                { value: "add", label: "To add", count: preview.sheet.counts.new },
                { value: "review", label: "Check", count: preview.sheet.counts.review },
                { value: "existing", label: "Already there", count: preview.sheet.counts.existing },
                { value: "skipped", label: "Skipped", count: preview.sheet.counts.skipped + preview.sheet.counts.duplicate },
              ]}
            />

            {view === "review" && preview.sheet.counts.review > 0 && (
              <p className="text-xs text-muted-foreground">Same name as someone on the database but a different parent email. Tick any that are a different child; leave the rest.</p>
            )}

            <div className="min-h-0 flex-1 overflow-auto">
              {shown.length === 0 ? (
                <EmptyState
                  icon={view === "add" ? CheckCircle2 : FileSpreadsheet}
                  title={view === "add" ? "Nobody new" : "Nothing here"}
                  description={view === "add" ? "Everyone in the file is already on the database." : ""}
                  compact
                />
              ) : (
                <ListGroup>
                  {shown.map((r) => (
                    <div key={r.line} className="flex items-start gap-3 bg-card px-3 py-2.5">
                      {(r.kind === "new" || r.kind === "review") ? (
                        <Checkbox className="mt-1" aria-label={`Add ${r.row.first_name} ${r.row.last_name}`} checked={checked.has(r.line)} onCheckedChange={(v) => toggle(r.line, v === true)} />
                      ) : (
                        <span className="mt-1 w-4 shrink-0 text-center text-[11px] tabular text-muted-foreground">{r.line}</span>
                      )}
                      {r.kind === "skipped" ? (
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-medium text-muted-foreground">Row {r.line}: {r.reason}</div>
                          <div className="truncate text-[12px] text-muted-foreground/80">{r.raw.filter(Boolean).slice(0, 6).join(" · ")}</div>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <RowSummary row={r.row} />
                          {r.kind === "existing" && <div className="mt-1 text-[12px] text-emerald-700">Already on the database — {r.how}.</div>}
                          {r.kind === "review" && <div className="mt-1 text-[12px] text-amber-700">{r.how}.</div>}
                          {r.kind === "duplicate" && <div className="mt-1 text-[12px] text-muted-foreground">Same as row {r.ofLine} of this file.</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </ListGroup>
              )}
            </div>

            <DialogFooter className="items-center gap-2 sm:justify-between">
              <p className="text-xs text-muted-foreground">Only ticked players are added. Nothing already on the database is changed or removed.</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStage({ name: "pick" })}>Another file</Button>
                <Button onClick={confirm} disabled={selectedCount === 0}>
                  Add {selectedCount} player{selectedCount === 1 ? "" : "s"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}

        {stage.name === "contacts" && (
          <ContactListImport file={stage.file} list={stage.list} onBack={() => setStage({ name: "pick" })} onClose={() => onOpenChange(false)} />
        )}

        {stage.name === "saving" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Adding {stage.done} of {stage.total}…</p>
          </div>
        )}

        {stage.name === "done" && (
          <>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              <div>
                <p className="font-medium">{stage.added === 1 ? "1 player added" : `${stage.added} players added`}</p>
                {stage.failed > 0 && <p className="mt-1 text-sm text-red-600">{stage.failed} not added — see the message above and try again with the rest.</p>}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RosterImportDialog;
