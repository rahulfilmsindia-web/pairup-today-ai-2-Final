-- ==============================================================================
-- Migration 011: Late-Start Dynamic End-Time, Per-Minute Companion Penalty,
-- Slot Expiry Auto-Cancel (Full Negative Penalty), and Client Refund Bank Details Queue
-- PairUpToday Production Architecture
-- ==============================================================================

-- 1. Extend bookings table for dynamic end-time and late penalty tracking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS late_penalty_paise INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none';

-- Expand status check constraint to include 'auto_cancelled_no_show'
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
      'auto_cancelled_no_show',
      'cancelled_by_client',
      'cancelled_by_companion',
      'REJECTED'
    )
  );
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Dedicated refund_requests table for Client Bank / UPI Payouts
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    refund_amount_paise INTEGER NOT NULL,
    refund_reason TEXT NOT NULL CHECK (refund_reason IN ('client_cancelled', 'companion_no_show', 'admin_override')),
    account_holder_name TEXT,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    upi_id TEXT,
    payout_status TEXT NOT NULL DEFAULT 'awaiting_details' CHECK (payout_status IN ('awaiting_details', 'pending_admin_payout', 'processed', 'rejected')),
    admin_transaction_ref TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_booking_id ON public.refund_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_client_id ON public.refund_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payout_status ON public.refund_requests(payout_status);

-- Enable RLS on refund_requests
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS refund_requests_client_policy ON public.refund_requests;
  CREATE POLICY refund_requests_client_policy ON public.refund_requests
    FOR ALL TO authenticated
    USING (auth.uid() = client_id OR auth.uid() IN (SELECT id FROM public.users WHERE role IN ('ADMIN', 'SUPER_ADMIN')));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. Atomic PostgreSQL RPC: Start Session with Late Penalty & Dynamic End-Time
CREATE OR REPLACE FUNCTION public.start_booking_session_with_late_penalty(
    p_booking_id UUID,
    p_actual_start TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARe
    v_booking public.bookings%ROWTYPE;
    v_duration_minutes INTEGER;
    v_scheduled_start TIMESTAMPTZ;
    v_late_minutes INTEGER := 0;
    v_per_minute_rate NUMERIC;
    v_late_penalty_paise INTEGER := 0;
    v_actual_end TIMESTAMPTZ;
    v_new_wallet_balance INTEGER;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Calculate original duration in minutes
    IF v_booking.scheduled_at IS NOT NULL AND v_booking.duration_hours IS NOT NULL THEN
        v_scheduled_start := v_booking.scheduled_at;
        v_duration_minutes := GREATEST(1, ROUND(v_booking.duration_hours * 60));
    ELSIF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL THEN
        v_scheduled_start := (v_booking.booking_date || ' ' || v_booking.start_time)::TIMESTAMPTZ;
        IF v_booking.end_time IS NOT NULL THEN
            v_duration_minutes := GREATEST(1, ROUND(EXTRACT(EPOCH FROM ((v_booking.booking_date || ' ' || v_booking.end_time)::TIMESTAMPTZ - v_scheduled_start)) / 60));
        ELSE
            v_duration_minutes := GREATEST(1, ROUND(COALESCE(v_booking.duration_hours, 1) * 60));
        END IF;
    ELSE
        v_scheduled_start := p_actual_start;
        v_duration_minutes := GREATEST(1, ROUND(COALESCE(v_booking.duration_hours, 1) * 60));
    END IF;

    -- Dynamic End-Time: client receives full duration from actual start
    v_actual_end := p_actual_start + (v_duration_minutes * INTERVAL '1 minute');

    -- Calculate late minutes and penalty
    IF p_actual_start > v_scheduled_start THEN
        v_late_minutes := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (p_actual_start - v_scheduled_start)) / 60));
    END IF;

    IF v_late_minutes > 0 AND v_duration_minutes > 0 AND COALESCE(v_booking.amount_paise, 0) > 0 THEN
        v_per_minute_rate := v_booking.amount_paise::NUMERIC / v_duration_minutes::NUMERIC;
        v_late_penalty_paise := LEAST(v_booking.amount_paise, ROUND(v_per_minute_rate * v_late_minutes));
    END IF;

    -- Deduct late penalty from companion wallet if late
    IF v_late_penalty_paise > 0 THEN
        INSERT INTO public.companion_wallets (
            companion_id,
            available_balance_paise,
            locked_balance_paise,
            total_settled_paise,
            total_penalties_paise,
            updated_at
        ) VALUES (
            v_booking.companion_id,
            -v_late_penalty_paise,
            0,
            0,
            v_late_penalty_paise,
            NOW()
        )
        ON CONFLICT (companion_id) DO UPDATE
        SET available_balance_paise = companion_wallets.available_balance_paise - v_late_penalty_paise,
            total_penalties_paise = companion_wallets.total_penalties_paise + v_late_penalty_paise,
            updated_at = NOW()
        RETURNING available_balance_paise INTO v_new_wallet_balance;

        -- Record in wallet_ledger
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
            gen_random_uuid(),
            v_booking.companion_id,
            p_booking_id,
            'PENALTY',
            v_late_penalty_paise,
            v_late_penalty_paise,
            -v_late_penalty_paise,
            'AVAILABLE',
            'Late Start Penalty: ' || v_late_minutes::TEXT || ' minutes late on Booking #' || COALESCE(v_booking.booking_code, 'N/A'),
            NOW()
        );
    END IF;

    -- Update booking row
    UPDATE public.bookings
    SET status = 'ONGOING',
        started_at = p_actual_start,
        actual_start_time = p_actual_start,
        actual_end_time = v_actual_end,
        late_minutes = v_late_minutes,
        late_penalty_paise = v_late_penalty_paise,
        companion_arrived_at = COALESCE(companion_arrived_at, p_actual_start),
        updated_at = NOW()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    RETURN jsonb_build_object(
        'success', TRUE,
        'booking_id', v_booking.id,
        'status', v_booking.status,
        'actual_start_time', v_booking.actual_start_time,
        'actual_end_time', v_booking.actual_end_time,
        'late_minutes', v_late_minutes,
        'late_penalty_paise', v_late_penalty_paise,
        'new_companion_wallet_balance', v_new_wallet_balance
    );
END;
$$;

-- 4. Updated Auto-Cancel RPC: Slot Expiry Auto-Cancel & Full Negative Penalty
CREATE OR REPLACE FUNCTION public.auto_cancel_unstarted_expired_slots()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cancelled_count INTEGER := 0;
    v_record RECORD;
    v_penalty_paise INTEGER;
BEGIN
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
        v_penalty_paise := COALESCE(v_record.amount_paise, 0);

        -- Update booking status to auto_cancelled_no_show
        UPDATE public.bookings
        SET status = 'auto_cancelled_no_show',
            cancelled_by = 'system_no_show',
            cancelled_at = NOW(),
            cancellation_reason = 'Slot expired: Companion did not verify OTP or start session within booked slot',
            payment_status = 'REFUNDED',
            refund_status = 'pending_bank_details',
            refund_amount_paise = v_penalty_paise,
            refund_percentage = 100,
            penalty_deducted_paise = v_penalty_paise,
            updated_at = NOW()
        WHERE id = v_record.id;

        -- Apply full negative penalty to companion wallet
        INSERT INTO public.companion_wallets (
            companion_id,
            available_balance_paise,
            locked_balance_paise,
            total_settled_paise,
            total_penalties_paise,
            updated_at
        ) VALUES (
            v_record.companion_id,
            -v_penalty_paise,
            0,
            0,
            v_penalty_paise,
            NOW()
        )
        ON CONFLICT (companion_id) DO UPDATE
        SET available_balance_paise = companion_wallets.available_balance_paise - v_penalty_paise,
            total_penalties_paise = companion_wallets.total_penalties_paise + v_penalty_paise,
            updated_at = NOW();

        -- Record negative penalty in wallet_ledger
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
            gen_random_uuid(),
            v_record.companion_id,
            v_record.id,
            'PENALTY',
            v_penalty_paise,
            v_penalty_paise,
            -v_penalty_paise,
            'AVAILABLE',
            'No-Show Penalty: Slot expired unstarted on Booking #' || COALESCE(v_record.booking_code, 'N/A'),
            NOW()
        );

        -- Create pending refund request for client (awaiting bank/UPI details)
        INSERT INTO public.refund_requests (
            id,
            booking_id,
            client_id,
            refund_amount_paise,
            refund_reason,
            payout_status,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_record.id,
            v_record.client_id,
            v_penalty_paise,
            'companion_no_show',
            'awaiting_details',
            NOW()
        )
        ON CONFLICT DO NOTHING;

        v_cancelled_count := v_cancelled_count + 1;
    END LOOP;

    RETURN v_cancelled_count;
END;
$$;
