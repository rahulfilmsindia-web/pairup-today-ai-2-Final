import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function generate4DigitOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature if secret configured
    if (RAZORPAY_WEBHOOK_SECRET && signature) {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(RAZORPAY_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const verified = await crypto.subtle.verify(
        'HMAC',
        key,
        new Uint8Array(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))),
        new TextEncoder().encode(rawBody)
      );

      if (!verified) {
        return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const payment = payload.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const bookingId = payment?.notes?.bookingId;

    if (event === 'payment.captured' && (orderId || bookingId)) {
      // Look up booking
      let query = supabase.from('bookings').select('id, client_id, companion_id, status');
      if (bookingId) query = query.eq('id', bookingId);
      else if (orderId) query = query.eq('payment_order_id', orderId);

      const { data: booking, error: bErr } = await query.single();
      if (!bErr && booking) {
        const sessionOtp = generate4DigitOtp();
        
        await supabase
          .from('bookings')
          .update({
            status: 'CONFIRMED_PAID',
            payment_status: 'PAID',
            payment_id: payment.id,
            session_otp: sessionOtp,
            companion_eta_text: 'Calculating...',
            companion_current_area: 'Preparing to leave...',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        return new Response(JSON.stringify({ success: true, bookingId: booking.id, status: 'CONFIRMED_PAID' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
