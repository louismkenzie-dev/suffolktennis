/**
 * Suffolk Tennis app primitives — the small set of building blocks every
 * Parent, Coach and Admin screen is composed from. Mobile-first: rows are
 * comfortable to tap, surfaces are quiet, and the Suffolk blue is kept for
 * the active state, the primary action and the odd highlight.
 */
import * as React from "react";
import { ChevronRight, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------------------------------------------------------------- */
/* Page structure                                                     */
/* ---------------------------------------------------------------- */

export function PageHeader({ eyebrow, title, description, actions, className, children, hideTitleOnPhone = false }: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** The mobile top bar already names the section — avoid saying it twice. */
  hideTitleOnPhone?: boolean;
  description?: React.ReactNode;
  /** Right-aligned on wide screens, wraps under the title on phones. */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("mb-5 md:mb-7", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p>}
          <h1 className={cn("font-display text-[22px] font-semibold leading-tight text-foreground md:text-[26px]", hideTitleOnPhone && "hidden md:block")}>{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Section({ title, count, action, description, className, children }: {
  title?: React.ReactNode;
  count?: number | string;
  action?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-[15px] font-semibold leading-tight text-foreground md:text-base">
                {title}
                {count !== undefined && <span className="ml-1.5 font-normal text-muted-foreground tabular">{count}</span>}
              </h2>
            )}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A white surface. `inset` is the quieter grey variant for grouped info. */
export function Surface({ className, inset = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        inset ? "bg-muted/60" : "border border-border bg-card shadow-card",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------------- */
/* Lists                                                              */
/* ---------------------------------------------------------------- */

export function ListGroup({ className, children, flush = false }: {
  className?: string;
  children: React.ReactNode;
  /** No outer border/radius — for lists that sit inside another surface. */
  flush?: boolean;
}) {
  return (
    <div className={cn("divide-y divide-border", !flush && "overflow-hidden rounded-2xl border border-border bg-card shadow-card", className)}>
      {children}
    </div>
  );
}

export type ListRowProps = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Third line, for a parent or a note — muted and small. */
  detail?: React.ReactNode;
  /** Right-aligned text (a price, a date, a count). */
  meta?: React.ReactNode;
  /** Custom trailing element (badge, checkbox, button). */
  trailing?: React.ReactNode;
  chevron?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
  /** Vertical density. */
  size?: "sm" | "md" | "lg";
  as?: "div" | "li";
  ariaLabel?: string;
  /** Let the title run to two lines instead of truncating (event names). */
  wrapTitle?: boolean;
};

/**
 * The mobile answer to a table row: identity on the left, the important
 * facts stacked, a clear tap affordance on the right. The whole row is the
 * hit target when `onClick`/`href` is given.
 */
export const ListRow = React.forwardRef<HTMLDivElement, ListRowProps>(function ListRow(
  { leading, title, subtitle, detail, meta, trailing, chevron, selected, disabled, onClick, href, className, size = "md", ariaLabel, wrapTitle = false },
  ref,
) {
  const interactive = !!onClick || !!href;
  const pad = size === "sm" ? "min-h-[52px] px-4 py-2.5" : size === "lg" ? "min-h-[76px] px-4 py-4" : "min-h-[64px] px-4 py-3";
  const inner = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className={cn("text-[15px] font-medium leading-snug text-foreground", wrapTitle ? "line-clamp-2" : "truncate")}>{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[13px] leading-snug text-muted-foreground">{subtitle}</div>}
        {detail && <div className="mt-0.5 truncate text-[12px] leading-snug text-muted-foreground/80">{detail}</div>}
      </div>
      {meta && <div className="shrink-0 text-right text-[13px] text-muted-foreground tabular">{meta}</div>}
      {trailing && <div className="shrink-0 flex items-center">{trailing}</div>}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />}
    </>
  );
  const base = cn(
    "flex w-full items-center gap-3 bg-card text-left",
    pad,
    interactive && !disabled && "press cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-none focus-visible:bg-muted/60",
    selected && "bg-primary/[0.06] hover:bg-primary/[0.08]",
    disabled && "opacity-50",
    className,
  );
  if (href) {
    return <a ref={ref as never} href={href} className={base} aria-label={ariaLabel}>{inner}</a>;
  }
  if (onClick) {
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
        }}
        className={base}
      >
        {inner}
      </div>
    );
  }
  return <div ref={ref} className={base}>{inner}</div>;
});

/* ---------------------------------------------------------------- */
/* Identity                                                           */
/* ---------------------------------------------------------------- */

const AVATAR_SIZE = { xs: "h-7 w-7 text-[11px]", sm: "h-9 w-9 text-xs", md: "h-10 w-10 text-[13px]", lg: "h-14 w-14 text-base", xl: "h-20 w-20 text-xl" } as const;

export function initialsOf(name: string | null | undefined): string {
  return (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

/** Initials by default; a photo when there is one. `bucket` resolves a
 *  Supabase storage path to a signed URL. */
export function Avatar({ name, src, bucket, size = "md", className, square = false }: {
  name: string | null | undefined;
  src?: string | null;
  bucket?: string;
  size?: keyof typeof AVATAR_SIZE;
  className?: string;
  square?: boolean;
}) {
  const signed = useSignedUrl(bucket ?? "", bucket ? src : null);
  const url = bucket ? signed : src;
  const shape = square ? "rounded-xl" : "rounded-full";
  if (url) {
    return <img src={url} alt={name ?? ""} className={cn(AVATAR_SIZE[size], shape, "shrink-0 object-cover bg-muted", className)} loading="lazy" />;
  }
  return (
    <div
      aria-hidden
      className={cn(AVATAR_SIZE[size], shape, "flex shrink-0 select-none items-center justify-center bg-primary/10 font-semibold text-primary", className)}
    >
      {initialsOf(name)}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Controls                                                           */
/* ---------------------------------------------------------------- */

export function SegmentedControl<T extends string>({ value, onChange, options, className, size = "md" }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; count?: number; icon?: LucideIcon }>;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("inline-grid w-full rounded-xl bg-muted p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "min-h-8 text-[13px]" : "min-h-9 text-sm",
              active ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.10)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.icon && <o.icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />}
            <span className="truncate">{o.label}</span>
            {o.count !== undefined && <span className={cn("tabular text-[12px]", active ? "text-muted-foreground" : "text-muted-foreground/70")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Search", className, autoFocus, inputMode }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        enterKeyHint="search"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode={inputMode}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full appearance-none rounded-xl border border-input bg-card pl-10 pr-10 text-base text-foreground placeholder:text-muted-foreground/80 transition-[box-shadow,border-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="hit-area absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Chip({ active, children, onClick, count, className, icon: Icon }: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  count?: number;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
      {count !== undefined && <span className={cn("tabular text-[12px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>}
    </button>
  );
}

/** Horizontal, edge-to-edge scrolling row of chips; no scrollbar. */
export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 md:mx-0 md:flex-wrap md:px-0", className)}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Status                                                             */
/* ---------------------------------------------------------------- */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const TONE: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-600/15", dot: "bg-emerald-500" },
  warning: { pill: "bg-amber-50 text-amber-800 ring-amber-600/15", dot: "bg-amber-500" },
  danger: { pill: "bg-red-50 text-red-800 ring-red-600/15", dot: "bg-red-500" },
  info: { pill: "bg-sky-50 text-sky-800 ring-sky-600/15", dot: "bg-sky-500" },
  brand: { pill: "bg-primary/10 text-primary ring-primary/15", dot: "bg-primary" },
  neutral: { pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/60" },
};

export function StatusBadge({ tone = "neutral", children, dot = true, className }: {
  tone?: StatusTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5 ring-1 ring-inset", TONE[tone].pill, className)}>
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", TONE[tone].dot)} />}
      {children}
    </span>
  );
}

/** Booking / invitation status → tone + human label, shared by every screen. */
export function bookingStatus(status: string): { tone: StatusTone; label: string } {
  switch (status) {
    case "paid": return { tone: "success", label: "Confirmed" };
    case "booked": return { tone: "success", label: "Booked" };
    case "pending": return { tone: "warning", label: "Pending" };
    case "payment_failed": return { tone: "danger", label: "Payment issue" };
    case "invited": return { tone: "neutral", label: "Invited" };
    case "opened": return { tone: "info", label: "Opened" };
    case "revoked": return { tone: "danger", label: "Revoked" };
    case "cancelled": return { tone: "danger", label: "Cancelled" };
    case "expired": return { tone: "neutral", label: "Expired" };
    default: return { tone: "neutral", label: status.replace(/_/g, " ") };
  }
}

/* ---------------------------------------------------------------- */
/* States                                                             */
/* ---------------------------------------------------------------- */

export function EmptyState({ icon: Icon, title, description, action, className, compact = false }: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 text-center", compact ? "px-5 py-8" : "px-6 py-12", className)}>
      {Icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      )}
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground text-balance">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5, avatar = true, className }: { rows?: number; avatar?: boolean; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border", className)} aria-busy aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
          {avatar && <Skeleton className="h-10 w-10 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-[55%] rounded" />
            <Skeleton className="h-3 w-[35%] rounded" />
          </div>
          <Skeleton className="h-3 w-10 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-2 lg:grid-cols-3", className)} aria-busy aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("h-24 w-full rounded-2xl", className)} />;
}

/* ---------------------------------------------------------------- */
/* Detail pages                                                       */
/* ---------------------------------------------------------------- */

/** Label/value pairs in a quiet group — no card per field. */
export function KeyValueList({ items, className }: {
  items: Array<{ label: React.ReactNode; value: React.ReactNode; hidden?: boolean }>;
  className?: string;
}) {
  const shown = items.filter((i) => !i.hidden);
  if (shown.length === 0) return null;
  return (
    <dl className={cn("divide-y divide-border rounded-2xl border border-border bg-card", className)}>
      {shown.map((it, i) => (
        <div key={i} className="flex min-h-[48px] items-start justify-between gap-4 px-4 py-2.5">
          <dt className="shrink-0 pt-px text-[13px] text-muted-foreground">{it.label}</dt>
          <dd className="min-w-0 text-right text-[14px] font-medium text-foreground break-words">{it.value ?? <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Detail-page identity block: avatar, name, meta line, optional badges. */
export function IdentityHeader({ avatar, title, subtitle, badges, actions, className }: {
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-4">
        {avatar}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold leading-tight text-foreground md:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Forms                                                              */
/* ---------------------------------------------------------------- */

export function Field({ label, hint, error, required, htmlFor, children, className }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** A titled group of fields inside a form — whitespace and a heading, not a card each. */
export function FormGroup({ title, description, children, className }: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      {title && (
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Sticky bottom action bar for forms and multi-select flows. Sits above the
 * bottom navigation on phones when `aboveNav` is set; inline at the end of the
 * content on wider screens.
 */
export function ActionBar({ children, aboveNav = false, className, note }: {
  children: React.ReactNode;
  aboveNav?: boolean;
  className?: string;
  note?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky z-30 -mx-4 mt-6 border-t border-border bg-glass px-4 pt-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0",
        aboveNav ? "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-3" : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      <div className="flex items-center gap-2 [&>*]:min-w-0 [&>button]:flex-1 md:[&>button]:flex-none">{children}</div>
    </div>
  );
}

export function InlineNote({ tone = "neutral", icon: Icon, children, className }: {
  tone?: StatusTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  const bg: Record<StatusTone, string> = {
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-red-50 text-red-900 border-red-200",
    info: "bg-sky-50 text-sky-900 border-sky-200",
    brand: "bg-primary/[0.06] text-foreground border-primary/20",
    neutral: "bg-muted/70 text-foreground border-border",
  };
  return (
    <div className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug", bg[tone], className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
