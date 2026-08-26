import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, Send, Eye, Image as ImageIcon, Type, Heading1,
  List as ListIcon, MousePointerClick, Square, ArrowUp, ArrowDown, Users,
  Mail, UserMinus, UserPlus, Upload, Save, RefreshCcw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type BlockType = "heading" | "kicker" | "text" | "image" | "button" | "band" | "list" | "note";

type Block =
  | { type: "heading"; text: string }
  | { type: "kicker"; text: string }
  | { type: "text"; text: string }
  | { type: "note"; text: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "button"; label: string; url: string }
  | { type: "band"; heading?: string; text?: string }
  | { type: "list"; items: string[] };

type Group = { id: string; name: string; description: string | null; member_count: number };
type Recipient = { email: string; players: string[]; unsubscribed: boolean; source: string | null };
type CampaignRow = {
  id: string; name: string; subject: string; status: string;
  sent_at: string | null; sent_count: number; updated_at: string;
};

/** One call site for the admin-email function so auth/errors stay consistent. */
async function api<T = any>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-email", { body: payload });
  if (error) {
    // Supabase wraps non-2xx as FunctionsHttpError; surface the real message.
    const detail = (data as any)?.error ?? error.message;
    throw new Error(detail);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

const BLOCK_LABELS: Record<BlockType, { label: string; icon: typeof Type; hint: string }> = {
  heading: { label: "Heading", icon: Heading1, hint: "Big navy heading" },
  kicker:  { label: "Kicker", icon: Type, hint: "Small pink label above a section" },
  text:    { label: "Paragraph", icon: Type, hint: "Body text" },
  list:    { label: "Bullet list", icon: ListIcon, hint: "Cyan bulleted points" },
  image:   { label: "Picture", icon: ImageIcon, hint: "Full-width photo" },
  button:  { label: "Button", icon: MousePointerClick, hint: "Cyan call-to-action" },
  band:    { label: "Navy band", icon: Square, hint: "Dark statement section" },
  note:    { label: "Small print", icon: Type, hint: "Muted footnote" },
};

function newBlock(type: BlockType): Block {
  switch (type) {
    case "image": return { type, url: "", alt: "" };
    case "button": return { type, label: "Find out more", url: "https://suffolktennis.online" };
    case "band": return { type, heading: "ONE COUNTY. ONE PROGRAMME.", text: "" };
    case "list": return { type, items: [""] };
    default: return { type, text: "" } as Block;
  }
}

/* ------------------------------------------------------------------ */

export default function EmailPanel() {
  const [tab, setTab] = useState("compose");
  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="compose" className="gap-2"><Mail className="w-4 h-4" />Compose &amp; send</TabsTrigger>
          <TabsTrigger value="groups" className="gap-2"><Users className="w-4 h-4" />Groups</TabsTrigger>
          <TabsTrigger value="recipients" className="gap-2"><UserMinus className="w-4 h-4" />Recipients</TabsTrigger>
        </TabsList>
        <TabsContent value="compose" className="mt-6"><Composer /></TabsContent>
        <TabsContent value="groups" className="mt-6"><GroupsTab /></TabsContent>
        <TabsContent value="recipients" className="mt-6"><RecipientsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

function Composer() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled campaign");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([{ type: "heading", text: "" }, { type: "text", text: "" }]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [audience, setAudience] = useState<{ type: "all" | "group"; group_id?: string }>({ type: "all" });
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const heroInput = useRef<HTMLInputElement>(null);

  const loadLists = useCallback(async () => {
    try {
      const [c, g] = await Promise.all([
        api<{ campaigns: CampaignRow[] }>({ action: "campaigns" }),
        api<{ groups: Group[] }>({ action: "groups" }),
      ]);
      setCampaigns(c.campaigns);
      setGroups(g.groups);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load campaigns"); }
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  // Live preview + audience size, debounced so typing stays smooth.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await api<{ html: string }>({
          action: "preview", subject, preheader, hero_url: heroUrl, blocks,
        });
        setPreview(res.html);
      } catch { /* preview is best-effort */ }
    }, 600);
    return () => clearTimeout(t);
  }, [subject, preheader, heroUrl, blocks]);

  useEffect(() => {
    api<{ count: number }>({ action: "audience_count", audience })
      .then((r) => setAudienceCount(r.count))
      .catch(() => setAudienceCount(null));
  }, [audience]);

  const update = (i: number, patch: Partial<Block>) =>
    setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, ...patch } as Block : blk)));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((b) => {
      const next = [...b];
      const j = i + dir;
      if (j < 0 || j >= next.length) return b;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setBlocks((b) => b.filter((_, idx) => idx !== i));

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("email-media").upload(path, file, { upsert: false });
    if (error) { toast.error(`Upload failed: ${error.message}`); return null; }
    return supabase.storage.from("email-media").getPublicUrl(path).data.publicUrl;
  }

  async function save(): Promise<string | null> {
    setBusy("save");
    try {
      const res = await api<{ campaign_id: string }>({
        action: "campaign_save",
        campaign_id: campaignId ?? undefined,
        name, subject, preheader, hero_url: heroUrl, blocks, audience,
      });
      setCampaignId(res.campaign_id);
      await loadLists();
      toast.success("Saved");
      return res.campaign_id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      return null;
    } finally { setBusy(null); }
  }

  async function loadCampaign(id: string) {
    try {
      const { campaign } = await api<{ campaign: any }>({ action: "campaign_get", campaign_id: id });
      setCampaignId(campaign.id);
      setName(campaign.name);
      setSubject(campaign.subject);
      setPreheader(campaign.preheader ?? "");
      setHeroUrl(campaign.hero_url);
      setBlocks((campaign.blocks ?? []) as Block[]);
      setAudience(campaign.audience ?? { type: "all" });
      toast.success(`Loaded "${campaign.name}"`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load"); }
  }

  async function sendTest() {
    if (!testTo.trim()) { toast.error("Enter an address to send the test to"); return; }
    setBusy("test");
    try {
      await api({ action: "send_test", test_to: testTo.trim(), subject, preheader, hero_url: heroUrl, blocks });
      toast.success(`Test sent to ${testTo.trim()}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Test send failed"); }
    finally { setBusy(null); }
  }

  async function broadcast() {
    setConfirmSend(false);
    const id = await save();
    if (!id) return;
    setBusy("send");
    try {
      const res = await api<{ sent: number; remaining: number; errors: string[] }>({ action: "send", campaign_id: id });
      if (res.errors?.length) {
        toast.error(`Sent ${res.sent}, then stopped: ${res.errors[0]}. Press Send again to resume.`);
      } else {
        toast.success(`Sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"}`);
      }
      await loadLists();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Send failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* ---------------- Editor ---------------- */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Email details</span>
              {campaigns.length > 0 && (
                <Select value={campaignId ?? ""} onValueChange={loadCampaign}>
                  <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Open a saved draft" /></SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.status === "sent" ? "· sent" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Campaign name <span className="text-muted-foreground font-normal">(internal only)</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="September county update" />
            </div>
            <div>
              <Label>Subject line</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Suffolk County Tennis — ..." />
            </div>
            <div>
              <Label>Preview line <span className="text-muted-foreground font-normal">(grey text next to the subject)</span></Label>
              <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="A short teaser line" />
            </div>
            <div>
              <Label>Banner picture <span className="text-muted-foreground font-normal">(optional, sits under the logo)</span></Label>
              <div className="flex items-center gap-2 mt-1">
                <input ref={heroInput} type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setBusy("hero");
                    const url = await uploadImage(f);
                    if (url) setHeroUrl(url);
                    setBusy(null);
                    if (heroInput.current) heroInput.current.value = "";
                  }} />
                <Button type="button" variant="outline" size="sm" onClick={() => heroInput.current?.click()} disabled={busy === "hero"}>
                  {busy === "hero" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                  {heroUrl ? "Replace" : "Upload"}
                </Button>
                {heroUrl && (
                  <>
                    <img src={heroUrl} alt="" className="h-10 w-20 object-cover rounded border" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setHeroUrl(null)}>Remove</Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Content</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {blocks.map((b, i) => (
              <BlockEditor
                key={i} block={b} index={i} total={blocks.length}
                onChange={(patch) => update(i, patch)}
                onMove={(d) => move(i, d)}
                onRemove={() => remove(i)}
                onUpload={uploadImage}
              />
            ))}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => {
                const { label, icon: Icon, hint } = BLOCK_LABELS[t];
                return (
                  <Button key={t} type="button" variant="outline" size="sm" title={hint}
                    onClick={() => setBlocks((b) => [...b, newBlock(t)])}>
                    <Icon className="w-3.5 h-3.5 mr-1" />{label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Who gets it</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={audience.type === "all" ? "all" : audience.group_id ?? ""}
              onValueChange={(v) => setAudience(v === "all" ? { type: "all" } : { type: "group", group_id: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone subscribed</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name} ({g.member_count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {audienceCount === null
                ? "Counting…"
                : <><strong className="text-foreground">{audienceCount}</strong> {audienceCount === 1 ? "person" : "people"} will receive this. Anyone who has unsubscribed is already excluded.</>}
            </p>

            <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Send a test to</Label>
                <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
              </div>
              <Button type="button" variant="outline" onClick={sendTest} disabled={busy === "test"}>
                {busy === "test" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />}Test
              </Button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={save} disabled={busy === "save"}>
                {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}Save draft
              </Button>
              <Button type="button" className="flex-1" onClick={() => setConfirmSend(true)}
                disabled={busy === "send" || !subject.trim() || !audienceCount}>
                {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Send to {audienceCount ?? "…"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------------- Live preview ---------------- */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />Live preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              title="Email preview"
              srcDoc={preview}
              className="w-full h-[70vh] border-0 bg-white"
              sandbox=""
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmSend} onOpenChange={setConfirmSend}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send this email?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              This sends <strong>“{subject || "(no subject)"}”</strong> to{" "}
              <strong>{audienceCount} {audienceCount === 1 ? "person" : "people"}</strong>
              {audience.type === "group" ? ` in ${groups.find((g) => g.id === audience.group_id)?.name ?? "the group"}` : ""}.
            </p>
            <p className="text-muted-foreground">Emails can't be recalled once sent. Send yourself a test first if you haven't.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSend(false)}>Cancel</Button>
            <Button onClick={broadcast}><Send className="w-4 h-4 mr-1" />Send now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BlockEditor({ block, index, total, onChange, onMove, onRemove, onUpload }: {
  block: Block; index: number; total: number;
  onChange: (patch: Partial<Block>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onUpload: (f: File) => Promise<string | null>;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const meta = BLOCK_LABELS[block.type as BlockType];

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[11px]">{meta?.label ?? block.type}</Badge>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {(block.type === "heading" || block.type === "kicker") && (
        <Input value={(block as any).text ?? ""} onChange={(e) => onChange({ text: e.target.value } as any)}
          placeholder={block.type === "heading" ? "Bringing our county together" : "What happens next?"} />
      )}

      {(block.type === "text" || block.type === "note") && (
        <Textarea rows={block.type === "note" ? 2 : 4} value={(block as any).text ?? ""}
          onChange={(e) => onChange({ text: e.target.value } as any)}
          placeholder={block.type === "note" ? "Small print" : "Write your paragraph…"} />
      )}

      {block.type === "list" && (
        <div className="space-y-2">
          {block.items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} placeholder={`Point ${i + 1}`}
                onChange={(e) => onChange({ items: block.items.map((x, j) => (j === i ? e.target.value : x)) } as any)} />
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                onClick={() => onChange({ items: block.items.filter((_, j) => j !== i) } as any)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ items: [...block.items, ""] } as any)}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add point
          </Button>
        </div>
      )}

      {block.type === "button" && (
        <div className="grid sm:grid-cols-2 gap-2">
          <Input value={block.label} onChange={(e) => onChange({ label: e.target.value } as any)} placeholder="Button text" />
          <Input value={block.url} onChange={(e) => onChange({ url: e.target.value } as any)} placeholder="https://…" />
        </div>
      )}

      {block.type === "band" && (
        <div className="space-y-2">
          <Input value={block.heading ?? ""} onChange={(e) => onChange({ heading: e.target.value } as any)} placeholder="ONE COUNTY. ONE PROGRAMME." />
          <Textarea rows={2} value={block.text ?? ""} onChange={(e) => onChange({ text: e.target.value } as any)} placeholder="Supporting line (optional)" />
          <p className="text-[11px] text-muted-foreground">Renders as a navy band with white text.</p>
        </div>
      )}

      {block.type === "image" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input ref={file} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                setUploading(true);
                const url = await onUpload(f);
                if (url) onChange({ url } as any);
                setUploading(false);
                if (file.current) file.current.value = "";
              }} />
            <Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              {block.url ? "Replace picture" : "Choose picture"}
            </Button>
            {block.url && <img src={block.url} alt="" className="h-10 w-20 object-cover rounded border" />}
          </div>
          <Input value={block.alt ?? ""} onChange={(e) => onChange({ alt: e.target.value } as any)}
            placeholder="Describe the picture (for screen readers)" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

function GroupsTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [openGroup, setOpenGroup] = useState<Group | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setGroups((await api<{ groups: Group[] }>({ action: "groups" })).groups); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load groups"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!newName.trim()) return;
    try {
      await api({ action: "group_create", name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName(""); setNewDesc("");
      toast.success("Group created");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create group"); }
  }

  async function remove(g: Group) {
    if (!confirm(`Delete the group "${g.name}"? The people in it are not deleted — only the group.`)) return;
    try { await api({ action: "group_delete", group_id: g.id }); toast.success("Group deleted"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">New group</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-[1fr,1fr,auto] gap-2 items-end">
          <div>
            <Label>Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="10U parents" />
          </div>
          <div>
            <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Parents of 10U squad players" />
          </div>
          <Button onClick={create} disabled={!newName.trim()}><Plus className="w-4 h-4 mr-1" />Create</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Groups</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
            : groups.length === 0 ? <p className="text-sm text-muted-foreground py-4">No groups yet. Create one above — for example "10U parents".</p>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>Group</TableHead><TableHead>People</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {groups.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <div className="font-medium">{g.name}</div>
                        {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{g.member_count}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => setOpenGroup(g)}>Manage people</Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(g)}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      {openGroup && <GroupMembersDialog group={openGroup} onClose={() => { setOpenGroup(null); load(); }} />}
    </div>
  );
}

function GroupMembersDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const [members, setMembers] = useState<Array<{ email: string; unsubscribed: boolean }>>([]);
  const [all, setAll] = useState<Recipient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, r] = await Promise.all([
        api<{ members: Array<{ email: string; unsubscribed: boolean }> }>({ action: "group_members", group_id: group.id }),
        api<{ recipients: Recipient[] }>({ action: "recipients" }),
      ]);
      setMembers(m.members); setAll(r.recipients);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load"); }
    finally { setLoading(false); }
  }, [group.id]);
  useEffect(() => { load(); }, [load]);

  const memberSet = useMemo(() => new Set(members.map((m) => m.email)), [members]);
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((r) => !memberSet.has(r.email))
      .filter((r) => !q || r.email.includes(q) || r.players.some((p) => p.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [all, memberSet, search]);

  async function add(emails: string[]) {
    setSaving(true);
    try { await api({ action: "group_add", group_id: group.id, emails }); await load(); toast.success(`Added ${emails.length}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not add"); }
    finally { setSaving(false); }
  }
  async function drop(email: string) {
    setSaving(true);
    try { await api({ action: "group_remove", group_id: group.id, emails: [email] }); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{group.name} — {members.length} {members.length === 1 ? "person" : "people"}</DialogTitle></DialogHeader>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <div className="grid md:grid-cols-2 gap-4 max-h-[60vh]">
            <div className="space-y-2 overflow-y-auto">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">In this group</Label>
              {members.length === 0 && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
              {members.map((m) => (
                <div key={m.email} className="flex items-center justify-between gap-2 text-sm border rounded p-2">
                  <span className="truncate">
                    {m.email}
                    {m.unsubscribed && <Badge variant="outline" className="ml-2 text-[10px]">unsubscribed</Badge>}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={saving} onClick={() => drop(m.email)}>
                    <UserMinus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2 overflow-y-auto">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Add people</Label>
              <div className="flex gap-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" />
                {candidates.length > 1 && (
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => add(candidates.map((c) => c.email))}>
                    Add all {candidates.length}
                  </Button>
                )}
              </div>
              {candidates.map((c) => (
                <div key={c.email} className="flex items-center justify-between gap-2 text-sm border rounded p-2">
                  <span className="truncate">
                    <span className="block">{c.email}</span>
                    {c.players.length > 0 && <span className="text-xs text-muted-foreground">{c.players.join(", ")}</span>}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={saving} onClick={() => add([c.email])}>
                    <UserPlus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Recipients                                                          */
/* ------------------------------------------------------------------ */

function RecipientsTab() {
  const [data, setData] = useState<{ total: number; unsubscribed: number; recipients: Recipient[]; truncated: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try { setData(await api({ action: "recipients", search: q || undefined })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load recipients"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(r: Recipient) {
    setBusy(r.email);
    try {
      await api({ action: "set_subscription", email: r.email, subscribed: r.unsubscribed });
      toast.success(r.unsubscribed ? `${r.email} resubscribed` : `${r.email} unsubscribed`);
      await load(search);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
    finally { setBusy(null); }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-3">
          <span>Recipients</span>
          {data && (
            <>
              <Badge variant="secondary">{data.total} total</Badge>
              <Badge variant="outline">{data.unsubscribed} unsubscribed</Badge>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(search)}
            placeholder="Search by email or player name" />
          <Button variant="outline" onClick={() => load(search)}><RefreshCcw className="w-4 h-4" /></Button>
        </div>

        {loading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <>
            {data?.truncated && <p className="text-xs text-muted-foreground">Showing the first 500 — search to narrow it down.</p>}
            <Table>
              <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Players</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(data?.recipients ?? []).map((r) => (
                  <TableRow key={r.email}>
                    <TableCell className="font-mono text-xs">{r.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.players.join(", ") || "—"}</TableCell>
                    <TableCell>
                      {r.unsubscribed
                        ? <Badge variant="outline" className="text-destructive border-destructive/40">Unsubscribed</Badge>
                        : <Badge variant="secondary">Subscribed</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled={busy === r.email} onClick={() => toggle(r)}>
                        {busy === r.email ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : r.unsubscribed ? <><UserPlus className="w-3.5 h-3.5 mr-1" />Resubscribe</>
                          : <><UserMinus className="w-3.5 h-3.5 mr-1" />Unsubscribe</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
