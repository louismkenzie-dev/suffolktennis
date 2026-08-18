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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { report_id, pdf_path, pdf_url } = body;
    if (!report_id || (!pdf_path && !pdf_url)) {
      return new Response(JSON.stringify({ error: "Missing report_id or pdf_path" }), { status: 400, headers: corsHeaders });
    }

    // Fetch the PDF: prefer storage download via service role, fall back to URL (legacy)
    let pdfBuffer: ArrayBuffer;
    if (pdf_path) {
      const { data: blob, error: dlErr } = await supabase.storage.from("report-pdfs").download(pdf_path);
      if (dlErr || !blob) throw new Error(`Failed to download PDF: ${dlErr?.message ?? "no data"}`);
      pdfBuffer = await blob.arrayBuffer();
    } else {
      const pdfResponse = await fetch(pdf_url);
      if (!pdfResponse.ok) throw new Error("Failed to fetch PDF");
      pdfBuffer = await pdfResponse.arrayBuffer();
    }
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    // Use Gemini to parse the PDF
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Parse this LTA Regional Performance Camp Progress Report PDF and extract the structured data. Return a JSON object with these exact fields:

{
  "programme": "string - the programme/venue name",
  "national_coach": "string - national coach name",
  "individual_coach": "string - individual coach name",
  "region": "string - region code e.g. C&E",
  "county": "string - county name",
  "talent_characteristics": [
    {
      "name": "string - characteristic name e.g. Confident to Attack",
      "descriptor": "string - descriptor text",
      "rating": number  // 1=Excelling, 2=Consistent, 3=Progressing, 4=Next Step Focus
    }
  ],
  "programme_review": [
    {
      "period": "string - e.g. Jan/Feb-26",
      "level": "string - e.g. RPC - 9&U",
      "ratings": [number or null for each talent characteristic]
    }
  ],
  "coach_comments": "string - any coach comments or assessment text, or null",
  "weekly_schedule": "string or null",
  "competitive_schedule": "string or null"
}

For talent_characteristics ratings: map "Excelling" to 1, "Consistent" to 2, "Progressing" to 3, "Next Step Focus" to 4. If you see numeric ratings in the programme review table, use those directly.

For programme_review: each row represents a time period. The ratings array should correspond to each talent characteristic in order. Use null for N/A or empty entries.

Return ONLY valid JSON, no markdown, no code blocks.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI parsing failed: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from AI");

    // Clean and parse the JSON response
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const parsed = JSON.parse(cleanContent);

    // Update the report with parsed data
    const updateData: Record<string, any> = {};
    if (parsed.programme) updateData.programme = parsed.programme;
    if (parsed.national_coach) updateData.national_coach = parsed.national_coach;
    if (parsed.individual_coach) updateData.individual_coach = parsed.individual_coach;
    if (parsed.region) updateData.region = parsed.region;
    if (parsed.county) updateData.county = parsed.county;
    if (parsed.talent_characteristics?.length) updateData.talent_characteristics = parsed.talent_characteristics;
    if (parsed.programme_review?.length) updateData.programme_review = parsed.programme_review;
    if (parsed.coach_comments) updateData.coach_comments = parsed.coach_comments;
    if (parsed.weekly_schedule) updateData.weekly_schedule = parsed.weekly_schedule;
    if (parsed.competitive_schedule) updateData.competitive_schedule = parsed.competitive_schedule;

    const { error: updateErr } = await supabase
      .from("player_reports")
      .update(updateData)
      .eq("id", report_id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, parsed: updateData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
