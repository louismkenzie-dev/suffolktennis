// Edge function: AI-compose a Suffolk Tennis news article from a draft
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { title, draft } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const system = `You are an editor for Suffolk Tennis (a county tennis organisation in the UK).
Polish the admin's draft into a well-written news article.
- Keep facts exactly as written; don't invent results, names, scores or dates.
- British English. Friendly, professional tone. Active voice.
- 2-4 short paragraphs separated by blank lines. No headings, no markdown, no emojis.
- Refer to the organisation as "Suffolk Tennis" (never "Suffolk LTA").
Return ONLY the rewritten article body.`;

    const user = `Title: ${title || "(no title)"}\n\nDraft:\n${draft || ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
        status: 429, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Top up Lovable AI." }), {
        status: 402, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: `AI error: ${t}` }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
