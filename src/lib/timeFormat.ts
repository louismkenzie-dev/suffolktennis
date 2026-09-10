// Parent-facing time display. Parents, coaches and admins on the dance
// platform all asked for 12-hour times; 24-hour stays correct everywhere a
// value is compared, sorted, stored or fed to <input type="time"> — only the
// rendered text changes. "1.30pm" is the British convention (dot, no space).

/** "13:30:00" | "13:30" -> "1.30pm"; "09:00" -> "9am". */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = Number(hh);
  const m = Number(mm ?? 0);
  if (!Number.isFinite(h)) return t;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}.${String(m).padStart(2, "0")}${suffix}`;
}

/**
 * A range collapses the meridiem when both ends share it: "1.30–3.30pm",
 * but "11.30am–1.30pm". A missing end gives just the start.
 */
export function formatTimeRange(start: string | null | undefined, end?: string | null): string {
  if (!start) return "";
  if (!end) return formatTime(start);
  const a = formatTime(start);
  const b = formatTime(end);
  const sameMeridiem = a.slice(-2) === b.slice(-2);
  return sameMeridiem ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC timestamp in the compact form Google/Outlook calendar links want. */
function calendarStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

/**
 * "Add to calendar" links for a session. Dates are built from the local
 * (Europe/London) wall-clock date and time — `new Date("YYYY-MM-DDTHH:MM")`
 * in the parent's browser, which is where these links are clicked.
 * Sessions without a time default to 09:00 for two hours.
 */
export function calendarLinks(opts: {
  title: string;
  date: string;               // YYYY-MM-DD
  start?: string | null;      // HH:MM[:SS]
  end?: string | null;
  location?: string | null;
  details?: string | null;
}): { google: string; outlook: string } {
  const start = new Date(`${opts.date}T${(opts.start ?? "09:00").slice(0, 5)}:00`);
  const end = opts.end
    ? new Date(`${opts.date}T${opts.end.slice(0, 5)}:00`)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const text = encodeURIComponent(opts.title);
  const location = encodeURIComponent(opts.location ?? "");
  const details = encodeURIComponent(opts.details ?? "");
  return {
    google:
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}` +
      `&dates=${calendarStamp(start)}/${calendarStamp(end)}&location=${location}&details=${details}`,
    outlook:
      `https://outlook.live.com/calendar/0/action/compose?rru=addevent&subject=${text}` +
      `&startdt=${start.toISOString()}&enddt=${end.toISOString()}&location=${location}&body=${details}`,
  };
}
