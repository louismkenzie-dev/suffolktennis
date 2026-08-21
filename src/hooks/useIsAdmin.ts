import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** The signed-in user's staff roles. `isAdmin` gates the admin dashboard;
 *  `canScan` (admin or coach) gates the venue ticket scanner. */
export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRoles(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!cancelled) {
        setRoles(new Set((data ?? []).map((r) => r.role as string)));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return {
    isAdmin: roles.has("admin"),
    isCoach: roles.has("coach"),
    canScan: roles.has("admin") || roles.has("coach"),
    loading,
  };
}
