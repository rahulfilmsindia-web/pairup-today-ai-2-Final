-- Additive schema required by the canonical Supabase business-data adapter.
-- Apply after migrations 001-004. No existing application tables are dropped.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.kyc_submissions
    ADD COLUMN IF NOT EXISTS profile_bio TEXT,
    ADD COLUMN IF NOT EXISTS profile_photos JSONB,
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS reviewed_by_admin_id UUID REFERENCES public.admin_users(id);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS kyc_decided_by_admin_id UUID REFERENCES public.admin_users(id);

ALTER TABLE public.companion_profiles
    ADD COLUMN IF NOT EXISTS membership_id UUID REFERENCES public.companion_memberships(id),
    ADD COLUMN IF NOT EXISTS bank_verification_id UUID REFERENCES public.bank_verifications(id);

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS admin_platform_fee_paise INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS companion_gross_share_paise INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS companion_net_share_paise INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS late_penalty_paise INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS client_refund_penalty_paise INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(20) NOT NULL DEFAULT 'LOCKED'
        CHECK (settlement_status IN ('LOCKED', 'AVAILABLE', 'PAID_OUT')),
    ADD COLUMN IF NOT EXISTS settlement_unlock_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS start_otp_attempts INTEGER NOT NULL DEFAULT 0 CHECK (start_otp_attempts >= 0),
    ADD COLUMN IF NOT EXISTS completion_otp_attempts INTEGER NOT NULL DEFAULT 0 CHECK (completion_otp_attempts >= 0),
    ADD COLUMN IF NOT EXISTS start_otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS completion_otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payout_id UUID,
    ADD CONSTRAINT bookings_distinct_participants CHECK (client_id <> companion_id),
    ADD CONSTRAINT bookings_positive_amount CHECK (amount_paise > 0),
    ADD CONSTRAINT bookings_valid_slot CHECK (end_time > start_time);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.bookings a
        JOIN public.bookings b
          ON a.id < b.id
         AND a.companion_id = b.companion_id
         AND a.booking_date = b.booking_date
         AND a.status IN ('CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS')
         AND b.status IN ('CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS')
         AND tsrange(a.booking_date + a.start_time, a.booking_date + a.end_time, '[)')
             && tsrange(b.booking_date + b.start_time, b.booking_date + b.end_time, '[)')
    ) THEN
        RAISE EXCEPTION 'Existing overlapping active companion bookings must be reviewed before applying migration 005';
    END IF;
END;
$$;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_no_companion_slot_overlap
    EXCLUDE USING gist (
        companion_id WITH =,
        booking_date WITH =,
        tsrange(booking_date + start_time, booking_date + end_time, '[)') WITH &&
    )
    WHERE (status IN ('CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS'));

ALTER TABLE public.wallet_ledger
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD CONSTRAINT wallet_ledger_nonnegative_amounts CHECK (
        COALESCE(gross_amount_paise, 0) >= 0
        AND COALESCE(commission_paise, 0) >= 0
        AND COALESCE(penalty_paise, 0) >= 0
    );

CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_idempotency_key_unique
    ON public.wallet_ledger (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_booking_earning_unique
    ON public.wallet_ledger (booking_id)
    WHERE booking_id IS NOT NULL AND transaction_type = 'EARNING';

ALTER TABLE public.payouts
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES public.admin_users(id),
    ADD CONSTRAINT payouts_nonnegative_amounts CHECK (
        total_amount_paise >= 0
        AND commission_paise >= 0
        AND penalty_paise >= 0
        AND net_amount_paise >= 0
    );

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_payout_id_fkey
    FOREIGN KEY (payout_id) REFERENCES public.payouts(id);

CREATE UNIQUE INDEX IF NOT EXISTS payouts_idempotency_key_unique
    ON public.payouts (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payouts_booking_unique
    ON public.payouts (booking_id)
    WHERE booking_id IS NOT NULL;

ALTER TABLE public.support_conversations
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS assigned_admin_user_id UUID REFERENCES public.admin_users(id);

ALTER TABLE public.support_messages
    ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES public.admin_users(id);

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES public.admin_users(id);

CREATE TABLE IF NOT EXISTS public.user_locations (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude NUMERIC(11, 8) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_locations_booking_id_idx
    ON public.user_locations (booking_id);

CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_locations, public.user_presence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_locations, public.user_presence TO service_role;

CREATE POLICY "Service role full access on user_locations"
    ON public.user_locations FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on user_presence"
    ON public.user_presence FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Custom backend sessions are not Supabase Auth sessions. Clients must not access these
-- application tables directly; only the trusted backend service-role client may do so.
REVOKE ALL ON TABLE
    public.users,
    public.kyc_submissions,
    public.companion_profiles,
    public.companion_memberships,
    public.bank_verifications,
    public.bookings,
    public.wallet_ledger,
    public.payouts,
    public.chat_conversations,
    public.chat_messages,
    public.support_conversations,
    public.support_messages,
    public.admin_users,
    public.admin_mfa_store,
    public.audit_logs,
    public.notifications,
    public.payment_webhook_events,
    public.auth_otp_challenges,
    public.admin_mfa_challenges,
    public.user_locations,
    public.user_presence
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.users,
    public.kyc_submissions,
    public.companion_profiles,
    public.companion_memberships,
    public.bank_verifications,
    public.bookings,
    public.wallet_ledger,
    public.payouts,
    public.chat_conversations,
    public.chat_messages,
    public.support_conversations,
    public.support_messages,
    public.admin_users,
    public.admin_mfa_store,
    public.audit_logs,
    public.notifications,
    public.payment_webhook_events,
    public.auth_otp_challenges,
    public.admin_mfa_challenges,
    public.user_locations,
    public.user_presence
TO service_role;

-- Reserve a booking's settlement for one payout in a single transaction.
CREATE OR REPLACE FUNCTION public.reserve_booking_payout(
    p_booking_id UUID,
    p_admin_user_id UUID,
    p_utr_reference TEXT
)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_payout public.payouts%ROWTYPE;
    v_updated_rows INTEGER;
BEGIN
    IF p_utr_reference IS NULL OR LENGTH(BTRIM(p_utr_reference)) < 8 THEN
        RAISE EXCEPTION 'A valid UTR reference is required';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
    IF v_booking.status <> 'COMPLETED' OR v_booking.payment_status <> 'PAID' THEN
        RAISE EXCEPTION 'Booking is not eligible for settlement';
    END IF;
    IF v_booking.settlement_status = 'PAID_OUT' THEN
        RAISE EXCEPTION 'Booking settlement has already been paid';
    END IF;
    IF v_booking.settlement_unlock_at IS NULL OR v_booking.settlement_unlock_at > NOW() THEN
        RAISE EXCEPTION 'Booking settlement remains locked';
    END IF;

    INSERT INTO public.payouts (
        user_id, booking_id, total_amount_paise, commission_paise,
        penalty_paise, net_amount_paise, payout_status, utr_reference,
        admin_user_id, processed_at, idempotency_key
    ) VALUES (
        v_booking.companion_id, v_booking.id, v_booking.amount_paise,
        v_booking.admin_platform_fee_paise, v_booking.late_penalty_paise,
        v_booking.companion_net_share_paise, 'PAID_OUT', BTRIM(p_utr_reference),
        p_admin_user_id, NOW(), 'booking-payout:' || v_booking.id::TEXT
    )
    RETURNING * INTO v_payout;

    UPDATE public.bookings
    SET settlement_status = 'PAID_OUT', payout_id = v_payout.id, updated_at = NOW()
    WHERE id = v_booking.id;

    UPDATE public.wallet_ledger
    SET balance_status = 'PAID_OUT'
    WHERE booking_id = v_booking.id
      AND user_id = v_booking.companion_id
      AND balance_status IN ('LOCKED', 'AVAILABLE');
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    IF v_updated_rows = 0 THEN
        RAISE EXCEPTION 'No eligible wallet ledger entry exists for this booking';
    END IF;

    INSERT INTO public.audit_logs (
        admin_user_id, action, entity_type, entity_id, details
    ) VALUES (
        p_admin_user_id, 'PAYOUT_COMPLETED', 'booking', v_booking.id,
        jsonb_build_object('payout_id', v_payout.id, 'utr_reference', BTRIM(p_utr_reference))
    );

    RETURN v_payout;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_booking_payout(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_booking_payout(UUID, UUID, TEXT) TO service_role;
