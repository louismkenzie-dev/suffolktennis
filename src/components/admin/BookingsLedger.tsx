/**
 * Bookings ledger — every booking ever made, in one list, with the money.
 *
 * The Bookings page is organised by programme (who is invited, who has paid
 * for *this* one). The ledger is the other cut: one row per booking across
 * every programme and event, the payment breakdown at the top, and the
 * parent's contact details on every row so an admin can ring or email
 * without leaving the page. Rows open a detail sheet; the visible rows
 * export to CSV for the accountant.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Mail, Phone, Receipt } from "lucide-react";
import {
  PageHeader, Section, ListGroup, ListRow, StatusBadge, bookingStatus, EmptyState, SkeletonRows,
  SearchField, SegmentedControl, KeyValueList, Chip, ChipRow, useIsPhone, type StatusTone,
} from "@/components/app";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type BookingRow = {
  id: string; event_id: string; parent_user_id: string | null;
  parent_name: string | null; parent_email: string; parent_phone: string | null;
  child_id: string | null; child_name: string; session_slot: string | null;
  medical_notes: string | null; photo_consent: boolean;
  amount_pence: number; currency: string | null; status: string; stripe_env: string | null;
  membership_id: string | null; paid_at: string | null; created_at: string; complimentary: boolean;
};
type EventLite = { id: string; title: string; programme_type: string; event_date: string | null; is_free: boolean; cancelled_at: string | null };
type Membership = { id: string; monthly_amount_pence: number; months_total: number; months_paid: number; status: string };

export type LedgerEntry = BookingRow & {
  event: EventLite | null;
  membership: Membership | null;
  /** Phone from the booking, else the parent's profile. */
  phone: string | null;
};

type Kind = "all" | "paid" | "pending" | "refunded" | "nocharge" | "issue";

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
const shortDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const dateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/** Which of the ledger's money buckets a booking falls into. */
function kindOf(b: LedgerEntry): Exclude<Kind, "all"> {
  if (b.status === "refunded") return "refunded";
  if (b.status === "payment_failed") return "issue";
  if (b.complimentary || b.amount_pence === 0 || b.event?.is_free) return "nocharge";
  if (b.status === "paid") return "paid";
  if (b.status === "pending") return "pending";
  return "issue";
}

/** One line that says how (and whether) this booking was paid. */
export function paymentLabel(b: LedgerEntry): { text: string; tone: StatusTone } {
  if (b.complimentary) return { text: "No charge · included with another programme", tone: "success" };
  if (b.event?.is_free || b.amount_pence === 0) return { text: "Free", tone: "neutral" };
  if (b.membership) {
    const m = b.membership;
    const base = `${gbp(m.monthly_amount_pence)}/month · ${m.months_paid} of ${m.months_total} paid`;
    if (m.status === "past_due") return { text: `${base} · payment failed`, tone: "danger" };
    if (m.status === "cancelled") return { text: `${base} · cancelled`, tone: "danger" };
    return { text: base, tone: m.months_paid >= m.months_total ? "success" : "info" };
  }
  switch (b.status) {
    case "paid": return { text: `${gbp(b.amount_pence)} by card${b.paid_at ? ` · ${shortDate(b.paid_at)}` : ""}`, tone: "success" };
    case "pending": return { text: `${gbp(b.amount_pence)} · awaiting payment`, tone: "warning" };
    case "refunded": return { text: `${gbp(b.amount_pence)} refunded`, tone: "danger" };
    case "payment_failed": return { text: `${gbp(b.amount_pence)} · payment failed`, tone: "danger" };
    default: return { text: gbp(b.amount_pence), tone: "neutral" };
  }
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ledgerCsv(rows: LedgerEntry[]): string {
  const head = ["Booked", "Paid on", "Child", "Programme/Event", "Type", "Parent", "Email", "Phone", "Amount (£)", "Status", "Payment", "Stripe", "Session slot", "Booking id"];
  const lines = rows.map((b) => [
    b.created_at.slice(0, 10), b.paid_at ? b.paid_at.slice(0, 10) : "", b.child_name, b.event?.title ?? "",
    b.event?.programme_type ?? "", b.parent_name ?? "", b.parent_email, b.phone ?? "",
    (b.amount_pence / 100).toFixed(2), b.status, paymentLabel(b).text, b.stripe_env ?? "", b.session_slot ?? "", b.id,
  ].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n");
}

export default function BookingsLedger() {
  const phone = useIsPhone();
  const [rows, setRows] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [open, setOpen] = useState<LedgerEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: bks, error: e1 }, { data: evs }, { data: mems }] = await Promise.all([
        db.from("bookings").select("id, event_id, parent_user_id, parent_name, parent_email, parent_phone, child_id, child_name, session_slot, medical_notes, photo_consent, amount_pence, currency, status, stripe_env, membership_id, paid_at, created_at, complimentary").order("created_at", { ascending: false }),
        db.from("events").select("id, title, programme_type, event_date, is_free, cancelled_at"),
        db.from("memberships").select("id, monthly_amount_pence, months_total, months_paid, status"),
      ]);
      if (cancelled) return;
      if (e1) { setError(e1.message); setRows([]); return; }
      const bookings = (bks ?? []) as BookingRow[];
      // Phone fallback: the parent's profile, for bookings made before the
      // checkout asked for a number.
      const userIds = [...new Set(bookings.map((b) => b.parent_user_id).filter(Boolean))] as string[];
      const phones = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await db.from("profiles").select("user_id, phone, primary_phone").in("user_id", userIds);
        for (const p of (profiles ?? []) as Array<{ user_id: string; phone: string | null; primary_phone?: string | null }>) {
          const n = (p.primary_phone || p.phone || "").trim();
          if (n) phones.set(p.user_id, n);
        }
      }
      if (cancelled) return;
      const events = new Map<string, EventLite>(((evs ?? []) as EventLite[]).map((e) => [e.id, e]));
      const memberships = new Map<string, Membership>(((mems ?? []) as Membership[]).map((m) => [m.id, m]));
      setRows(bookings.map((b) => ({
        ...b,
        event: events.get(b.event_id) ?? null,
        membership: b.membership_id ? memberships.get(b.membership_id) ?? null : null,
        phone: (b.parent_phone ?? "").trim() || (b.parent_user_id ? phones.get(b.parent_user_id) ?? null : null),
      })));
    })();
    return () => { cancelled = true; };
  }, []);

  const eventsInLedger = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) if (r.event) m.set(r.event.id, r.event.title);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (kind !== "all" && kindOf(r) !== kind) return false;
      if (eventFilter !== "all" && r.event_id !== eventFilter) return false;
      if (!q) return true;
      return [r.child_name, r.parent_name, r.parent_email, r.phone, r.event?.title].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, query, kind, eventFilter]);

  /** The money, over everything (filters narrow the list, not the totals). */
  const totals = useMemo(() => {
    const t = { count: 0, paid: 0, paidCount: 0, pending: 0, pendingCount: 0, refunded: 0, refundedCount: 0, noCharge: 0, issues: 0, monthly: 0 };
    for (const r of rows ?? []) {
      t.count += 1;
      const k = kindOf(r);
      if (k === "paid") { t.paidCount += 1; t.paid += r.membership ? r.membership.monthly_amount_pence * r.membership.months_paid : r.amount_pence; }
      else if (k === "pending") { t.pendingCount += 1; t.pending += r.amount_pence; }
      else if (k === "refunded") { t.refundedCount += 1; t.refunded += r.amount_pence; }
      else if (k === "nocharge") t.noCharge += 1;
      else t.issues += 1;
      if (r.membership && r.membership.status === "active") t.monthly += 1;
    }
    return t;
  }, [rows]);

  /** Paid income by programme, for the breakdown table. */
  const byEvent = useMemo(() => {
    const m = new Map<string, { title: string; type: string; bookings: number; paid: number; pence: number; pending: number; noCharge: number }>();
    for (const r of rows ?? []) {
      const key = r.event_id;
      const row = m.get(key) ?? { title: r.event?.title ?? "Unknown programme", type: r.event?.programme_type ?? "", bookings: 0, paid: 0, pence: 0, pending: 0, noCharge: 0 };
      row.bookings += 1;
      const k = kindOf(r);
      if (k === "paid") { row.paid += 1; row.pence += r.membership ? r.membership.monthly_amount_pence * r.membership.months_paid : r.amount_pence; }
      else if (k === "pending") row.pending += 1;
      else if (k === "nocharge") row.noCharge += 1;
      m.set(key, row);
    }
    return [...m.values()].sort((a, b) => b.pence - a.pence || a.title.localeCompare(b.title));
  }, [rows]);

  const exportCsv = () => {
    const blob = new Blob([ledgerCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suffolk-tennis-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kindOptions: Array<{ value: Kind; label: string; count?: number }> = [
    { value: "all", label: "All", count: totals.count },
    { value: "paid", label: "Paid", count: totals.paidCount },
    { value: "pending", label: "Pending", count: totals.pendingCount },
    { value: "refunded", label: "Refunded", count: totals.refundedCount },
    { value: "nocharge", label: "No charge", count: totals.noCharge },
  ];

  if (rows === null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Ledger" hideTitleOnPhone description="Every booking, with the payment behind it." className="mb-0" />
        <SkeletonRows rows={6} avatar={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ledger"
        hideTitleOnPhone
        description="Every booking, with the payment behind it, the parent's contact details and the programme it is for."
        className="mb-0"
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}><Download className="w-4 h-4" /> Export CSV</Button>}
      />

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {/* Payment breakdown */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Paid", value: gbp(totals.paid), sub: `${totals.paidCount} booking${totals.paidCount === 1 ? "" : "s"}${totals.monthly ? ` · ${totals.monthly} monthly plan${totals.monthly === 1 ? "" : "s"}` : ""}`, tone: "text-emerald-700" },
          { label: "Awaiting payment", value: gbp(totals.pending), sub: `${totals.pendingCount} booking${totals.pendingCount === 1 ? "" : "s"}`, tone: "text-amber-700" },
          { label: "Refunded", value: gbp(totals.refunded), sub: `${totals.refundedCount} booking${totals.refundedCount === 1 ? "" : "s"}`, tone: "text-red-700" },
          { label: "No charge", value: String(totals.noCharge), sub: totals.issues ? `${totals.issues} with a payment issue` : "free or included places", tone: "text-foreground" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{c.label}</p>
            <p className={`mt-1 font-display text-2xl font-semibold leading-tight tabular ${c.tone}`}>{c.value}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {byEvent.length > 0 && phone && (
        <Section title="By programme" count={byEvent.length}>
          <ListGroup>
            {byEvent.map((e) => (
              <ListRow
                key={e.title}
                title={e.title}
                subtitle={`${e.bookings} booking${e.bookings === 1 ? "" : "s"} · ${e.paid} paid${e.pending ? ` · ${e.pending} pending` : ""}${e.noCharge ? ` · ${e.noCharge} no charge` : ""}`}
                meta={<span className="font-semibold tabular">{gbp(e.pence)}</span>}
                wrapTitle
                size="sm"
              />
            ))}
          </ListGroup>
        </Section>
      )}
      {byEvent.length > 0 && !phone && (
        <Section title="By programme" count={byEvent.length}>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Programme / event</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">No charge</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEvent.map((e) => (
                  <TableRow key={e.title}>
                    <TableCell className="font-medium">{e.title}<span className="ml-2 text-[11px] text-muted-foreground capitalize">{e.type}</span></TableCell>
                    <TableCell className="text-right tabular">{e.bookings}</TableCell>
                    <TableCell className="text-right tabular">{e.paid}</TableCell>
                    <TableCell className="text-right tabular">{e.pending}</TableCell>
                    <TableCell className="text-right tabular">{e.noCharge}</TableCell>
                    <TableCell className="text-right font-semibold tabular">{gbp(e.pence)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}

      <Section
        title="All bookings"
        count={filtered.length}
        description={filtered.length !== rows.length ? `${filtered.length} of ${rows.length} shown` : undefined}
      >
        <div className="mb-3 space-y-2">
          <div className="flex flex-col gap-2 md:flex-row">
            <SearchField value={query} onChange={setQuery} placeholder="Search child, parent, email, phone or programme" className="flex-1" />
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="md:w-72" aria-label="Programme or event"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programmes and events</SelectItem>
                {eventsInLedger.map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {phone ? (
            <ChipRow>
              {kindOptions.map((o) => (
                <Chip key={o.value} active={kind === o.value} current={kind === o.value} count={o.count} onClick={() => setKind(o.value)}>{o.label}</Chip>
              ))}
            </ChipRow>
          ) : (
            <SegmentedControl<Kind> value={kind} onChange={setKind} options={kindOptions} size="sm" ariaLabel="Payment status" />
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Receipt} title={rows.length === 0 ? "No bookings yet" : "Nothing matches"} description={rows.length === 0 ? "Bookings appear here the moment a parent accepts an invitation." : "Try a different search or filter."} compact />
        ) : phone ? (
          <ListGroup>
            {filtered.map((b) => {
              const pay = paymentLabel(b);
              const st = bookingStatus(b.status);
              return (
                <ListRow
                  key={b.id}
                  onClick={() => setOpen(b)}
                  title={b.child_name}
                  subtitle={b.event?.title ?? "Unknown programme"}
                  detail={<>{b.parent_name || b.parent_email}{b.phone ? ` · ${b.phone}` : ""}<span className="block">{pay.text}</span></>}
                  meta={<span className="font-semibold tabular">{b.complimentary || b.amount_pence === 0 ? "£0" : gbp(b.amount_pence)}</span>}
                  trailing={<StatusBadge tone={st.tone} dot={false}>{st.label}</StatusBadge>}
                  chevron
                  wrapTitle
                />
              );
            })}
          </ListGroup>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booked</TableHead>
                  <TableHead>Child</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Programme / event</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => {
                  const pay = paymentLabel(b);
                  const st = bookingStatus(b.status);
                  return (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => setOpen(b)}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{shortDate(b.created_at)}</TableCell>
                      <TableCell className="min-w-[10rem] font-medium">{b.child_name}</TableCell>
                      <TableCell>
                        <div>{b.parent_name || <span className="text-muted-foreground">No name on file</span>}</div>
                        <div className="max-w-[14rem] break-all text-xs text-muted-foreground">{b.parent_email}</div>
                        <div className="text-xs text-muted-foreground">{b.phone ?? <span className="text-red-600">no phone</span>}</div>
                      </TableCell>
                      <TableCell className="min-w-[12rem]">{b.event?.title ?? "Unknown programme"}{b.session_slot ? <div className="text-xs text-muted-foreground">{b.session_slot}</div> : null}</TableCell>
                      <TableCell className="max-w-[16rem]"><StatusBadge tone={pay.tone} dot={false} className="whitespace-normal text-left">{pay.text}</StatusBadge>{b.stripe_env === "sandbox" && <span className="ml-2 text-[11px] text-muted-foreground">sandbox</span>}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold tabular">{b.complimentary || b.amount_pence === 0 ? "£0" : gbp(b.amount_pence)}</TableCell>
                      <TableCell className="whitespace-nowrap"><StatusBadge tone={st.tone} dot={false}>{st.label}</StatusBadge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="md:max-w-md">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{open.child_name}</DialogTitle>
                <DialogDescription>{open.event?.title ?? "Unknown programme"}</DialogDescription>
              </DialogHeader>
              <KeyValueList items={[
                { label: "Status", value: <StatusBadge tone={bookingStatus(open.status).tone} dot={false}>{bookingStatus(open.status).label}</StatusBadge> },
                { label: "Payment", value: paymentLabel(open).text },
                { label: "Amount", value: open.complimentary || open.amount_pence === 0 ? "£0" : gbp(open.amount_pence) },
                { label: "Paid on", value: dateTime(open.paid_at), hidden: !open.paid_at },
                { label: "Booked on", value: dateTime(open.created_at) },
                { label: "Parent", value: open.parent_name || "No name on file" },
                { label: "Email", value: <a href={`mailto:${open.parent_email}`} className="inline-flex items-center gap-1 text-primary break-all"><Mail className="h-3.5 w-3.5 shrink-0" />{open.parent_email}</a> },
                { label: "Phone", value: open.phone ? <a href={`tel:${open.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 text-primary"><Phone className="h-3.5 w-3.5 shrink-0" />{open.phone}</a> : <span className="text-red-600">Not on file</span> },
                { label: "Session", value: open.session_slot, hidden: !open.session_slot },
                { label: "Notes for coaches", value: open.medical_notes, hidden: !open.medical_notes },
                { label: "Photo consent", value: open.photo_consent ? "Given" : "Not given" },
                { label: "Stripe", value: `${open.stripe_env ?? "—"}`, hidden: !open.stripe_env },
                { label: "Booking id", value: <span className="font-mono text-xs">{open.id}</span> },
              ]} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
