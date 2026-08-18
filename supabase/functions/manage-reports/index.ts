import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { action, child_id, report } = await req.json();

    if (action === "add_report" && child_id && report) {
      // Verify child belongs to user
      const { data: child } = await supabase
        .from("children")
        .select("id, parent_user_id")
        .eq("id", child_id)
        .single();

      if (!child) {
        return new Response(JSON.stringify({ error: "Child not found" }), { status: 404, headers: corsHeaders });
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("player_reports")
        .insert({
          child_id,
          report_title: report.report_title,
          report_date: report.report_date,
          programme: report.programme,
          national_coach: report.national_coach,
          individual_coach: report.individual_coach,
          region: report.region,
          county: report.county,
          talent_characteristics: report.talent_characteristics,
          programme_review: report.programme_review,
          coach_comments: report.coach_comments,
          weekly_schedule: report.weekly_schedule,
          competitive_schedule: report.competitive_schedule,
          report_pdf_url: report.report_pdf_url,
        })
        .select()
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true, report: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
