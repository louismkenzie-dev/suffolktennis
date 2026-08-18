// Edge function: lta-rankings
// Looks up a junior on LTA. Preferred path: BTM number → /find/player/DoSearch
// → /player-profile/<UUID>/ranking, then read the row for the configured
// publication id (default 51942, Combined Junior Ranking). County rank is
// derived by locating the player's numeric id in the county-filtered list.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://competitions.lta.org.uk';
const DEFAULT_PUBLICATION_ID = '51942';
const DEFAULT_CATEGORY_ID = '4546';

type Body = {
  name?: string;
  btmNumber?: string;
  ageGroup?: string;
  gender?: 'boy' | 'girl';
  dateOfBirth?: string;
  county?: string;
  publicationId?: string;
  categoryId?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const name = (body.name || '').trim();
  const btm = (body.btmNumber || '').replace(/\D/g, '');
  const county = (body.county || 'Suffolk').trim();
  const pub = body.publicationId || DEFAULT_PUBLICATION_ID;
  const cat = body.categoryId || DEFAULT_CATEGORY_ID;
  const targetYob = body.dateOfBirth ? new Date(body.dateOfBirth).getUTCFullYear() : null;

  if (!name && !btm) return json({ error: 'name or btmNumber required' }, 400);
  if (body.ageGroup === '8U') return json({ error: '8U players are not ranked' }, 400);

  try {
    const cookies = await acquireCookies();

    // 1. Resolve to a player profile.
    let profile: PlayerHit | null = null;
    if (btm) {
      profile = await searchAndPick(cookies, btm, name, targetYob, btm);
    }
    if (!profile && name) {
      profile = await searchAndPick(cookies, name, name, targetYob, btm);
    }

    if (!profile) {
      return json({
        success: false,
        reason: 'player_not_found',
        message: btm
          ? `No LTA player found for BTM ${btm}${name ? ` / "${name}"` : ''}.`
          : `No LTA player found for "${name}".`,
        fallbackUrl: countyFilteredUrl(pub, cat, county),
      });
    }

    // 2. Parse the player's full ranking page for the row matching the age group + gender.
    const rankHtml = await fetchHtml(`${BASE}/player-profile/${profile.uuid}/ranking`, cookies);
    const allRows = parseProfileRankingRows(rankHtml);

    const ageGroup = (body.ageGroup || '').toUpperCase(); // e.g. "9U"
    const genderLabel = body.gender === 'girl' ? 'GIRLS' : body.gender === 'boy' ? 'BOYS' : '';
    const match = pickRankingRow(allRows, ageGroup, genderLabel) ?? allRows[0] ?? null;

    // 3. County rank: only attempt when the ranking links to the requested publication.
    let countyRank: number | null = null;
    if (match && match.publicationId && match.playerNumericId) {
      const categoryGuess = match.categoryId || cat;
      let countyTotal = 0;
      for (let page = 1; page <= 8; page++) {
        const url =
          `${BASE}/ranking/category.aspx?id=${match.publicationId}&category=${categoryGuess}` +
          `&ps=100&C${categoryGuess}RFPC=${encodeURIComponent(county)}&p=${page}&order=1`;
        const html = await fetchHtml(url, cookies);
        const rows = parseRankingRows(html);
        if (rows.length === 0) break;
        for (const r of rows) {
          countyTotal += 1;
          if (r.playerNumericId === match.playerNumericId) { countyRank = countyTotal; break; }
        }
        if (countyRank) break;
        if (rows.length < 100) break;
      }
    }

    if (!match) {
      return json({
        success: false,
        reason: 'no_ranking_for_publication',
        message: `Found ${profile.name} (BTM ${profile.btm ?? '—'}), but no junior ranking entries on their LTA profile yet.`,
        profileUrl: `${BASE}/player-profile/${profile.uuid}`,
        fallbackUrl: countyFilteredUrl(pub, cat, county),
        matchedName: profile.name,
      });
    }

    return json({
      success: true,
      nationalRank: match.rank,
      countyRank,
      matchedName: profile.name,
      matchedBtm: profile.btm,
      matchedCategory: match.label,
      profileUrl: `${BASE}/player-profile/${profile.uuid}`,
      categoryUrl: countyFilteredUrl(pub, cat, county),
    });

  } catch (e) {
    console.error('lta-rankings error', e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function countyFilteredUrl(pub: string, cat: string, county: string) {
  return `${BASE}/ranking/category.aspx?id=${pub}&category=${cat}&ps=100&C${cat}RFPC=${encodeURIComponent(county)}&order=1`;
}

// ---------- cookie consent ----------
async function acquireCookies(): Promise<string> {
  const res = await fetch(`${BASE}/cookiewall/Save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Origin: BASE,
      Referer: `${BASE}/ranking/`,
    },
    body: 'Necessary=true&BasicAnalytics=true&PersonalizedAds=true&Performance=true&ThirdPartyCookies=true',
    redirect: 'manual',
  });
  await res.text();
  const jar: string[] = [];
  const sc = res.headers.getSetCookie?.() || [];
  for (const c of sc) jar.push(c.split(';')[0]);
  for (const [k, v] of res.headers.entries()) {
    if (k.toLowerCase() === 'set-cookie') {
      const part = v.split(';')[0];
      if (!jar.includes(part)) jar.push(part);
    }
  }
  const cookieStr = jar.join('; ');
  return cookieStr
    ? cookieStr +
        '; CookieConsent=necessary:true,analytics:true,personalizedAds:true,performance:true,thirdPartyCookies:true'
    : 'CookieConsent=necessary:true,analytics:true,personalizedAds:true,performance:true,thirdPartyCookies:true';
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchHtml(url: string, cookies: string, extra: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      Cookie: cookies,
      Referer: BASE,
      ...extra,
    },
  });
  return await res.text();
}

// ---------- player search ----------
type PlayerHit = { uuid: string; name: string; btm: string | null; numericId: string | null };

async function searchAndPick(
  cookies: string,
  query: string,
  expectedName: string,
  targetYob: number | null,
  expectedBtm: string,
): Promise<PlayerHit | null> {
  const url = `${BASE}/find/player/DoSearch?Query=${encodeURIComponent(query)}&SportID=2&Page=1&LoadMoreResults=false`;
  const html = await fetchHtml(url, cookies, { 'X-Requested-With': 'XMLHttpRequest' });
  const hits = parseSearchHits(html);
  if (hits.length === 0) return null;
  if (expectedBtm) {
    const exact = hits.find((h) => h.btm === expectedBtm);
    if (exact) return enrichWithNumericId(cookies, exact);
  }
  // Otherwise fuzzy match by name.
  const ranked = hits
    .map((h) => ({ h, score: nameScore(h.name, expectedName) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < 0.6) return null;
  return enrichWithNumericId(cookies, top.h);
}

function parseSearchHits(html: string): PlayerHit[] {
  const out: PlayerHit[] = [];
  const itemRe = /<li class="list__item">([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null) {
    const block = m[1];
    const link = block.match(/href="\/player-profile\/([A-F0-9-]{36})"[^>]*class="nav-link media__link"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i);
    if (!link) continue;
    const btmMatch = block.match(/<span[^>]*class="media__title-aside"[^>]*>\(?(\d+)\)?<\/span>/i);
    out.push({
      uuid: link[1],
      name: link[2].trim(),
      btm: btmMatch ? btmMatch[1] : null,
      numericId: null,
    });
  }
  return out;
}

async function enrichWithNumericId(cookies: string, hit: PlayerHit): Promise<PlayerHit> {
  // Numeric player id is embedded in ranking row links: /ranking/player.aspx?id=...&player=NUMERIC
  try {
    const html = await fetchHtml(`${BASE}/player-profile/${hit.uuid}/ranking`, cookies);
    const m = html.match(/\/ranking\/player\.aspx\?id=\d+&player=(\d+)/i);
    if (m) hit.numericId = m[1];
  } catch {/* ignore */}
  return hit;
}

// ---------- ranking page on player profile ----------
type ProfileRankRow = {
  label: string;          // e.g. "9U Boys", "12U Boys Singles"
  rank: number | null;
  publicationId: string | null;
  categoryId: string | null;
  playerNumericId: string | null;
};

function parseProfileRankingRows(html: string): ProfileRankRow[] {
  const out: ProfileRankRow[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html)) !== null) {
    const cells = tr[1];
    const link = cells.match(/<a[^>]*href="\/ranking\/player\.aspx\?id=(\d+)(?:&(?:amp;)?category=(\d+))?&(?:amp;)?player=(\d+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const tds: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let m: RegExpExecArray | null;
    while ((m = tdRe.exec(cells)) !== null) tds.push(stripTags(m[1]));
    let rank: number | null = null;
    for (const td of tds) { const v = firstInt(td); if (v != null) { rank = v; break; } }
    out.push({
      label: stripTags(link[4]).trim(),
      rank,
      publicationId: link[1],
      categoryId: link[2] ?? null,
      playerNumericId: link[3],
    });
  }
  return out;
}

function pickRankingRow(
  rows: ProfileRankRow[],
  ageGroup: string,
  genderLabel: string,
): ProfileRankRow | null {
  if (rows.length === 0) return null;
  const ag = (ageGroup || '').toUpperCase();
  // Prefer exact match on "<AG> <Gender>" (e.g. "9U BOYS"); fall back to age group only.
  const scored = rows.map((r) => {
    const label = r.label.toUpperCase();
    let score = 0;
    if (ag && label.includes(ag)) score += 2;
    if (genderLabel && label.includes(genderLabel)) score += 2;
    if (/SINGLES/.test(label)) score += 0.5;
    return { r, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].r : rows[0];
}


// ---------- county-filtered ranking parsing ----------
type RankRow = {
  nationalRank: number | null;
  name: string;
  yearOfBirth: number | null;
  profileUrl: string | null;
  playerNumericId: string | null;
};

function parseRankingRows(html: string): RankRow[] {
  const rows: RankRow[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(html)) !== null) {
    const cells = trMatch[1];
    if (/<th[\s>]/i.test(cells)) continue;
    const playerLink = cells.match(/<a[^>]*href="([^"]*player[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!playerLink) continue;

    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tdValues: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = tdRe.exec(cells)) !== null) tdValues.push(stripTags(cellMatch[1]).trim());

    const nationalRank = firstInt(tdValues[0]);
    let yearOfBirth: number | null = null;
    for (const v of tdValues) {
      const m = v.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
      if (m) { yearOfBirth = parseInt(m[1], 10); break; }
    }
    const numericMatch = playerLink[1].match(/[?&]player=(\d+)/i);
    rows.push({
      nationalRank,
      name: stripTags(playerLink[2]).replace(/\s+/g, ' ').trim(),
      yearOfBirth,
      profileUrl: absoluteUrl(playerLink[1]),
      playerNumericId: numericMatch ? numericMatch[1] : null,
    });
  }
  return rows;
}

function firstInt(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function absoluteUrl(href: string): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${BASE}${href}`;
  return `${BASE}/ranking/${href}`;
}

// ---------- name scoring ----------
function nameScore(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const x = norm(a); const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.95;
  const xs = x.split(' '); const ys = y.split(' ');
  const overlap = xs.filter((t) => ys.includes(t)).length;
  if (overlap >= 2) return 0.85;
  if (overlap === 1) return 0.6;
  return 0;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
