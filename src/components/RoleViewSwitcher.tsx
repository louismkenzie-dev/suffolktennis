import { Link, useLocation } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { User, ClipboardList, Shield } from "lucide-react";

/**
 * Staff view switcher: admins can jump between the Parent, Coach and Admin
 * views; coaches between Parent and Coach. Parents (no staff role) see
 * nothing — their hub is the only view. `onDark` adapts the pills for the
 * navy pages (Parent Hub header, Coach hub).
 */
const RoleViewSwitcher = ({ className = "", onDark = false }: { className?: string; onDark?: boolean }) => {
  const { isAdmin, canScan, loading } = useIsAdmin();
  const { pathname } = useLocation();
  if (loading || !canScan) return null;

  const views = [
    { to: "/parent-hub", label: "Parent", icon: User, show: true },
    { to: "/coach", label: "Coach", icon: ClipboardList, show: canScan },
    { to: "/admin", label: "Admin", icon: Shield, show: isAdmin },
  ].filter((v) => v.show);

  const shell = onDark ? "border-white/25 bg-white/10" : "border-border bg-muted/40";
  const inactive = onDark
    ? "text-white/75 hover:text-white"
    : "text-muted-foreground hover:text-foreground";

  return (
    <div className={`inline-flex rounded-full border p-0.5 ${shell} ${className}`}>
      {views.map((v) => {
        const active = pathname.startsWith(v.to);
        return (
          <Link
            key={v.to}
            to={v.to}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? "bg-lta-cyan text-suffolk-navy" : inactive
            }`}
          >
            <v.icon size={13} />
            {v.label}
          </Link>
        );
      })}
    </div>
  );
};

export default RoleViewSwitcher;
