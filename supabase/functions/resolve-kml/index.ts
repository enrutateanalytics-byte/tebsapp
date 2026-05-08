const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      return new Response(JSON.stringify({ error: 'URL inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let currentUrl = url;
    let kml = '';
    for (let i = 0; i < 3; i++) {
      console.log(`Fetching KML (iteration ${i}): ${currentUrl}`);
      const res = await fetch(currentUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/vnd.google-earth.kml+xml, application/xml, text/xml, */*',
        },
      });
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Error descargando KML: ${res.status}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      kml = await res.text();

      if (/<Point\b|<LineString\b|<Polygon\b/i.test(kml)) break;

      const hrefMatch = kml.match(/<NetworkLink[\s\S]*?<href>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/href>/i);
      if (!hrefMatch) break;
      currentUrl = hrefMatch[1].trim();
    }

    return new Response(JSON.stringify({ kml }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
