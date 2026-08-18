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
    .replace(/<[^>]*>/g, '')
    .trim();
}

const SEARCH_URL = 'https://competitions.lta.org.uk/find?DateFilterType=0&StartDate=2026-03-13&EndDate=2026-12-31&LocationFilterType=1&Distance=15&page=1&LocationCode=A090AB1B-D639-4765-92FC-6FE361EEFDB9&AgeGroupIDList%5B0%5D=8&AgeGroupIDList%5B1%5D=9&AgeGroupIDList%5B2%5D=10&AgeGroupIDList%5B3%5D=11&AgeGroupIDList%5B4%5D=12&AgeGroupIDList%5B5%5D=14&AgeGroupIDList%5B6%5D=16&AgeGroupIDList%5B7%5D=18';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Strategy 1: POST cookie consent, collect Set-Cookie, then fetch with those cookies
    const cookieRes = await fetch('https://competitions.lta.org.uk/cookiewall/Save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': 'https://competitions.lta.org.uk',
        'Referer': SEARCH_URL,
      },
      body: 'Necessary=true&BasicAnalytics=true&PersonalizedAds=true&Performance=true&ThirdPartyCookies=true',
      redirect: 'manual',
    });

    // Collect all cookies from the response
    const cookies: string[] = [];
    const setCookieHeaders = cookieRes.headers.getSetCookie?.() || [];
    for (const sc of setCookieHeaders) {
      const cookiePart = sc.split(';')[0];
      cookies.push(cookiePart);
    }
    // Also check regular headers iteration
    for (const [key, value] of cookieRes.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        const cookiePart = value.split(';')[0];
        if (!cookies.includes(cookiePart)) {
          cookies.push(cookiePart);
        }
      }
    }
    await cookieRes.text();

    const cookieString = cookies.join('; ');
    console.log(`Cookie consent: status=${cookieRes.status}, cookies=${cookies.length}`);

    // Strategy 2: Also try with a manual CookieConsent cookie
    const allCookies = cookieString 
      ? cookieString + '; CookieConsent=necessary:true,analytics:true,personalizedAds:true,performance:true,thirdPartyCookies:true'
      : 'CookieConsent=necessary:true,analytics:true,personalizedAds:true,performance:true,thirdPartyCookies:true';

    // Follow any redirect from the consent POST
    const location = cookieRes.headers.get('location');
    const fetchUrl = location && location.startsWith('http') ? location : SEARCH_URL;

    const pageRes = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Cookie': allCookies,
        'Referer': 'https://competitions.lta.org.uk/',
      },
    });

    const html = await pageRes.text();
    console.log(`Page fetch: status=${pageRes.status}, length=${html.length}, hasCookieWall=${html.includes('cookiewall') || html.includes('message-page')}`);

    // Check if we got past the cookie wall
    if (!html.includes('message-page') && !html.includes('cookiewall/Save')) {
      const events = parseEventsFromHtml(html);
      if (events.length > 0) {
        console.log(`Parsed ${events.length} live events`);
        return respond({ success: true, source: 'live', events });
      }
    }

    // If still blocked, try fetching the search URL directly one more time
    // with a different cookie format
    console.log('First attempt blocked, trying alternative cookie format...');
    const altRes = await fetch(SEARCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cookie': 'CookieConsent={necessary:true%2Canalytics:true%2CpersonalizedAds:true%2Cperformance:true%2CthirdPartyCookies:true}',
        'Cache-Control': 'no-cache',
      },
    });

    const altHtml = await altRes.text();
    console.log(`Alt fetch: status=${altRes.status}, length=${altHtml.length}, hasCookieWall=${altHtml.includes('message-page')}`);

    if (!altHtml.includes('message-page') && !altHtml.includes('cookiewall/Save')) {
      const events = parseEventsFromHtml(altHtml);
      if (events.length > 0) {
        console.log(`Parsed ${events.length} live events from alt fetch`);
        return respond({ success: true, source: 'live', events });
      }
    }

    // Fallback to curated events
    console.log('All scraping attempts blocked, returning curated events');
    return respond({ success: true, source: 'curated', events: getSuffolkEvents() });
  } catch (error) {
    console.error('Error fetching LTA events:', error);
    return respond({ success: true, source: 'curated', events: getSuffolkEvents() });
  }
});

function respond(data: object): Response {
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function parseEventsFromHtml(html: string): Array<{
  title: string;
  date: string;
  endDate?: string;
  location: string;
  category: string;
  grade: string;
  ageGroups?: string[];
  url: string;
}> {
  const events: Array<{
    title: string;
    date: string;
    endDate?: string;
    location: string;
    category: string;
    grade: string;
    ageGroups?: string[];
    url: string;
  }> = [];

  // TournamentSoftware uses media cards with tournament info
  // Try multiple parsing strategies

  // Strategy A: Look for tournament list items with links
  const itemRegex = /<a[^>]*href="(\/tournament\/[^"]*)"[^>]*>[\s\S]*?<\/a>/gi;
  const items = html.match(itemRegex) || [];
  
  for (const item of items) {
    const hrefMatch = item.match(/href="([^"]*)"/);
    const titleMatch = item.match(/<h[34][^>]*>([\s\S]*?)<\/h[34]>/);
    const dateMatch = item.match(/datetime="([^"]*)"/);
    const locationMatch = item.match(/(?:venue|location|address)[^>]*>([\s\S]*?)<\/(?:span|div|p)/i);
    
    if (hrefMatch && titleMatch) {
      const title = decodeHtml(titleMatch[1]);
      events.push({
        title,
        date: dateMatch ? dateMatch[1].split('T')[0] : '',
        location: locationMatch ? decodeHtml(locationMatch[1]) : '',
        category: categorizeEvent(title),
        grade: extractGrade(title),
        ageGroups: extractAgeGroups(item),
        url: `https://competitions.lta.org.uk${hrefMatch[1]}`,
      });
    }
  }

  // Strategy B: Look for media blocks
  if (events.length === 0) {
    const mediaBlocks = html.split(/class="[^"]*media[^"]*"/);
    for (let i = 1; i < mediaBlocks.length; i++) {
      const block = mediaBlocks[i].substring(0, 2000);
      const hrefMatch = block.match(/href="([^"]*tournament[^"]*)"/);
      const titleMatch = block.match(/<h[34][^>]*>([\s\S]*?)<\/h[34]>/);
      const dateMatch = block.match(/datetime="([^"]*)"/);
      
      if (hrefMatch && titleMatch) {
        const title = decodeHtml(titleMatch[1]);
        const href = hrefMatch[1];
        events.push({
          title,
          date: dateMatch ? dateMatch[1].split('T')[0] : '',
          location: '',
          category: categorizeEvent(title),
          grade: extractGrade(title),
          ageGroups: extractAgeGroups(block),
          url: href.startsWith('http') ? href : `https://competitions.lta.org.uk${href}`,
        });
      }
    }
  }

  return events;
}

function categorizeEvent(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('camp')) return 'Camp';
  if (t.includes('festival')) return 'Festival';
  if (t.includes('county') && t.includes('championship')) return 'County Championship';
  if (t.includes('tour final')) return 'Tour Finals';
  if (t.includes('tour')) return 'Junior Tour';
  if (t.includes('championship')) return 'Championship';
  return 'Junior Tournament';
}

function extractGrade(title: string): string {
  const match = title.match(/grade\s*(\d)/i);
  return match ? `Grade ${match[1]}` : '';
}

function extractAgeGroups(html: string): string[] {
  const groups: string[] = [];
  const matches = html.match(/\b(\d{1,2}U)\b/g);
  if (matches) {
    for (const m of matches) {
      if (!groups.includes(m)) groups.push(m);
    }
  }
  return groups;
}

function getSuffolkEvents() {
  // Real LTA competition listings for Suffolk / Ipswich area, junior age groups
  // Last updated: 16 March 2026
  const LTA_SEARCH = "https://competitions.lta.org.uk/find?DateFilterType=0&StartDate=2026-03-13&EndDate=2026-12-31&LocationFilterType=1&Distance=15&page=1&LocationCode=A090AB1B-D639-4765-92FC-6FE361EEFDB9";
  return [
    {
      title: "Matchplay",
      date: "2026-03-21",
      location: "Culford Sports & Tennis Centre",
      category: "LTA Youth Matchplay",
      grade: "Grade 6",
      ageGroups: ["18U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - David Lloyd Club Ipswich",
      date: "2026-03-28",
      location: "David Lloyd Club Ipswich",
      category: "Junior Tour",
      grade: "Grade 5",
      ageGroups: ["9U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - Ipswich Sports Club",
      date: "2026-03-29",
      location: "Ipswich Sports Club",
      category: "Junior Tour",
      grade: "Grade 5",
      ageGroups: ["Open", "10U"],
      url: LTA_SEARCH,
    },
    {
      title: "Play Your Way to Wimbledon 2026 - Risbygate Tennis Club",
      date: "2026-04-01",
      endDate: "2026-04-26",
      location: "Risbygate Tennis Club",
      category: "Play Your Way to Wimbledon",
      grade: "Grade 6",
      ageGroups: ["Open", "14U", "18U"],
      url: LTA_SEARCH,
    },
    {
      title: "David Lloyd Ipswich Matchplay",
      date: "2026-04-04",
      location: "David Lloyd Club Ipswich",
      category: "LTA Youth Matchplay",
      grade: "Grade 6",
      ageGroups: ["11U", "12U", "14U", "16U", "18U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - Felixstowe Lawn Tennis Club",
      date: "2026-04-05",
      location: "Felixstowe Lawn Tennis Club",
      category: "Junior Tour",
      grade: "Grade 5",
      ageGroups: ["9U", "11U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - David Lloyd Club Ipswich",
      date: "2026-04-11",
      location: "David Lloyd Club Ipswich",
      category: "Junior Tour",
      grade: "Grade 5",
      ageGroups: ["16U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - Ipswich Sports Club",
      date: "2026-04-12",
      location: "Ipswich Sports Club",
      category: "Junior Tour",
      grade: "Grade 5",
      ageGroups: ["8U", "11U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - Culford Sports & Tennis Centre",
      date: "2026-04-25",
      location: "Culford Sports & Tennis Centre",
      category: "Junior Tour",
      grade: "Grade 4",
      ageGroups: ["10U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - Culford Sports & Tennis Centre",
      date: "2026-05-09",
      location: "Culford Sports & Tennis Centre",
      category: "Junior Tour",
      grade: "Grade 4",
      ageGroups: ["Open", "16U"],
      url: LTA_SEARCH,
    },
    {
      title: "David Lloyd Ipswich Matchplay",
      date: "2026-05-16",
      location: "David Lloyd Club Ipswich",
      category: "LTA Youth Matchplay",
      grade: "Grade 6",
      ageGroups: ["11U", "12U", "14U", "16U", "18U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - Culford Sports & Tennis Centre",
      date: "2026-05-23",
      location: "Culford Sports & Tennis Centre",
      category: "Junior Tour",
      grade: "Grade 5",
      ageGroups: ["8U"],
      url: LTA_SEARCH,
    },
    {
      title: "Ipswich Sports Club Junior Open 2026",
      date: "2026-05-25",
      endDate: "2026-05-31",
      location: "Ipswich Sports Club",
      category: "Junior Tournament",
      grade: "Grade 3",
      ageGroups: ["Open", "8U", "9U", "10U", "11U", "12U", "14U", "16U", "18U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - Culford Sports & Tennis Centre",
      date: "2026-06-13",
      location: "Culford Sports & Tennis Centre",
      category: "Junior Tour",
      grade: "Grade 4",
      ageGroups: ["18U"],
      url: LTA_SEARCH,
    },
    {
      title: "David Lloyd Ipswich Matchplay",
      date: "2026-06-13",
      location: "David Lloyd Club Ipswich",
      category: "LTA Youth Matchplay",
      grade: "Grade 6",
      ageGroups: ["11U", "12U", "14U", "16U", "18U"],
      url: LTA_SEARCH,
    },
    {
      title: "Central & East Tour - Culford Sports & Tennis Centre",
      date: "2026-06-27",
      location: "Culford Sports & Tennis Centre",
      category: "Junior Tour",
      grade: "Grade 4",
      ageGroups: ["9U"],
      url: LTA_SEARCH,
    },
    {
      title: "Play Your Way to Wimbledon - Suffolk County Singles Finals 2026",
      date: "2026-06-28",
      location: "Felixstowe Lawn Tennis Club",
      category: "Play Your Way to Wimbledon",
      grade: "Grade 4",
      ageGroups: ["14U"],
      url: LTA_SEARCH,
    },
    {
      title: "132nd Framlingham Lawn Tennis Tournament 2026",
      date: "2026-08-03",
      endDate: "2026-08-08",
      location: "Framlingham College",
      category: "Junior Tournament",
      grade: "Grade 3",
      ageGroups: ["Open", "8U", "9U", "10U", "11U", "12U", "14U", "16U", "18U"],
      url: LTA_SEARCH,
    },
    {
      title: "96th Neil Songer Felixstowe Junior and Open Tournament 2026",
      date: "2026-08-16",
      endDate: "2026-08-22",
      location: "Felixstowe Lawn Tennis Club",
      category: "Junior Tournament",
      grade: "Grade 3",
      ageGroups: ["Open", "8U", "9U", "10U", "11U", "12U", "14U", "16U", "18U"],
      url: LTA_SEARCH,
    },
  ];
}
