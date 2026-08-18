// Edge function: AI-compose a Suffolk Tennis news article from a draft
import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { title, draft } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
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

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      // Copy-editing is a light task — keep thinking on (the Opus 5 default)
      // but hold the effort down so it stays quick and cheap.
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: user }],
    });

    // A safety decline returns 200 with no usable text; surface it rather than
    // silently writing an empty article body back into the editor.
    if (message.stop_reason === "refusal") {
      return new Response(JSON.stringify({ error: "The model declined to rewrite this draft." }), {
        status: 422, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return new Response(JSON.stringify({ content }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
        status: 429, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return new Response(JSON.stringify({ error: "AI credentials rejected — check ANTHROPIC_API_KEY." }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (e instanceof Anthropic.APIError) {
      return new Response(JSON.stringify({ error: `AI error: ${e.message}` }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
