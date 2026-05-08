import { corsHeaders } from '@supabase/supabase-js/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      return new Response(JSON.stringify({ error: 'URL inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Follow up to 3 NetworkLinks
    let currentUrl = url;
    let kml = '';
    for (let i = 0; i < 3; i++) {
      const res = await fetch(currentUrl, { redirect: 'follow' });
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Error descargando KML: ${res.status}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      kml = await res.text();

      // If it contains a Point/LineString, we're done
      if (/<Point\b|<LineString\b|<Polygon\b/i.test(kml)) break;

      // Try to find another NetworkLink href to follow
      const hrefMatch = kml.match(/<NetworkLink[\s\S]*?<href>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/href>/i);
      if (!hrefMatch) break;
      currentUrl = hrefMatch[1].trim();
    }

    return new Response(JSON.stringify({ kml }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
