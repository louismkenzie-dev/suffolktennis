/**
 * The shared shell for the signed-in product: Parent Hub, Coach Hub, Admin.
 *
 * Phone: a compact 56px top bar (mark · section title · account), the page,
 * and a bottom tab bar with the four most-used destinations plus "More" (a
 * sheet with everything else, the view switcher and sign out). Meaningful
 * content starts within ~60px of the top of the screen.
 *
 * Desktop: the same top bar with the wordmark, then a horizontal navigation
 * row with every destination, the view switcher and the account menu.
 */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ClipboardList, ExternalLink, LogOut, MoreHorizontal, Shield, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, ListGroup, ListRow } from "./primitives";
import { BrandLockup, BrandMark } from "@/components/app/BrandLogo";

export type NavItem = {
  id: string;
  label: string;
  /** Short label for the bottom bar (≤ 9 characters reads best). */
  short?: string;
  icon: LucideIcon;
  /** Route to navigate to instead of switching a tab. */
  to?: string;
  /** Small count shown on the item (e.g. invitations waiting). */
  badge?: number;
};

export type AppRole = "parent" | "coach" | "admin";

const ROLE_LABEL: Record<AppRole, string> = { parent: "Parent Hub", coach: "Coach Hub", admin: "Admin" };

const VIEWS: Array<{ role: AppRole; to: string; label: string; icon: LucideIcon; needs: "any" | "coach" | "admin" }> = [
  { role: "parent", to: "/parent-hub", label: "Parent", icon: User, needs: "any" },
  { role: "coach", to: "/coach", label: "Coach", icon: ClipboardList, needs: "coach" },
  { role: "admin", to: "/admin", label: "Admin", icon: Shield, needs: "admin" },
];

function useViews(role: AppRole) {
  const { isAdmin, canScan, loading } = useIsAdmin();
  const views = VIEWS.filter((v) => v.needs === "any" || (v.needs === "coach" ? canScan : isAdmin));
  return { views: loading || views.length < 2 ? [] : views, current: role };
}

/** Segmented view switcher — appears only for staff who have more than one view. */
export function ViewSwitcher({ role, className, onNavigate }: { role: AppRole; className?: string; onNavigate?: () => void }) {
  const { views } = useViews(role);
  if (views.length === 0) return null;
  return (
    <div className={cn("inline-grid rounded-xl bg-muted p-1", className)} style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Switch view">
      {views.map((v) => {
        const active = v.role === role;
        return (
          <Link
            key={v.role}
            to={v.to}
            role="tab"
            aria-selected={active}
            onClick={onNavigate}
            className={cn(
              "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all duration-150",
              active ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.10)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <v.icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({
  role, title, nav, primary, active, onNavigate, userName, userEmail, onSignOut, topActions, back, children, contentClassName, maxWidth = "max-w-6xl", hideBottomNav = false, subheader,
}: {
  role: AppRole;
  /** The current section, shown in the mobile top bar. */
  title: string;
  nav: NavItem[];
  /** Ids for the bottom bar (max 4). Defaults to the first four. */
  primary?: string[];
  active: string;
  onNavigate: (id: string) => void;
  userName?: string | null;
  userEmail?: string | null;
  onSignOut: () => void | Promise<void>;
  topActions?: React.ReactNode;
  /** Replaces the mark with a back link on phones (detail pages). */
  back?: { label: string; onClick?: () => void; to?: string };
  children: React.ReactNode;
  contentClassName?: string;
  maxWidth?: string;
  hideBottomNav?: boolean;
  /** Sticky strip under the top bar (e.g. a segmented control). */
  subheader?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const { views } = useViews(role);

  const primaryIds = primary ?? nav.slice(0, 4).map((n) => n.id);
  const primaryItems = primaryIds.map((id) => nav.find((n) => n.id === id)).filter(Boolean) as NavItem[];
  const moreItems = nav.filter((n) => !primaryIds.includes(n.id));
  const moreActive = moreItems.some((n) => n.id === active);
  const showBottom = !hideBottomNav && nav.length > 1;

  const go = (item: NavItem) => {
    setMoreOpen(false);
    if (item.to) { navigate(item.to); return; }
    onNavigate(item.id);
    window.scrollTo({ top: 0 });
  };

  const initials = userName || userEmail || "";

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      {/* ---------------- Top bar ---------------- */}
      <header className="sticky top-0 z-40 border-b border-border bg-glass pt-safe">
        <div className={cn("mx-auto flex h-14 items-center gap-3 px-4 md:px-6", maxWidth)}>
          {back ? (
            <button
              type="button"
              onClick={() => (back.onClick ? back.onClick() : back.to ? navigate(back.to) : navigate(-1))}
              className="hit-area -ml-2 inline-flex h-10 items-center gap-0.5 rounded-lg pl-1 pr-2 text-[15px] font-medium text-primary md:hidden"
            >
              <ChevronLeft className="h-5 w-5" /> {back.label}
            </button>
          ) : (
            <Link to="/" className="flex shrink-0 items-center md:hidden" aria-label="Suffolk Tennis home">
              <BrandMark />
            </Link>
          )}
          <Link to="/" className="hidden shrink-0 items-center md:flex" aria-label="Suffolk Tennis home">
            <BrandLockup />
          </Link>

          <div className="min-w-0 flex-1 md:hidden">
            <div className="flex items-baseline gap-2">
              <h1 className="truncate font-display text-[17px] font-semibold leading-none">{title}</h1>
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <span className="text-sm text-muted-foreground">{ROLE_LABEL[role]}</span>
          </div>

          {topActions && <div className="flex shrink-0 items-center gap-1">{topActions}</div>}
          <div className="hidden md:block"><ViewSwitcher role={role} /></div>
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Account"
            className="press hit-area inline-flex shrink-0 items-center gap-2 rounded-full"
          >
            <Avatar name={initials} size="sm" />
            {views.length > 0 && (
              <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">{role}</span>
            )}
          </button>
        </div>

        {/* Desktop navigation row */}
        {nav.length > 1 && (
          <nav aria-label="Sections" className="hidden border-t border-border md:block">
            <div className={cn("no-scrollbar mx-auto flex items-center gap-0.5 overflow-x-auto px-6 md:flex-wrap", maxWidth)}>
              {nav.map((item) => {
                const isActive = item.id === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors duration-150",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.2 : 1.8} />
                    {item.label}
                    {item.badge ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{item.badge}</span> : null}
                    <span className={cn("absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-colors", isActive ? "bg-primary" : "bg-transparent")} />
                  </button>
                );
              })}
            </div>
          </nav>
        )}
        {subheader && (
          <div className="md:border-t md:border-border">
            <div className={cn("mx-auto px-4 pb-3 pt-2.5 md:px-6 md:py-3", maxWidth)}>{subheader}</div>
          </div>
        )}
      </header>

      {/* ---------------- Page ---------------- */}
      <main className={cn("mx-auto w-full px-4 py-4 md:px-6 md:py-8", maxWidth, showBottom ? "pb-nav md:pb-10" : "pb-10", contentClassName)}>
        {children}
      </main>

      {/* ---------------- Bottom bar (phone) ---------------- */}
      {showBottom && (
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-glass-card pb-safe md:hidden">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${primaryItems.length + (moreItems.length ? 1 : 0)}, minmax(0, 1fr))` }}>
            {primaryItems.map((item) => {
              const isActive = item.id === active && !moreOpen;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150", isActive ? "text-primary" : "text-muted-foreground")}
                >
                  <span className="relative">
                    <item.icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.3 : 1.7} />
                    {item.badge ? (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{item.badge}</span>
                    ) : null}
                  </span>
                  {item.short ?? item.label}
                </button>
              );
            })}
            {moreItems.length > 0 && (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-expanded={moreOpen}
                className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150", moreOpen || moreActive ? "text-primary" : "text-muted-foreground")}
              >
                <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={moreOpen || moreActive ? 2.3 : 1.7} />
                More
              </button>
            )}
          </div>
        </nav>
      )}

      {/* ---------------- More sheet ---------------- */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="gap-3 md:max-w-sm">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
            <DialogDescription className="sr-only">Other sections</DialogDescription>
          </DialogHeader>
          <ListGroup>
            {moreItems.map((item) => (
              <ListRow
                key={item.id}
                size="sm"
                onClick={() => go(item)}
                selected={item.id === active}
                leading={<item.icon className={cn("h-5 w-5", item.id === active ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8} />}
                title={item.label}
                trailing={item.badge ? <span className="rounded-full bg-primary px-2 text-[11px] font-semibold leading-5 text-primary-foreground">{item.badge}</span> : undefined}
                chevron
              />
            ))}
          </ListGroup>
          {views.length > 0 && (
            <div className="pt-1">
              <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Switch view</p>
              <ViewSwitcher role={role} className="w-full" onNavigate={() => setMoreOpen(false)} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------- Account sheet ---------------- */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="gap-4 md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="sr-only">Account</DialogTitle>
            <DialogDescription className="sr-only">Your account and views</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={initials} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{userName || "Your account"}</p>
              {userEmail && <p className="truncate text-sm text-muted-foreground">{userEmail}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
            </div>
          </div>
          {views.length > 0 && (
            <div>
              <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Switch view</p>
              <ViewSwitcher role={role} className="w-full" onNavigate={() => setAccountOpen(false)} />
            </div>
          )}
          <ListGroup>
            <ListRow size="sm" href="/" leading={<ExternalLink className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />} title="Suffolk Tennis website" chevron />
            <ListRow
              size="sm"
              onClick={() => { setAccountOpen(false); void onSignOut(); }}
              leading={<LogOut className="h-5 w-5 text-destructive" strokeWidth={1.8} />}
              title={<span className="text-destructive">Sign out</span>}
            />
          </ListGroup>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Minimal shell for standalone flows (booking, ticket, scanner): a top bar
 *  with the mark and a back link, no navigation. */
export function FlowShell({ back, title, right, children, maxWidth = "max-w-2xl", className }: {
  back?: { label: string; to: string };
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}) {
  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-glass pt-safe">
        <div className={cn("mx-auto flex h-14 items-center gap-3 px-4 md:px-6", maxWidth)}>
          {back ? (
            <Link to={back.to} className="hit-area -ml-2 inline-flex h-10 items-center gap-0.5 rounded-lg pl-1 pr-2 text-[15px] font-medium text-primary">
              <ChevronLeft className="h-5 w-5" /> {back.label}
            </Link>
          ) : (
            <Link to="/" aria-label="Suffolk Tennis home" className="flex shrink-0 items-center">
              <BrandMark className="md:hidden" />
              <BrandLockup className="hidden md:block" />
            </Link>
          )}
          {title && <span className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold">{title}</span>}
          {!title && <span className="flex-1" />}
          {right}
          {back && (
            <Link to="/" aria-label="Suffolk Tennis home" className="flex shrink-0 items-center">
              <BrandMark />
            </Link>
          )}
        </div>
      </header>
      <main className={cn("mx-auto w-full px-4 py-5 pb-12 md:px-6 md:py-8", maxWidth, className)}>{children}</main>
    </div>
  );
}
