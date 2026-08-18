import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Ideal Postcodes API key (same setup as School's Out Activities)
const IDEAL_POSTCODES_API_KEY = 'ak_mk2lz2nwEW2sSas7b4VVqYW3WqbkL';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postcode } = await req.json();

    if (!postcode) {
      return new Response(
        JSON.stringify({ error: 'Postcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPostcode = String(postcode).replace(/\s+/g, '').toUpperCase();
    const url = `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(cleanPostcode)}?api_key=${IDEAL_POSTCODES_API_KEY}`;

    console.log('Looking up postcode:', cleanPostcode);
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 2000 || !data.result || data.result.length === 0) {
      return new Response(
        JSON.stringify({ addresses: [], message: data.message || 'No addresses found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const addresses = data.result.map((addr: any) => {
      const line1Parts = [
        addr.sub_building_name,
        addr.building_name,
        addr.building_number,
        addr.thoroughfare || addr.dependant_thoroughfare,
      ].filter(Boolean);
      const addressLine1 = line1Parts.join(' ') || addr.line_1 || '';
      const addressLine2 = addr.line_2 || addr.dependant_locality || '';

      return {
        full_address: [addr.line_1, addr.line_2, addr.line_3, addr.post_town, addr.postcode]
          .filter(Boolean).join(', '),
        address_line_1: addr.line_1 || addressLine1,
        address_line_2: addr.line_2 || addressLine2,
        town_city: addr.post_town || '',
        county: addr.county || addr.traditional_county || '',
        postcode: addr.postcode || String(postcode).toUpperCase(),
        country: 'United Kingdom',
      };
    });

    return new Response(
      JSON.stringify({ addresses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error looking up postcode:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to lookup postcode' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
