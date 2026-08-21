import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Google Routes API, called directly (requires the Routes API to be enabled
// on the Google Cloud project that owns GOOGLE_MAPS_API_KEY).
const ROUTES_URL = 'https://routes.googleapis.com';

type Club = { name: string; type: 'lead' | 'feeder'; lat: number; lng: number; postcode: string; slug?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { postcode, clubs } = await req.json() as { postcode: string; clubs: Club[] };
    if (!postcode || typeof postcode !== 'string' || !Array.isArray(clubs) || clubs.length === 0) {
      return new Response(JSON.stringify({ error: 'postcode and clubs are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const clean = postcode.trim().toUpperCase();
    if (clean.length < 5 || clean.length > 10) {
      return new Response(JSON.stringify({ error: 'Invalid postcode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Geocode postcode using free postcodes.io (UK).
    const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
    if (!pcRes.ok) {
      return new Response(JSON.stringify({ error: 'Postcode not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const pcJson = await pcRes.json();
    const origin = { lat: pcJson.result.latitude, lng: pcJson.result.longitude };
    const formatted = `${pcJson.result.admin_ward ?? ''}, ${pcJson.result.admin_district ?? ''}, ${pcJson.result.postcode}`;

    // 2. Call Google Routes computeRouteMatrix directly.
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY missing');

    const body = {
      origins: [{ waypoint: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } }, routeModifiers: { avoid_ferries: true } }],
      destinations: clubs.map((c) => ({
        waypoint: { location: { latLng: { latitude: c.lat, longitude: c.lng } } },
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    };

    const routesRes = await fetch(`${ROUTES_URL}/distanceMatrix/v2:computeRouteMatrix`, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
      },
      body: JSON.stringify(body),
    });

    if (!routesRes.ok) {
      const t = await routesRes.text();
      throw new Error(`Routes API ${routesRes.status}: ${t}`);
    }
    const matrix = await routesRes.json() as Array<{
      destinationIndex: number; duration?: string; distanceMeters?: number; condition?: string;
    }>;

    const results = clubs.map((club, idx) => {
      const row = matrix.find((m) => m.destinationIndex === idx);
      const durSec = row?.duration ? parseInt(String(row.duration).replace('s', ''), 10) : null;
      return {
        ...club,
        distance_meters: row?.distanceMeters ?? null,
        duration_seconds: durSec,
        reachable: row?.condition === 'ROUTE_EXISTS',
      };
    }).sort((a, b) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity));

    return new Response(JSON.stringify({ origin: { ...origin, formatted, postcode: pcJson.result.postcode }, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('nearest-clubs error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
