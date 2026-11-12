import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GooglePlaceReview {
  name?: string;
  rating?: number;
  text?: { text?: string };
  relativePublishTimeDescription?: string;
  publishTime?: string;
  authorAttribution?: {
    displayName?: string;
    photoUri?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')?.trim();
  if (!googleApiKey) {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'GOOGLE_PLACES_API_KEY not configured; using internal/cached social proof only.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing Supabase environment variables' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: settingsRows, error: settingsError } = await supabase
    .from('online_booking_settings')
    .select('tenant_id, google_place_id')
    .eq('is_active', true)
    .not('google_place_id', 'is', null);

  if (settingsError) {
    return new Response(
      JSON.stringify({ ok: false, error: settingsError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let syncedCount = 0;

  for (const row of settingsRows ?? []) {
    const placeId = String(row.google_place_id ?? '').trim();
    if (!placeId) continue;

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=reviews&languageCode=pt-BR`,
        {
          headers: {
            'X-Goog-Api-Key': googleApiKey,
          },
        },
      );

      if (!response.ok) continue;

      const payload = (await response.json()) as { reviews?: GooglePlaceReview[] };
      const positiveReviews = (payload.reviews ?? []).filter(
        (r) => typeof r.rating === 'number' && r.rating >= 4,
      );

      for (const review of positiveReviews) {
        const externalId =
          review.name ||
          `${row.tenant_id}-${review.authorAttribution?.displayName ?? 'anon'}-${review.publishTime ?? ''}`;

        const { error: upsertErr } = await supabase.from('tenant_reviews_cache').upsert(
          {
            tenant_id: row.tenant_id,
            external_review_id: externalId,
            author_name: review.authorAttribution?.displayName || 'Cliente Google',
            author_photo_url: review.authorAttribution?.photoUri || null,
            rating: review.rating ?? 5,
            comment: review.text?.text || null,
            relative_time_description: review.relativePublishTimeDescription || null,
            published_at: review.publishTime || new Date().toISOString(),
            source: 'google_places',
            is_visible: true,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,external_review_id' },
        );

        if (!upsertErr) {
          syncedCount += 1;
        }
      }
    } catch {
      // Keep processing remaining tenants on individual failure
    }
  }

  return new Response(
    JSON.stringify({ ok: true, syncedCount }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
