// Netlify Edge Function: GET /api/geo
//
// Exposes just enough of the visitor's geo context (from Netlify's own edge
// request data — no external IP-lookup service, no API key) for
// contact.html to show a small "exporting to <country>?" note. This is the
// one piece of the region-aware note that genuinely can't be done in
// browser JS: client-side code has no reliable way to see the visitor's
// real country without calling out to a third-party service.
export default async (request, context) => {
  const country = context.geo && context.geo.country;

  return new Response(
    JSON.stringify({
      country: (country && country.name) || null,
      countryCode: (country && country.code) || null,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
};

export const config = { path: '/api/geo' };
