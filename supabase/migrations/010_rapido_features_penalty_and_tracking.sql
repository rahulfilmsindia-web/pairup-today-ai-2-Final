-- ==============================================================================
-- Migration 010: Rapido-Style Realtime Features, Wallet Penalties & Slot Auto-Cancel
-- PairUpToday Production Architecture
-- Strict Cost & Quota Optimized (Zero-DB-Write GPS Streaming via Broadcast)
-- ==============================================================================

-- 1. Extend users and companion_profiles for Online state and FCM tokens
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fcm_token TEXT,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

ALTER TABLE public.companion_profiles
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fcm_token TEXT,
  ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_companion_profiles_is_online ON public.companion_profiles(is_online);

-- 2. Extend bookings table for multi-service selection, late-start & cancellation
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS selected_services JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_note TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS penalty_deducted_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_percentage INTEGER DEFAULT 0;

-- Relax status check constraint to support all lifecycle states
DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'PENDING',
      'CONFIRMED',
      'CONFIRMED_PAID',
      'ONGOING',
      'COMPANION_ARRIVED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'auto_cancelled',
      'cancelled_by_client',
      'cancelled_by_companion',
      'REJECTED'
    )
  );
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. Dedicated companion_wallets table supporting negative balance for penalties
CREATE TABLE IF NOT EXISTS public.companion_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    companion_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    available_balance_paise INTEGER NOT NULL DEFAULT 0,
    locked_balance_paise INTEGER NOT NULL DEFAULT 0,
    total_settled_paise INTEGER NOT NULL DEFAULT 0,
    total_penalties_paise INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companion_wallets_companion_id ON public.companion_wallets(companion_id);

-- Enable RLS on companion_wallets
ALTER TABLE public.companion_wallets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS companion_wallets_read_policy ON public.companion_wallets;
  CREATE POLICY companion_wallets_read_policy ON public.companion_wallets
    FOR SELECT TO authenticated
    USING (auth.uid() = companion_id);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Atomic PostgreSQL RPC: Companion Dashboard Cancellation with Full Booking Penalty
CREATE OR REPLACE FUNCTION public.cancel_booking_by_companion_with_penalty(
    p_booking_id UUID,
    p_companion_id UUID,
    p_reason TEXT,
    p_custom_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_penalty_paise INTEGER;
    v_new_available_paise INTEGER;
    v_wallet_id UUID;
BEGIN
    -- Lock booking row for update
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Verify companion ownership
    IF v_booking.companion_id <> p_companion_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the assigned companion can cancel this booking.' USING ERRCODE = '42501';
    END IF;

    -- Verify booking is not already started or completed
    IF v_booking.status IN ('COMPLETED', 'ONGOING', 'IN_PROGRESS') OR v_booking.actual_start_time IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot cancel an ongoing or completed session.' USING ERRCODE = 'P0001';
    END IF;

    IF v_booking.status IN ('CANCELLED', 'auto_cancelled', 'cancelled_by_client', 'cancelled_by_companion') THEN
        RAISE EXCEPTION 'Booking is already cancelled.' USING ERRCODE = 'P0001';
    END IF;

    -- Calculate penalty (100% of the gross booking amount)
    v_penalty_paise := COALESCE(v_booking.amount_paise, 0);

    -- 1. Atomically update booking status
    UPDATE public.bookings
    SET status = 'cancelled_by_companion',
        cancelled_by = 'COMPANION',
        cancelled_at = NOW(),
        cancellation_reason = p_reason,
        cancellation_note = p_custom_note,
        penalty_deducted_paise = v_penalty_paise,
        payment_status = 'REFUNDED',
        updated_at = NOW()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

    -- 2. Insert negative penalty entry into wallet_ledger
    INSERT INTO public.wallet_ledger (
        id,
        user_id,
        booking_id,
        transaction_type,
        gross_amount_paise,
        penalty_paise,
        net_amount_paise,
        balance_status,
        description,
        created_at
    ) VALUES (
        uuid_generate_v4(),
        p_companion_id,
        p_booking_id,
        'PENALTY',
        v_penalty_paise,
        v_penalty_paise,
        -v_penalty_paise, -- Negative balance deduction
        'AVAILABLE',
        'Cancellation Penalty for Booking #' || COALESCE(v_booking.booking_code, 'N/A') || ' (' || p_reason || ')',
        NOW()
    );

    -- 3. Upsert into companion_wallets, reducing available balance (allowing negative values)
    INSERT INTO public.companion_wallets (
        companion_id,
        available_balance_paise,
        locked_balance_paise,
        total_settled_paise,
        total_penalties_paise,
        updated_at
    ) VALUES (
        p_companion_id,
        -v_penalty_paise,
        0,
        0,
        v_penalty_paise,
        NOW()
    )
    ON CONFLICT (companion_id) DO UPDATE
    SET available_balance_paise = companion_wallets.available_balance_paise - v_penalty_paise,
        total_penalties_paise = companion_wallets.total_penalties_paise + v_penalty_paise,
        updated_at = NOW()
    RETURNING available_balance_paise, id INTO v_new_available_paise, v_wallet_id;

    -- 4. Record 100% refund for client
    INSERT INTO public.payment_refunds (
        id,
        booking_id,
        user_id,
        amount_paise,
        reason,
        status,
        created_at
    ) VALUES (
        uuid_generate_v4(),
        p_booking_id,
        v_booking.client_id,
        v_penalty_paise,
        'Full refund due to Companion Cancellation: ' || p_reason,
        'PENDING',
        NOW()
    ) ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object(
        'success', TRUE,
        'booking_id', v_booking.id,
        'status', v_booking.status,
        'penalty_paise', v_penalty_paise,
        'new_available_balance_paise', v_new_available_paise,
        'message', 'Booking cancelled. Penalty of ₹' || (v_penalty_paise / 100)::text || ' deducted from companion wallet.'
    );
END;
$$;

-- 5. Atomic PostgreSQL RPC: Client Dashboard Cancellation (with Time-Based Refund Slabs)
CREATE OR REPLACE FUNCTION public.cancel_booking_by_client_with_refund(
    p_booking_id UUID,
    p_client_id UUID,
    p_reason TEXT,
    p_custom_note TEXT DEFAULT NULL,
    p_refund_percentage INTEGER DEFAULT 100,
    p_refund_paise INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.client_id <> p_client_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the booking client can perform this action.' USING ERRCODE = '42501';
    END IF;

    IF v_booking.status IN ('COMPLETED', 'ONGOING', 'IN_PROGRESS') OR v_booking.actual_start_time IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot cancel an active ongoing or completed session.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.bookings
    SET status = 'cancelled_by_client',
        cancelled_by = 'CLIENT',
        cancelled_at = NOW(),
        cancellation_reason = p_reason,
        cancellation_note = p_custom_note,
        refund_amount_paise = p_refund_paise,
        refund_percentage = p_refund_percentage,
        payment_status = CASE WHEN p_refund_paise > 0 THEN 'REFUNDED' ELSE payment_status END,
        updated_at = NOW()
    WHERE id = v_booking.id
    RETURNING * INTO v_booking;

    IF p_refund_paise > 0 THEN
        INSERT INTO public.payment_refunds (
            id,
            booking_id,
            user_id,
            amount_paise,
            reason,
            status,
            created_at
        ) VALUES (
            uuid_generate_v4(),
            p_booking_id,
            p_client_id,
            p_refund_paise,
            p_reason,
            'PENDING',
            NOW()
        ) ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'booking_id', v_booking.id,
        'status', v_booking.status,
        'refund_paise', p_refund_paise,
        'refund_percentage', p_refund_percentage
    );
END;
$$;

-- 6. Slot-Based Auto-Cancel & Late-Start Verification Function
CREATE OR REPLACE FUNCTION public.auto_cancel_unstarted_expired_slots()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cancelled_count INTEGER := 0;
    v_record RECORD;
BEGIN
    -- Target bookings where slot has completely ended without being started
    FOR v_record IN
        SELECT id, booking_code, client_id, companion_id, amount_paise
        FROM public.bookings
        WHERE status IN ('CONFIRMED', 'CONFIRMED_PAID')
          AND actual_start_time IS NULL
          AND started_at IS NULL
          AND (
            (booking_date + end_time)::timestamptz < NOW()
            OR (scheduled_at IS NOT NULL AND scheduled_at + (duration_hours || ' hours')::interval < NOW())
          )
    LOOP
        UPDATE public.bookings
        SET status = 'auto_cancelled',
            cancelled_by = 'SYSTEM_TIMEOUT',
            cancelled_at = NOW(),
            cancellation_reason = 'Session slot expired without OTP verification start',
            payment_status = 'REFUNDED',
            refund_amount_paise = v_record.amount_paise,
            refund_percentage = 100,
            updated_at = NOW()
        WHERE id = v_record.id;

        -- Record 100% refund for unstarted expired session
        INSERT INTO public.payment_refunds (
            id,
            booking_id,
            user_id,
            amount_paise,
            reason,
            status,
            created_at
        ) VALUES (
            uuid_generate_v4(),
            v_record.id,
            v_record.client_id,
            v_record.amount_paise,
            'Auto-refund for expired unstarted slot',
            'PENDING',
            NOW()
        ) ON CONFLICT DO NOTHING;

        v_cancelled_count := v_cancelled_count + 1;
    END LOOP;

    RETURN v_cancelled_count;
END;
$$;

-- Schedule 1-minute pg_cron job if pg_cron is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('auto-cancel-expired-booking-slots');
    PERFORM cron.schedule(
      'auto-cancel-expired-booking-slots',
      '* * * * *',
      'SELECT public.auto_cancel_unstarted_expired_slots();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Safely continue if pg_cron not active in sandbox/local
END $$;
