-- Atomic booking reservations and payment finalization.
-- Apply after migrations 001-006; this file is additive and is not executed by the application.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS start_otp_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS completion_otp_encrypted TEXT;

ALTER TABLE public.bank_verifications
    ADD COLUMN IF NOT EXISTS account_number_last4 VARCHAR(4),
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_payment_order_unique
    ON public.bookings (payment_order_id)
    WHERE payment_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_payment_id_unique
    ON public.bookings (payment_id)
    WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS companion_memberships_payment_order_unique
    ON public.companion_memberships (payment_order_id)
    WHERE payment_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS companion_memberships_payment_id_unique
    ON public.companion_memberships (payment_id)
    WHERE payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.booking_slot_reservations (
    booking_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
    companion_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT booking_slot_reservations_valid_slot CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS booking_slot_reservations_expiry_idx
    ON public.booking_slot_reservations(expires_at);

ALTER TABLE public.booking_slot_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_slot_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_slot_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_booking_payment(
    p_booking_id UUID,
    p_booking_code VARCHAR,
    p_client_id UUID,
    p_companion_id UUID,
    p_service_id INTEGER,
    p_service_name VARCHAR,
    p_booking_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_duration_hours INTEGER,
    p_meeting_location TEXT,
    p_notes TEXT
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_client public.users%ROWTYPE;
    v_companion public.users%ROWTYPE;
    v_profile public.companion_profiles%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
    v_amount INTEGER;
    v_fee INTEGER;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF p_client_id = p_companion_id OR p_duration_hours < 1 OR p_duration_hours > 24
       OR p_end_time <= p_start_time
       OR EXTRACT(EPOCH FROM (p_end_time - p_start_time)) <> p_duration_hours * 3600 THEN
        RAISE EXCEPTION 'Invalid booking participants or time slot';
    END IF;
    IF p_booking_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Booking date must not be in the past';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_companion_id::TEXT || ':' || p_booking_date::TEXT, 0));
    DELETE FROM public.booking_slot_reservations
    WHERE companion_id = p_companion_id AND booking_date = p_booking_date AND expires_at <= v_now;

    SELECT * INTO v_client FROM public.users WHERE id = p_client_id FOR SHARE;
    SELECT * INTO v_companion FROM public.users WHERE id = p_companion_id FOR SHARE;
    SELECT * INTO v_profile FROM public.companion_profiles WHERE user_id = p_companion_id FOR SHARE;
    IF v_client.id IS NULL OR v_companion.id IS NULL OR v_profile.id IS NULL
       OR v_client.role NOT IN ('CLIENT', 'DUAL')
       OR (v_client.role = 'DUAL' AND v_client.active_role IS DISTINCT FROM 'CLIENT')
       OR v_companion.role NOT IN ('COMPANION', 'DUAL')
       OR v_profile.is_live IS DISTINCT FROM TRUE
       OR v_profile.is_paused IS DISTINCT FROM FALSE
       OR v_client.kyc_status IS DISTINCT FROM 'APPROVED' THEN
        RAISE EXCEPTION 'Client eligibility or Companion availability check failed';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.companion_memberships m
        WHERE m.user_id = p_companion_id
          AND m.payment_status = 'PAID'
          AND m.expiry_date > v_now
    ) OR NOT EXISTS (
        SELECT 1 FROM public.bank_verifications b
        WHERE b.user_id = p_companion_id
          AND b.verification_status = 'VERIFIED'
    ) THEN
        RAISE EXCEPTION 'Companion activation requirements are not satisfied';
    END IF;
    IF v_profile.availability IS NULL
       OR NOT COALESCE(v_profile.availability->'days' ? TO_CHAR(p_booking_date, 'FMDay'), FALSE)
       OR NULLIF(v_profile.availability->>'startTime', '') IS NULL
       OR NULLIF(v_profile.availability->>'endTime', '') IS NULL
       OR p_start_time < NULLIF(v_profile.availability->>'startTime', '')::TIME
       OR p_end_time > NULLIF(v_profile.availability->>'endTime', '')::TIME THEN
        RAISE EXCEPTION 'Requested time slot is outside Companion availability';
    END IF;
    IF NOT (p_service_id = ANY(v_profile.services)) THEN
        RAISE EXCEPTION 'Requested service is not offered by this Companion';
    END IF;

    IF p_duration_hours >= 8 AND COALESCE((v_profile.rates->>'fullDayPaise')::INTEGER, 0) > 0 THEN
        v_amount := (v_profile.rates->>'fullDayPaise')::INTEGER;
    ELSIF p_duration_hours >= 4 AND COALESCE((v_profile.rates->>'halfDayPaise')::INTEGER, 0) > 0 THEN
        v_amount := (v_profile.rates->>'halfDayPaise')::INTEGER;
    ELSE
        v_amount := COALESCE((v_profile.rates->>'hourlyPaise')::INTEGER, 49900) * p_duration_hours;
    END IF;
    IF v_amount <= 0 THEN
        RAISE EXCEPTION 'Companion rate is invalid';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.companion_id = p_companion_id
          AND b.booking_date = p_booking_date
          AND b.status IN ('CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS')
          AND b.start_time < p_end_time AND p_start_time < b.end_time
    ) OR EXISTS (
        SELECT 1 FROM public.booking_slot_reservations r
        WHERE r.companion_id = p_companion_id
          AND r.booking_date = p_booking_date
          AND r.expires_at > v_now
          AND r.start_time < p_end_time AND p_start_time < r.end_time
    ) THEN
        RAISE EXCEPTION 'Companion time slot is already reserved';
    END IF;

    v_fee := ROUND(v_amount * 0.15);
    INSERT INTO public.bookings (
        id, booking_code, client_id, companion_id, service_id, service_name,
        booking_date, start_time, end_time, duration_hours, meeting_location,
        notes, amount_paise, status, payment_status, admin_platform_fee_paise,
        companion_gross_share_paise, companion_net_share_paise, settlement_status,
        payment_expires_at, created_at, updated_at
    ) VALUES (
        p_booking_id, p_booking_code, p_client_id, p_companion_id, p_service_id, p_service_name,
        p_booking_date, p_start_time, p_end_time, p_duration_hours, p_meeting_location,
        p_notes, v_amount, 'PENDING', 'PENDING', v_fee,
        v_amount - v_fee, v_amount - v_fee, 'LOCKED',
        v_now + INTERVAL '15 minutes', v_now, v_now
    ) RETURNING * INTO v_booking;

    INSERT INTO public.booking_slot_reservations (
        booking_id, companion_id, booking_date, start_time, end_time, expires_at
    ) VALUES (
        p_booking_id, p_companion_id, p_booking_date, p_start_time, p_end_time, v_now + INTERVAL '15 minutes'
    );
    RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_razorpay_payment(
    p_order_id TEXT,
    p_payment_id TEXT,
    p_amount_paise INTEGER,
    p_start_otp_hash TEXT,
    p_completion_otp_hash TEXT,
    p_start_otp_encrypted TEXT,
    p_completion_otp_encrypted TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_membership public.companion_memberships%ROWTYPE;
    v_profile public.companion_profiles%ROWTYPE;
BEGIN
    IF NULLIF(p_order_id, '') IS NULL OR NULLIF(p_payment_id, '') IS NULL OR p_amount_paise <= 0 THEN
        RAISE EXCEPTION 'Invalid payment details';
    END IF;

    SELECT * INTO v_booking FROM public.bookings WHERE payment_order_id = p_order_id FOR UPDATE;
    IF FOUND THEN
        IF v_booking.payment_status = 'PAID' AND v_booking.payment_id = p_payment_id THEN
            RETURN JSONB_BUILD_OBJECT('type', 'BOOKING', 'record', TO_JSONB(v_booking), 'duplicate', TRUE);
        END IF;
        IF v_booking.payment_status <> 'PENDING' OR v_booking.amount_paise <> p_amount_paise
           OR v_booking.payment_expires_at <= NOW() THEN
            RAISE EXCEPTION 'Booking order is expired or payment amount does not match';
        END IF;
        UPDATE public.bookings
        SET status = 'CONFIRMED', payment_status = 'PAID', payment_id = p_payment_id,
            start_otp_hash = p_start_otp_hash, completion_otp_hash = p_completion_otp_hash,
            start_otp_encrypted = p_start_otp_encrypted,
            completion_otp_encrypted = p_completion_otp_encrypted,
            payment_expires_at = NULL, updated_at = NOW()
        WHERE id = v_booking.id
        RETURNING * INTO v_booking;
        DELETE FROM public.booking_slot_reservations WHERE booking_id = v_booking.id;
        RETURN JSONB_BUILD_OBJECT('type', 'BOOKING', 'record', TO_JSONB(v_booking), 'duplicate', FALSE);
    END IF;

    SELECT * INTO v_membership FROM public.companion_memberships WHERE payment_order_id = p_order_id FOR UPDATE;
    IF FOUND THEN
        IF v_membership.payment_status = 'PAID' AND v_membership.payment_id = p_payment_id THEN
            RETURN JSONB_BUILD_OBJECT('type', 'MEMBERSHIP', 'record', TO_JSONB(v_membership), 'duplicate', TRUE);
        END IF;
        IF v_membership.payment_status <> 'PENDING' OR v_membership.amount_paise <> p_amount_paise THEN
            RAISE EXCEPTION 'Membership order is invalid or payment amount does not match';
        END IF;
        UPDATE public.companion_memberships
        SET payment_status = 'PAID',
            payment_id = p_payment_id,
            paid_at = NOW(),
            start_date = NOW(),
            expiry_date = NOW() + (
                CASE plan WHEN 'STARTER' THEN 30 WHEN 'PROFESSIONAL' THEN 90 ELSE 365 END
            ) * INTERVAL '1 day'
        WHERE id = v_membership.id
        RETURNING * INTO v_membership;
        SELECT * INTO v_profile FROM public.companion_profiles WHERE user_id = v_membership.user_id FOR UPDATE;
        IF FOUND THEN
            UPDATE public.companion_profiles
            SET is_live = (
                NOT COALESCE(is_paused, FALSE)
                AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_membership.user_id AND u.kyc_status = 'APPROVED')
                AND EXISTS (
                    SELECT 1 FROM public.companion_memberships m
                    WHERE m.user_id = v_membership.user_id
                      AND m.payment_status = 'PAID'
                      AND m.expiry_date > NOW()
                )
                AND EXISTS (SELECT 1 FROM public.bank_verifications b WHERE b.user_id = v_membership.user_id AND b.verification_status = 'VERIFIED')
            )
            WHERE user_id = v_membership.user_id;
        END IF;
        RETURN JSONB_BUILD_OBJECT('type', 'MEMBERSHIP', 'record', TO_JSONB(v_membership), 'duplicate', FALSE);
    END IF;
    RAISE EXCEPTION 'No pending application order matches this payment';
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_booking_companion_arrived(
    p_booking_id UUID,
    p_companion_id UUID
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id AND companion_id = p_companion_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found or caller is not its Companion';
    END IF;
    IF v_booking.status <> 'CONFIRMED' OR v_booking.payment_status <> 'PAID' THEN
        RAISE EXCEPTION 'Only paid confirmed bookings can be marked arrived';
    END IF;
    UPDATE public.bookings
    SET status = 'COMPANION_ARRIVED', companion_arrived_at = NOW(), updated_at = NOW()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;
    RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_booking_otp(
    p_booking_id UUID,
    p_companion_id UUID,
    p_otp_type VARCHAR,
    p_otp_hash TEXT,
    p_delay_minutes INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_attempts INTEGER;
    v_expected_hash TEXT;
    v_penalty INTEGER;
    v_unlock TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_booking FROM public.bookings
    WHERE id = p_booking_id AND companion_id = p_companion_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found or caller is not its Companion';
    END IF;
    IF p_otp_type = 'START' THEN
        IF v_booking.status <> 'COMPANION_ARRIVED' OR v_booking.start_otp_verified THEN
            RAISE EXCEPTION 'Start OTP cannot be verified in the current booking state';
        END IF;
        v_attempts := v_booking.start_otp_attempts + 1;
        v_expected_hash := v_booking.start_otp_hash;
        UPDATE public.bookings SET start_otp_attempts = v_attempts WHERE id = p_booking_id;
    ELSIF p_otp_type = 'COMPLETION' THEN
        IF v_booking.status <> 'IN_PROGRESS' OR v_booking.completion_otp_verified THEN
            RAISE EXCEPTION 'Completion OTP cannot be verified in the current booking state';
        END IF;
        v_attempts := v_booking.completion_otp_attempts + 1;
        v_expected_hash := v_booking.completion_otp_hash;
        UPDATE public.bookings SET completion_otp_attempts = v_attempts WHERE id = p_booking_id;
    ELSE
        RAISE EXCEPTION 'Invalid booking OTP type';
    END IF;
    IF v_attempts > 5 THEN
        RETURN JSONB_BUILD_OBJECT('result', 'locked', 'attempts', v_attempts);
    END IF;
    IF v_expected_hash IS NULL OR v_expected_hash <> p_otp_hash THEN
        RETURN JSONB_BUILD_OBJECT('result', 'invalid', 'attempts', v_attempts);
    END IF;

    IF p_otp_type = 'START' THEN
        IF p_delay_minutes < 0 OR p_delay_minutes > 1440 THEN
            RAISE EXCEPTION 'Invalid delay minutes';
        END IF;
        v_penalty := LEAST(
            v_booking.companion_gross_share_paise,
            ROUND(v_booking.amount_paise::NUMERIC * p_delay_minutes / (v_booking.duration_hours * 60))::INTEGER
        );
        UPDATE public.bookings
        SET start_otp_verified = TRUE,
            start_otp_hash = NULL,
            start_otp_encrypted = NULL,
            status = 'IN_PROGRESS',
            started_at = NOW(),
            delay_minutes = p_delay_minutes,
            late_penalty_paise = v_penalty,
            companion_net_share_paise = companion_gross_share_paise - v_penalty,
            client_refund_penalty_paise = v_penalty,
            updated_at = NOW()
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;
    ELSE
        v_unlock := NOW() + INTERVAL '48 hours';
        UPDATE public.bookings
        SET completion_otp_verified = TRUE,
            completion_otp_hash = NULL,
            completion_otp_encrypted = NULL,
            status = 'COMPLETED',
            completed_at = NOW(),
            settlement_status = 'LOCKED',
            settlement_unlock_at = v_unlock,
            updated_at = NOW()
        WHERE id = p_booking_id
        RETURNING * INTO v_booking;
        INSERT INTO public.wallet_ledger (
            user_id, booking_id, transaction_type, gross_amount_paise, commission_paise,
            penalty_paise, net_amount_paise, balance_locked_until, balance_status,
            description, idempotency_key
        ) VALUES (
            v_booking.companion_id, v_booking.id, 'EARNING', v_booking.amount_paise,
            v_booking.admin_platform_fee_paise, v_booking.late_penalty_paise,
            v_booking.companion_net_share_paise, v_unlock, 'LOCKED',
            'Companion booking settlement after completion', 'booking-completion:' || v_booking.id::TEXT
        ) ON CONFLICT DO NOTHING;
        UPDATE public.companion_profiles
        SET total_bookings = total_bookings + 1
        WHERE user_id = v_booking.companion_id;
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
            v_booking.companion_id, 'BOOKING_COMPLETED_48H_LOCKED', 'booking', v_booking.id,
            JSONB_BUILD_OBJECT('settlement_unlock_at', v_unlock, 'net_amount_paise', v_booking.companion_net_share_paise)
        );
    END IF;
    RETURN JSONB_BUILD_OBJECT('result', 'verified', 'booking', TO_JSONB(v_booking));
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_booking_payment(UUID, VARCHAR, UUID, UUID, INTEGER, VARCHAR, DATE, TIME, TIME, INTEGER, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_booking_payment(UUID, VARCHAR, UUID, UUID, INTEGER, VARCHAR, DATE, TIME, TIME, INTEGER, TEXT, TEXT)
    TO service_role;
REVOKE ALL ON FUNCTION public.finalize_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT)
    TO service_role;
REVOKE ALL ON FUNCTION public.mark_booking_companion_arrived(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_booking_companion_arrived(UUID, UUID)
    TO service_role;
REVOKE ALL ON FUNCTION public.verify_booking_otp(UUID, UUID, VARCHAR, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_booking_otp(UUID, UUID, VARCHAR, TEXT, INTEGER)
    TO service_role;
