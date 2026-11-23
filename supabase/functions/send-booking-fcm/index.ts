import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || 'project-f4b5d045-f344-4919-8e8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const {
      companion_id,
      booking_id,
      amount_rupees,
      services,
      client_name,
      client_location,
      distance_km,
      scheduled_time,
      duration_hours
    } = body;

    if (!companion_id || !booking_id) {
      return new Response(JSON.stringify({ error: 'companion_id and booking_id are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Retrieve Companion's latest FCM token from companion_profiles or users
    const { data: profile } = await supabase
      .from('companion_profiles')
      .select('fcm_token, is_online, user_id')
      .eq('user_id', companion_id)
      .maybeSingle();

    let fcmToken = profile?.fcm_token;

    if (!fcmToken) {
      const { data: user } = await supabase
        .from('users')
        .select('fcm_token')
        .eq('id', companion_id)
        .maybeSingle();
      fcmToken = user?.fcm_token;
    }

    if (!fcmToken) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Companion has no registered FCM token. Fallback to SSE/WebPush.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Construct Rapido Captain High-Priority DATA-ONLY Payload
    // CRITICAL: Top-level 'notification' object is strictly omitted to wake the Android background service/killed app
    const fcmPayload = {
      message: {
        token: fcmToken,
        android: {
          priority: 'high',
          ttl: '30s'
        },
        data: {
          type: 'INCOMING_BOOKING',
          booking_id: String(booking_id),
          amount_rupees: String(amount_rupees || '0'),
          client_name: String(client_name || 'Client'),
          client_location: String(client_location || 'Meeting Point'),
          distance_km: String(distance_km || '1.5'),
          scheduled_time: String(scheduled_time || 'Today'),
          selected_services: typeof services === 'string' ? services : JSON.stringify(services || []),
          duration_hours: String(duration_hours || '1'),
          countdown_seconds: '30',
          sent_at: new Date().toISOString()
        }
      }
    };

    // 3. Dispatch to Firebase HTTP v1 endpoint using GCP Workload Identity / Bearer Token
    // In production Cloud Run / Supabase Edge with ADC, fetch token from metadata server or service account
    let fcmResponseStatus = 200;
    let fcmResponseBody: any = { status: 'mock_or_direct_send' };

    const serverAccessToken = Deno.env.get('FIREBASE_SERVER_ACCESS_TOKEN');
    if (serverAccessToken) {
      const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;
      const res = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serverAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fcmPayload)
      });
      fcmResponseStatus = res.status;
      fcmResponseBody = await res.json().catch(() => ({}));
    }

    return new Response(JSON.stringify({
      success: true,
      fcm_status: fcmResponseStatus,
      payload: fcmPayload.message.data,
      response: fcmResponseBody
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
