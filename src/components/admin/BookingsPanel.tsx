import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Send, QrCode, Lock, Globe, RefreshCw, AlertTriangle, CalendarPlus, Trash2, Pencil } from "lucide-react";

const db = supabase as any;

type EventRow = {
  id: string; title: string; description: string | null; event_date: string | null;
  location: string | null; capacity: number | null; visibility: string;
  programme_type: string; price_pence: number | null; monthly_amount_pence: number | null;
  programme_months: number | null; sign_up_enabled: boolean;
};
type Invitation = {
  id: string; child_name: string | null; parent_email: string; parent_name: string | null;
  status: string; sent_at: string | null; reminded_at: string | null;
};
type Booking = {
  id: string; child_name: string; parent_name: string; parent_email: string;
  status: string; amount_pence: number; session_slot: string | null; paid_at: string | null;
  membership_id: string | null;
};
type Player = {
  id: string; name: string; date_of_birth: string | null; gender: string | null;
  home_club: string | null; parent_user_id: string; parent_email?: string; parent_name?: string;
};

const AGE_GROUPS = [8, 9, 10, 11, 12, 14, 16, 18];
const gbp = (p: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`);
const ageGroupOf = (dob: string | null): string => {
  if (!dob) return "?";
  const ageAtYearEnd = new Date().getFullYear() - new Date(dob).getFullYear();
  const g = AGE_GROUPS.find((n) => ageAtYearEnd <= n);
  return g ? `${g}U` : "18+";
};

const emptyForm = {
  id: null as string | null,
  title: "", description: "", event_date: "", location: "", capacity: "",
  visibility: "private", programme_type: "one_off", price: "", monthly_amount: "",
  programme_months: "", sign_up_enabled: false,
};

const BookingsPanel = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<Record<string, { invited: number; booked: number; paid: number }>>({});
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; session_date: string; start_time: string | null; venue: string | null }>>([]);
  const [pastDue, setPastDue] = useState<Array<{ id: string; child_name: string; parent_email: string; event_id: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerFilter, setPlayerFilter] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Event form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [savingEvent, setSavingEvent] = useState(false);

  // Session add
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionTime, setNewSessionTime] = useState("");
  const [newSessionVenue, setNewSessionVenue] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data: evs } = await db.from("events").select("*").order("event_date", { ascending: false });
    setEvents(evs ?? []);
    const { data: invs } = await db.from("booking_invitations").select("event_id, status");
    const { data: bks } = await db.from("bookings").select("event_id, status");
    const s: Record<string, { invited: number; booked: number; paid: number }> = {};
    for (const i of invs ?? []) {
      s[i.event_id] ??= { invited: 0, booked: 0, paid: 0 };
      s[i.event_id].invited += 1;
      if (i.status === "booked") s[i.event_id].booked += 1;
    }
    for (const b of bks ?? []) {
      s[b.event_id] ??= { invited: 0, booked: 0, paid: 0 };
      if (b.status === "paid") s[b.event_id].paid += 1;
    }
    setStats(s);
    const { data: pd } = await db.from("memberships").select("id, child_name, parent_email, event_id").eq("status", "past_due");
    setPastDue(pd ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const openEvent = async (ev: EventRow) => {
    setSelected(ev);
    const [{ data: invs }, { data: bks }, { data: sess }] = await Promise.all([
      db.from("booking_invitations").select("id, child_name, parent_email, parent_name, status, sent_at, reminded_at").eq("event_id", ev.id).order("created_at"),
      db.from("bookings").select("id, child_name, parent_name, parent_email, status, amount_pence, session_slot, paid_at, membership_id").eq("event_id", ev.id).order("created_at", { ascending: false }),
      db.from("event_sessions").select("id, session_date, start_time, venue").eq("event_id", ev.id).order("session_date"),
    ]);
    setInvitations(invs ?? []);
    setBookings(bks ?? []);
    setSessions(sess ?? []);
  };

  const loadPlayers = async () => {
    const [{ data: kids }, { data: emails }, { data: profiles }] = await Promise.all([
      db.from("children").select("id, name, date_of_birth, gender, home_club, parent_user_id").order("name"),
      db.rpc("get_parent_emails"),
      db.from("profiles").select("user_id, first_name, last_name"),
    ]);
    const emailMap = new Map<string, string>((emails ?? []).map((e: any) => [e.user_id, e.email]));
    const nameMap = new Map<string, string>((profiles ?? []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`.trim()]));
    setPlayers(
      (kids ?? []).map((k: any) => ({
        ...k,
        parent_email: emailMap.get(k.parent_user_id),
        parent_name: nameMap.get(k.parent_user_id),
      })),
    );
  };

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (playerFilter !== "all" && ageGroupOf(p.date_of_birth) !== playerFilter) return false;
      if (playerSearch && !p.name.toLowerCase().includes(playerSearch.toLowerCase())) return false;
      return true;
    });
  }, [players, playerFilter, playerSearch]);

  const sendInvites = async () => {
    if (!selected) return;
    const invitees = players
      .filter((p) => checked.has(p.id) && p.parent_email)
      .map((p) => ({
        child_id: p.id,
        child_name: p.name,
        parent_email: p.parent_email!,
        parent_name: p.parent_name ?? "",
      }));
    if (invitees.length === 0) {
      toast.error("No selected players with a parent email");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-booking-invitations", {
      body: { event_id: selected.id, invitees },
    });
    setSending(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Sending failed");
      return;
    }
    toast.success(`${data.sent}/${data.total} invitation emails sent`);
    if (data.sent < data.total) {
      const firstErr = (data.results ?? []).find((r: any) => r.error)?.error;
      if (firstErr) toast.warning(String(firstErr));
    }
    setInviteOpen(false);
    setChecked(new Set());
    openEvent(selected);
    loadEvents();
  };

  const remind = async (invitationIds: string[]) => {
    if (!selected || invitationIds.length === 0) return;
    const { data, error } = await supabase.functions.invoke("send-booking-invitations", {
      body: { event_id: selected.id, remind_invitation_ids: invitationIds },
    });
    if (error || data?.error) toast.error(data?.error ?? "Reminder failed");
    else toast.success(`${data.sent} reminder(s) sent`);
    openEvent(selected);
  };

  const saveEvent = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setSavingEvent(true);
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: form.event_date ? new Date(form.event_date).toISOString() : new Date().toISOString(),
      location: form.location.trim() || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      visibility: form.visibility,
      programme_type: form.programme_type,
      price_pence: form.price ? Math.round(Number(form.price) * 100) : null,
      monthly_amount_pence: form.monthly_amount ? Math.round(Number(form.monthly_amount) * 100) : null,
      programme_months: form.programme_months ? Number(form.programme_months) : null,
      sign_up_enabled: form.sign_up_enabled,
    };
    const q = form.id
      ? db.from("events").update(payload).eq("id", form.id)
      : db.from("events").insert(payload);
    const { error } = await q;
    setSavingEvent(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Event updated" : "Event created");
    setFormOpen(false);
    setForm({ ...emptyForm });
    loadEvents();
  };

  const addSession = async () => {
    if (!selected || !newSessionDate) return;
    const { error } = await db.from("event_sessions").insert({
      event_id: selected.id,
      session_date: newSessionDate,
      start_time: newSessionTime || null,
      venue: newSessionVenue.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    setNewSessionDate(""); setNewSessionTime(""); setNewSessionVenue("");
    openEvent(selected);
  };

  const editEvent = (ev: EventRow) => {
    setForm({
      id: ev.id,
      title: ev.title,
      description: ev.description ?? "",
      event_date: ev.event_date ? ev.event_date.slice(0, 16) : "",
      location: ev.location ?? "",
      capacity: ev.capacity?.toString() ?? "",
      visibility: ev.visibility,
      programme_type: ev.programme_type,
      price: ev.price_pence != null ? (ev.price_pence / 100).toString() : "",
      monthly_amount: ev.monthly_amount_pence != null ? (ev.monthly_amount_pence / 100).toString() : "",
      programme_months: ev.programme_months?.toString() ?? "",
      sign_up_enabled: ev.sign_up_enabled,
    });
    setFormOpen(true);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      invited: "bg-muted text-muted-foreground", opened: "bg-blue-100 text-blue-800",
      booked: "bg-green-100 text-green-800", paid: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800", payment_failed: "bg-red-100 text-red-800",
      revoked: "bg-red-100 text-red-800", cancelled: "bg-red-100 text-red-800",
    };
    return <Badge className={map[s] ?? "bg-muted"} variant="outline">{s.replace("_", " ")}</Badge>;
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {pastDue.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" /> Failed payments to chase ({pastDue.length})
          </CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {pastDue.map((m) => (
              <div key={m.id} className="flex justify-between">
                <span><strong>{m.child_name}</strong> — {m.parent_email}</span>
                <span className="text-red-600">entry blocked until paid</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Bookable events &amp; programmes</h2>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/admin/scan"><QrCode className="w-4 h-4 mr-1" /> Scanner</Link></Button>
          <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setFormOpen(true); }}><Plus className="w-4 h-4 mr-1" /> New event</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((ev) => {
          const s = stats[ev.id] ?? { invited: 0, booked: 0, paid: 0 };
          return (
            <Card key={ev.id} className={`cursor-pointer transition-shadow hover:shadow-md ${selected?.id === ev.id ? "ring-2 ring-primary" : ""}`} onClick={() => openEvent(ev)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-start justify-between gap-2">
                  <span>{ev.title}</span>
                  {ev.visibility === "private"
                    ? <Badge variant="outline" className="shrink-0"><Lock className="w-3 h-3 mr-1" />Private</Badge>
                    : <Badge variant="outline" className="shrink-0"><Globe className="w-3 h-3 mr-1" />Public</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>{ev.programme_type === "monthly_programme"
                  ? `${gbp(ev.monthly_amount_pence)}/mo × ${ev.programme_months ?? "?"} months`
                  : gbp(ev.price_pence)}
                  {ev.capacity ? ` · ${s.paid}/${ev.capacity} places` : ` · ${s.paid} paid`}
                </div>
                <div>{s.invited} invited · {s.booked} booked</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{selected.title}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => editEvent(selected)}><Pencil className="w-4 h-4 mr-1" /> Edit</Button>
              <Button size="sm" onClick={() => { loadPlayers(); setInviteOpen(true); }}><Send className="w-4 h-4 mr-1" /> Invite players</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {selected.programme_type === "monthly_programme" && (
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-1"><CalendarPlus className="w-4 h-4" /> Programme session dates</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {sessions.map((s) => (
                    <Badge key={s.id} variant="secondary" className="gap-1">
                      {new Date(s.session_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {s.start_time ? ` ${s.start_time.slice(0, 5)}` : ""}{s.venue ? ` · ${s.venue}` : ""}
                      <button onClick={async () => { await db.from("event_sessions").delete().eq("id", s.id); openEvent(selected); }}>
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className="w-40" />
                  <Input type="time" value={newSessionTime} onChange={(e) => setNewSessionTime(e.target.value)} className="w-28" />
                  <Input placeholder="Venue" value={newSessionVenue} onChange={(e) => setNewSessionVenue(e.target.value)} className="w-44" />
                  <Button size="sm" variant="outline" onClick={addSession}>Add date</Button>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Invitations ({invitations.length})</h3>
                <Button variant="outline" size="sm"
                  onClick={() => remind(invitations.filter((i) => i.status === "invited" || i.status === "opened").map((i) => i.id))}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Remind all unbooked
                </Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Player</TableHead><TableHead>Parent</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {invitations.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.child_name}</TableCell>
                      <TableCell className="text-muted-foreground">{i.parent_name || i.parent_email}</TableCell>
                      <TableCell>{statusBadge(i.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {i.sent_at ? new Date(i.sent_at).toLocaleDateString("en-GB") : "not sent"}
                        {i.reminded_at ? " · reminded" : ""}
                      </TableCell>
                      <TableCell>
                        {(i.status === "invited" || i.status === "opened") && (
                          <Button variant="ghost" size="sm" onClick={() => remind([i.id])}>Resend</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Bookings ({bookings.length})</h3>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Player</TableHead><TableHead>Parent</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Paid</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.child_name}{b.session_slot ? <span className="text-muted-foreground text-xs"> · {b.session_slot}</span> : null}</TableCell>
                      <TableCell className="text-muted-foreground">{b.parent_email}</TableCell>
                      <TableCell>{gbp(b.amount_pence)}{b.membership_id ? "/mo" : ""}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{b.paid_at ? new Date(b.paid_at).toLocaleDateString("en-GB") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite players dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invite players — {selected?.title}</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Select value={playerFilter} onValueChange={setPlayerFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ages</SelectItem>
                {AGE_GROUPS.map((g) => <SelectItem key={g} value={`${g}U`}>{g}U</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Search players…" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filteredPlayers.length} players · {checked.size} selected</span>
            <button className="underline" onClick={() => {
              const all = new Set(checked);
              const allChecked = filteredPlayers.every((p) => all.has(p.id));
              filteredPlayers.forEach((p) => allChecked ? all.delete(p.id) : all.add(p.id));
              setChecked(all);
            }}>Select all shown</button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto border rounded-md p-2">
            {filteredPlayers.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <Checkbox checked={checked.has(p.id)} onCheckedChange={(v) => {
                  const next = new Set(checked);
                  v === true ? next.add(p.id) : next.delete(p.id);
                  setChecked(next);
                }} />
                <span className="font-medium">{p.name}</span>
                <Badge variant="outline" className="text-[10px]">{ageGroupOf(p.date_of_birth)}</Badge>
                <span className="text-muted-foreground text-xs truncate">{p.parent_email ?? "no parent email"}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={sendInvites} disabled={sending || checked.size === 0}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Send {checked.size} invitation{checked.size === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event create/edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date &amp; time</Label><Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div>
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (invitation only)</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.programme_type} onValueChange={(v) => setForm({ ...form, programme_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_off">One-off event / camp</SelectItem>
                    <SelectItem value="monthly_programme">Monthly programme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.programme_type === "one_off" ? (
                <div><Label>Price (£)</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              ) : (
                <>
                  <div><Label>Monthly amount (£)</Label><Input type="number" min="0" step="0.01" value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })} /></div>
                  <div><Label>Programme length (months)</Label><Input type="number" min="1" max="12" value={form.programme_months} onChange={(e) => setForm({ ...form, programme_months: e.target.value })} /></div>
                </>
              )}
              <div><Label>Capacity</Label><Input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
            </div>
            {form.visibility === "public" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.sign_up_enabled} onCheckedChange={(v) => setForm({ ...form, sign_up_enabled: v === true })} />
                Open sign-ups on the public events page
              </label>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveEvent} disabled={savingEvent}>
              {savingEvent ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {form.id ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingsPanel;
