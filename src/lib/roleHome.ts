import { supabase } from "@/integrations/supabase/client";

/** The landing view for a signed-in user: admins → admin dashboard,
 *  coaches → coach hub, everyone else → parent hub. */
export async function roleHomePath(userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((data ?? []).map((r) => r.role as string));
    if (roles.has("admin")) return "/admin";
    if (roles.has("coach")) return "/coach";
  } catch {
    // fall through to the parent hub
  }
  return "/parent-hub";
}
