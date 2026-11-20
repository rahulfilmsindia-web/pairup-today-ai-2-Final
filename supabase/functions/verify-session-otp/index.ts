import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const { booking_id, entered_otp } = await req.json();

    if (!booking_id || !entered_otp) {
      return new Response(JSON.stringify({ error: 'booking_id and entered_otp are required' }), { status: 400 });
    }

    const cleanOtp = String(entered_otp).trim();

    // 1. Fetch booking
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, session_otp, status, companion_id, client_id')
      .eq('id', booking_id)
      .single();

    if (fetchErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
    }

    if (!['CONFIRMED', 'CONFIRMED_PAID', 'COMPANION_ARRIVED'].includes(booking.status)) {
      return new Response(JSON.stringify({ error: 'Booking status does not allow session OTP verification' }), { status: 400 });
    }

    // 2. Validate OTP
    if (booking.session_otp && booking.session_otp.trim() === cleanOtp) {
      // Transition status to ONGOING
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({
          status: 'ONGOING',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', booking_id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
      }

      // Stop tracking by purging companion live coordinates
      await supabase
        .from('companion_live_coords')
        .delete()
        .eq('booking_id', booking_id);

      return new Response(JSON.stringify({
        success: true,
        status: 'ONGOING',
        message: 'Session started successfully. Live location tracking has been halted.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid 4-digit session OTP' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500 });
  }
});
