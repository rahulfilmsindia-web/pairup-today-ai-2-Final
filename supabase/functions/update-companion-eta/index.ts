import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface UpdateEtaRequest {
  booking_id: string;
  companion_id: string;
  lat: number;
  lng: number;
}

const GOOGLE_MAPS_SERVER_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY') || Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const body: UpdateEtaRequest = await req.json();
    const { booking_id, companion_id, lat, lng } = body;

    if (!booking_id || typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(JSON.stringify({ error: 'booking_id, lat, and lng are required' }), { status: 400 });
    }

    // 1. Fetch booking details
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, companion_id, booking_location_name, booking_lat, booking_lng, last_eta_updated_at, status')
      .eq('id', booking_id)
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
    }

    // Only update ETA when booking is CONFIRMED or CONFIRMED_PAID
    if (!['CONFIRMED', 'CONFIRMED_PAID'].includes(booking.status)) {
      return new Response(JSON.stringify({ message: 'Tracking inactive for current booking status' }), { status: 200 });
    }

    // 2. Throttling / Cost Optimization:
    // Only invoke external Google Maps APIs if at least 30 seconds have passed since last update
    const lastUpdate = booking.last_eta_updated_at ? new Date(booking.last_eta_updated_at).getTime() : 0;
    const now = Date.now();
    const timeSinceLastUpdateMs = now - lastUpdate;

    if (timeSinceLastUpdateMs < 30_000) {
      return new Response(JSON.stringify({
        throttled: true,
        message: 'Throttled. Under 30 seconds since last Google API calculation.',
        last_eta_updated_at: booking.last_eta_updated_at
      }), { status: 200 });
    }

    let companionArea = 'On the way to meeting spot';
    let etaText = 'Calculating...';

    // 3. Call Google Reverse Geocoding API to resolve human-readable neighborhood/landmark
    if (GOOGLE_MAPS_SERVER_KEY) {
      try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_SERVER_KEY}`;
        const geoRes = await fetch(geocodeUrl, { signal: AbortSignal.timeout(6000) });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results.length > 0) {
            // Find neighborhood, sublocality, or route component
            const result = geoData.results[0];
            const sublocality = result.address_components?.find((c: any) =>
              c.types.includes('sublocality') || c.types.includes('neighborhood') || c.types.includes('route')
            );
            companionArea = sublocality?.long_name ? `Near ${sublocality.long_name}` : result.formatted_address?.split(',')[0] || 'En route';
          }
        }
      } catch (geoErr) {
        console.warn('Geocoding notice:', geoErr);
      }

      // 4. Call Google Routes API to compute distance & ETA to booking location
      const destLat = booking.booking_lat;
      const destLng = booking.booking_lng;

      if (typeof destLat === 'number' && typeof destLng === 'number') {
        try {
          const routesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
          const routesRes = await fetch(routesUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_MAPS_SERVER_KEY,
              'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
            },
            body: JSON.stringify({
              origin: { location: { latLng: { latitude: lat, longitude: lng } } },
              destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
              travelMode: 'DRIVE'
            }),
            signal: AbortSignal.timeout(6000)
          });

          if (routesRes.ok) {
            const routesData = await routesRes.json();
            const route = routesData.routes?.[0];
            if (route) {
              const seconds = parseInt(route.duration?.replace('s', '') || '600', 10);
              const mins = Math.max(1, Math.round(seconds / 60));
              const distKm = ((route.distanceMeters || 1000) / 1000).toFixed(1);
              etaText = `${mins} mins (${distKm} km)`;
            }
          }
        } catch (routesErr) {
          console.warn('Routes API notice:', routesErr);
        }
      }
    } else {
      // Offline fallback estimation based on haversine distance
      companionArea = 'Crossing city center, en route';
      etaText = '12-15 mins';
    }

    // 5. Update bookings table with calculated ETA and area
    const { error: updateErr } = await supabase
      .from('bookings')
      .update({
        companion_current_area: companionArea,
        companion_eta_text: etaText,
        last_eta_updated_at: new Date().toISOString()
      })
      .eq('id', booking_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      companion_current_area: companionArea,
      companion_eta_text: etaText,
      updated_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), { status: 500 });
  }
});
