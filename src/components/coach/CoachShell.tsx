// The Coach Hub's AppShell: one "Register" section plus a shortcut to the
// scanner. Sub-pages pass `back` so phones get a back link instead of the mark.
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, QrCode } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, type NavItem } from "@/components/app";

const NAV: NavItem[] = [
  { id: "register", label: "Register", icon: ClipboardList },
  { id: "scan", label: "Scanner", icon: QrCode, to: "/admin/scan" },
];

export function CoachShell({ title, back, topActions, children }: {
  title: string;
  back?: { label: string; to: string };
  topActions?: ReactNode;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const coachName = (user?.user_metadata?.full_name as string | undefined) ?? null;
  return (
    <AppShell
      role="coach"
      title={title}
      nav={NAV}
      primary={["register", "scan"]}
      active="register"
      onNavigate={(id) => { if (id === "register") navigate("/coach"); }}
      userName={coachName}
      userEmail={user?.email}
      onSignOut={async () => { await signOut(); window.location.assign("/"); }}
      back={back}
      topActions={topActions}
      maxWidth="max-w-2xl"
    >
      {children}
    </AppShell>
  );
}
