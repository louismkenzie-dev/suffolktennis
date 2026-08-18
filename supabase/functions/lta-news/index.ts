const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/<[^>]*>/g, '')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const response = await fetch('https://www.lta.org.uk/news/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`LTA fetch failed: ${response.status}`);
    }

    const html = await response.text();

    const articles: Array<{
      title: string;
      summary: string;
      imageUrl: string;
      articleUrl: string;
      category: string;
    }> = [];

    const seen = new Set<string>();

    // Split HTML by lta-card--clickable anchors
    // Structure: <a class="lta-card--clickable" href="...">
    const cardParts = html.split('lta-card--clickable"');

    for (let i = 1; i < cardParts.length; i++) {
      const part = cardParts[i];

      // href comes right after the split point
      const hrefMatch = part.match(/^\s*href="([^"]+)"/);
      if (!hrefMatch) continue;

      let articleUrl = hrefMatch[1];
      if (!articleUrl.startsWith('http')) {
        articleUrl = 'https://www.lta.org.uk' + articleUrl;
      }

      // Skip non-news and duplicates
      if (seen.has(articleUrl)) continue;
      seen.add(articleUrl);

      // Find the closing </a> for this card block
      const cardEnd = part.indexOf('</a>');
      const cardHtml = cardEnd > -1 ? part.substring(0, cardEnd) : part.substring(0, 2000);

      // Extract title
      const titleMatch = cardHtml.match(/class="lta-card-title">\s*([\s\S]*?)\s*<\/p>/);
      const title = titleMatch ? decodeHtml(titleMatch[1]) : '';

      // Extract summary
      const summaryMatch = cardHtml.match(/class="card-text[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      const summary = summaryMatch ? decodeHtml(summaryMatch[1]) : '';

      // Extract image
      const imgMatch = cardHtml.match(/src="([^"]*(?:siteassets|news)[^"]*)"/);
      let imageUrl = imgMatch ? decodeHtml(imgMatch[1]) : '';
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = 'https://www.lta.org.uk' + imageUrl;
      }

      // Extract category
      const categoryMatch = cardHtml.match(/u-text-grey-ui-mid">\s*\n?\s*([\s\S]*?)\s*<\/p>/);
      const category = categoryMatch ? decodeHtml(categoryMatch[1]).replace(/\n/g, '').trim() : 'LTA News';

      if (title) {
        articles.push({ title, summary, imageUrl, articleUrl, category: category || 'LTA News' });
      }
    }

    console.log(`Parsed ${articles.length} articles from LTA news`);

    return new Response(
      JSON.stringify({ success: true, articles: articles.slice(0, 15) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching LTA news:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
