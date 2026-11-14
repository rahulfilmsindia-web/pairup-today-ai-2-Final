-- Durable runtime controls, payment reconciliation, settlement jobs, and push tokens.
-- Apply after migrations 001-007. This migration is additive.

ALTER TABLE public.payment_webhook_events
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS refunded_amount_paise INTEGER NOT NULL DEFAULT 0
        CHECK (refunded_amount_paise >= 0);

ALTER TABLE public.companion_memberships
    DROP CONSTRAINT IF EXISTS companion_memberships_payment_status_check;
ALTER TABLE public.companion_memberships
    ADD CONSTRAINT companion_memberships_payment_status_check
    CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'));

CREATE TABLE IF NOT EXISTS public.payment_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES public.bookings(id),
    membership_id UUID REFERENCES public.companion_memberships(id),
    payment_id TEXT NOT NULL,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    idempotency_key TEXT NOT NULL UNIQUE,
    provider_refund_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'REQUESTED'
        CHECK (status IN ('REQUESTED', 'PROCESSING', 'PROCESSED', 'FAILED', 'UNKNOWN')),
    reason TEXT NOT NULL,
    requested_by_admin_id UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payment_refunds_single_resource CHECK (
        (booking_id IS NOT NULL AND membership_id IS NULL)
        OR (booking_id IS NULL AND membership_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS payment_refunds_payment_id_idx ON public.payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS payment_refunds_status_idx ON public.payment_refunds(status);

CREATE TABLE IF NOT EXISTS public.session_revocations (
    token_id TEXT PRIMARY KEY,
    principal_id UUID NOT NULL,
    principal_type TEXT NOT NULL CHECK (principal_type IN ('USER', 'ADMIN')),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS session_revocations_expiry_idx ON public.session_revocations(expires_at);

CREATE TABLE IF NOT EXISTS public.api_rate_limit_buckets (
    bucket_key CHAR(64) PRIMARY KEY CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_expiry_idx ON public.api_rate_limit_buckets(expires_at);

CREATE TABLE IF NOT EXISTS public.admin_sensitive_mfa_challenges (
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('REVEAL_BANK', 'PROCESS_PAYOUT', 'ISSUE_REFUND')),
    otp_hash CHAR(64) NOT NULL CHECK (otp_hash ~ '^[0-9a-f]{64}$'),
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 4),
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CONSUMED', 'LOCKED', 'EXPIRED')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_user_id, action)
);

CREATE TABLE IF NOT EXISTS public.firebase_device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('WEB', 'ANDROID', 'IOS')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_success_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS firebase_device_tokens_user_idx ON public.firebase_device_tokens(user_id);

CREATE TABLE IF NOT EXISTS public.booking_location_sharing (
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (booking_id, user_id)
);
CREATE INDEX IF NOT EXISTS booking_location_sharing_user_idx
    ON public.booking_location_sharing(user_id, sharing_enabled);

CREATE TABLE IF NOT EXISTS public.scheduled_job_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 1,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(job_name, idempotency_key)
);
CREATE INDEX IF NOT EXISTS scheduled_job_runs_created_idx ON public.scheduled_job_runs(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_key_unique
    ON public.notifications ((data->>'sourceKey'))
    WHERE data ? 'sourceKey';
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS push_delivery_status TEXT NOT NULL DEFAULT 'SENT',
    ADD COLUMN IF NOT EXISTS push_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS push_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS push_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS push_last_error TEXT,
    ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_push_delivery_status_check;
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_push_delivery_status_check
    CHECK (push_delivery_status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED'));
ALTER TABLE public.notifications
    ALTER COLUMN push_delivery_status SET DEFAULT 'PENDING';
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_push_attempts_nonnegative;
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_push_attempts_nonnegative CHECK (push_attempts >= 0);
CREATE INDEX IF NOT EXISTS notifications_pending_push_idx
    ON public.notifications(push_retry_at, created_at)
    WHERE push_delivery_status IN ('PENDING', 'PROCESSING');

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sensitive_mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firebase_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_location_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_job_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.payment_refunds,
    public.session_revocations,
    public.api_rate_limit_buckets,
    public.admin_sensitive_mfa_challenges,
    public.firebase_device_tokens,
    public.booking_location_sharing,
    public.scheduled_job_runs
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.payment_refunds,
    public.session_revocations,
    public.api_rate_limit_buckets,
    public.admin_sensitive_mfa_challenges,
    public.firebase_device_tokens,
    public.booking_location_sharing,
    public.scheduled_job_runs
TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
    p_bucket_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_bucket public.api_rate_limit_buckets%ROWTYPE;
    v_allowed BOOLEAN;
BEGIN
    IF p_bucket_key !~ '^[0-9a-f]{64}$' OR p_limit < 1 OR p_window_seconds < 1 THEN
        RAISE EXCEPTION 'Invalid rate limit parameters';
    END IF;
    INSERT INTO public.api_rate_limit_buckets(bucket_key, window_started_at, request_count, expires_at)
    VALUES (p_bucket_key, v_now, 1, v_now + make_interval(secs => p_window_seconds))
    ON CONFLICT (bucket_key) DO UPDATE
    SET window_started_at = CASE
            WHEN public.api_rate_limit_buckets.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            THEN v_now ELSE public.api_rate_limit_buckets.window_started_at END,
        request_count = CASE
            WHEN public.api_rate_limit_buckets.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            THEN 1 ELSE LEAST(public.api_rate_limit_buckets.request_count + 1, p_limit + 1) END,
        expires_at = CASE
            WHEN public.api_rate_limit_buckets.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            THEN v_now + make_interval(secs => p_window_seconds)
            ELSE public.api_rate_limit_buckets.expires_at END
    RETURNING * INTO v_bucket;
    v_allowed := v_bucket.request_count <= p_limit;
    RETURN JSONB_BUILD_OBJECT(
        'allowed', v_allowed,
        'remaining', GREATEST(0, p_limit - v_bucket.request_count),
        'retryAfterSeconds', CASE WHEN v_allowed THEN 0 ELSE GREATEST(
            1, CEIL(EXTRACT(EPOCH FROM (v_bucket.window_started_at + make_interval(secs => p_window_seconds) - v_now)))::INTEGER
        ) END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_session_revoked(p_token_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.session_revocations
        WHERE token_id = p_token_id AND expires_at > NOW()
    );
$$;

CREATE OR REPLACE FUNCTION public.revoke_session(
    p_token_id TEXT,
    p_principal_id UUID,
    p_principal_type TEXT,
    p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_token_id IS NULL OR p_token_id = '' OR p_principal_type NOT IN ('USER', 'ADMIN')
       OR p_expires_at <= NOW() THEN
        RAISE EXCEPTION 'Invalid session revocation request';
    END IF;
    INSERT INTO public.session_revocations(token_id, principal_id, principal_type, expires_at)
    VALUES (p_token_id, p_principal_id, p_principal_type, p_expires_at)
    ON CONFLICT (token_id) DO UPDATE SET
        principal_id = EXCLUDED.principal_id,
        principal_type = EXCLUDED.principal_type,
        expires_at = EXCLUDED.expires_at,
        revoked_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_payment_webhook_event(
    p_event_id TEXT,
    p_event_type TEXT,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event public.payment_webhook_events%ROWTYPE;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_inserted INTEGER;
BEGIN
    IF p_event_id IS NULL OR LENGTH(p_event_id) < 1 OR LENGTH(p_event_id) > 255
       OR p_event_type IS NULL OR p_payload IS NULL THEN
        RAISE EXCEPTION 'Invalid payment webhook event';
    END IF;
    INSERT INTO public.payment_webhook_events(event_id, event_type, payload, processed, attempts, claimed_at)
    VALUES (p_event_id, p_event_type, p_payload, FALSE, 1, v_now)
    ON CONFLICT (event_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    SELECT * INTO v_event FROM public.payment_webhook_events WHERE event_id = p_event_id FOR UPDATE;
    IF v_event.processed THEN
        RETURN JSONB_BUILD_OBJECT('claimed', FALSE, 'processed', TRUE);
    END IF;
    IF v_inserted = 0 AND v_event.claimed_at IS NOT NULL
       AND v_event.claimed_at > v_now - INTERVAL '5 minutes' THEN
        RETURN JSONB_BUILD_OBJECT('claimed', FALSE, 'processed', FALSE, 'busy', TRUE);
    END IF;
    UPDATE public.payment_webhook_events
    SET event_type = p_event_type, payload = p_payload,
        claimed_at = v_now, attempts = attempts + CASE WHEN v_inserted = 1 THEN 0 ELSE 1 END,
        last_error = NULL, updated_at = v_now
    WHERE event_id = p_event_id
    RETURNING * INTO v_event;
    RETURN JSONB_BUILD_OBJECT('claimed', TRUE, 'processed', FALSE, 'attempts', v_event.attempts);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_payment_webhook_event(
    p_event_id TEXT,
    p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.payment_webhook_events
    SET processed = (p_error IS NULL),
        processed_at = CASE WHEN p_error IS NULL THEN NOW() ELSE NULL END,
        last_error = LEFT(p_error, 2000),
        claimed_at = CASE WHEN p_error IS NULL THEN claimed_at ELSE NULL END,
        updated_at = NOW()
    WHERE event_id = p_event_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment webhook event claim was not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_payment_refund(
    p_booking_id UUID,
    p_membership_id UUID,
    p_payment_id TEXT,
    p_amount_paise INTEGER,
    p_idempotency_key TEXT,
    p_reason TEXT,
    p_admin_user_id UUID
)
RETURNS public.payment_refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin public.admin_users%ROWTYPE;
    v_refund public.payment_refunds%ROWTYPE;
    v_payment_id TEXT;
    v_total_paise INTEGER;
    v_reserved_paise INTEGER;
BEGIN
    IF (p_booking_id IS NULL) = (p_membership_id IS NULL)
       OR NULLIF(p_payment_id, '') IS NULL OR p_amount_paise <= 0
       OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL
       OR NULLIF(BTRIM(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'Invalid refund request';
    END IF;
    SELECT * INTO v_admin FROM public.admin_users
    WHERE id = p_admin_user_id AND is_active FOR SHARE;
    IF NOT FOUND OR v_admin.role NOT IN ('SUPER_ADMIN', 'FINANCE_ADMIN') THEN
        RAISE EXCEPTION 'Administrator is not authorized to issue refunds';
    END IF;
    SELECT * INTO v_refund FROM public.payment_refunds WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_refund.payment_id <> p_payment_id OR v_refund.amount_paise <> p_amount_paise
           OR v_refund.booking_id IS DISTINCT FROM p_booking_id
           OR v_refund.membership_id IS DISTINCT FROM p_membership_id THEN
            RAISE EXCEPTION 'Refund idempotency key was reused with different parameters';
        END IF;
        RETURN v_refund;
    END IF;

    IF p_booking_id IS NOT NULL THEN
        SELECT payment_id, amount_paise INTO v_payment_id, v_total_paise
        FROM public.bookings WHERE id = p_booking_id AND payment_status = 'PAID' FOR UPDATE;
    ELSE
        SELECT payment_id, amount_paise INTO v_payment_id, v_total_paise
        FROM public.companion_memberships WHERE id = p_membership_id AND payment_status = 'PAID' FOR UPDATE;
    END IF;
    IF v_payment_id IS NULL OR v_payment_id <> p_payment_id THEN
        RAISE EXCEPTION 'A captured payment matching the requested resource was not found';
    END IF;
    IF p_membership_id IS NOT NULL AND p_amount_paise <> v_total_paise THEN
        RAISE EXCEPTION 'Membership refunds must refund the complete membership payment';
    END IF;
    SELECT COALESCE(SUM(amount_paise), 0) INTO v_reserved_paise
    FROM public.payment_refunds
    WHERE payment_id = p_payment_id AND status <> 'FAILED';
    IF v_reserved_paise + p_amount_paise > v_total_paise THEN
        RAISE EXCEPTION 'Refund amount exceeds the unrefunded captured payment';
    END IF;

    INSERT INTO public.payment_refunds(
        booking_id, membership_id, payment_id, amount_paise, idempotency_key,
        status, reason, requested_by_admin_id
    ) VALUES (
        p_booking_id, p_membership_id, p_payment_id, p_amount_paise,
        p_idempotency_key, 'REQUESTED', LEFT(BTRIM(p_reason), 500), p_admin_user_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    SELECT * INTO v_refund FROM public.payment_refunds WHERE idempotency_key = p_idempotency_key FOR UPDATE;
    IF v_refund.payment_id <> p_payment_id OR v_refund.amount_paise <> p_amount_paise THEN
        RAISE EXCEPTION 'Refund idempotency key was reused with different parameters';
    END IF;
    RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_payment_refund(
    p_idempotency_key TEXT,
    p_status TEXT,
    p_provider_refund_id TEXT DEFAULT NULL
)
RETURNS public.payment_refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_refund public.payment_refunds%ROWTYPE;
    v_refunded_total INTEGER;
    v_booking_amount INTEGER;
    v_membership_amount INTEGER;
BEGIN
    IF p_status NOT IN ('PROCESSING', 'PROCESSED', 'FAILED', 'UNKNOWN') THEN
        RAISE EXCEPTION 'Invalid refund status';
    END IF;
    UPDATE public.payment_refunds
    SET status = p_status,
        provider_refund_id = COALESCE(p_provider_refund_id, provider_refund_id),
        updated_at = NOW()
    WHERE idempotency_key = p_idempotency_key
    RETURNING * INTO v_refund;
    IF NOT FOUND THEN RAISE EXCEPTION 'Refund reservation not found'; END IF;
    IF v_refund.booking_id IS NOT NULL AND p_status = 'PROCESSED' THEN
        SELECT amount_paise INTO v_booking_amount FROM public.bookings
        WHERE id = v_refund.booking_id FOR UPDATE;
        SELECT COALESCE(SUM(amount_paise), 0) INTO v_refunded_total
        FROM public.payment_refunds
        WHERE booking_id = v_refund.booking_id AND status = 'PROCESSED';
        UPDATE public.bookings
        SET refunded_amount_paise = v_refunded_total,
            payment_status = CASE WHEN v_refunded_total >= v_booking_amount THEN 'REFUNDED' ELSE payment_status END,
            updated_at = NOW()
        WHERE id = v_refund.booking_id;
    ELSIF v_refund.membership_id IS NOT NULL AND p_status = 'PROCESSED' THEN
        SELECT amount_paise INTO v_membership_amount
        FROM public.companion_memberships
        WHERE id = v_refund.membership_id FOR UPDATE;
        SELECT COALESCE(SUM(amount_paise), 0) INTO v_refunded_total
        FROM public.payment_refunds
        WHERE membership_id = v_refund.membership_id AND status = 'PROCESSED';
        IF v_refunded_total >= v_membership_amount THEN
            UPDATE public.companion_memberships
            SET payment_status = 'REFUNDED'
            WHERE id = v_refund.membership_id;
            UPDATE public.companion_profiles
            SET is_live = FALSE, updated_at = NOW()
            WHERE user_id = (SELECT user_id FROM public.companion_memberships WHERE id = v_refund.membership_id);
        END IF;
    END IF;
    RETURN v_refund;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_razorpay_order_failed(p_order_id TEXT, p_payment_id TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rows INTEGER := 0;
BEGIN
    UPDATE public.bookings
    SET payment_status = 'FAILED', payment_id = COALESCE(payment_id, p_payment_id),
        status = CASE WHEN status = 'PENDING' THEN 'CANCELLED' ELSE status END,
        payment_expires_at = NULL, updated_at = NOW()
    WHERE payment_order_id = p_order_id AND payment_status = 'PENDING';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        UPDATE public.companion_memberships
        SET payment_status = 'FAILED', payment_id = COALESCE(payment_id, p_payment_id)
        WHERE payment_order_id = p_order_id AND payment_status = 'PENDING';
        GET DIAGNOSTICS v_rows = ROW_COUNT;
    END IF;
    DELETE FROM public.booking_slot_reservations
    WHERE booking_id IN (SELECT id FROM public.bookings WHERE payment_order_id = p_order_id AND payment_status = 'FAILED');
    RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_admin_sensitive_mfa(
    p_admin_user_id UUID,
    p_action TEXT,
    p_otp_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin public.admin_users%ROWTYPE;
    v_challenge public.admin_sensitive_mfa_challenges%ROWTYPE;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF p_action NOT IN ('REVEAL_BANK', 'PROCESS_PAYOUT', 'ISSUE_REFUND')
       OR p_otp_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid sensitive-action MFA request'; END IF;
    SELECT * INTO v_admin FROM public.admin_users WHERE id = p_admin_user_id AND is_active FOR SHARE;
    IF NOT FOUND OR v_admin.role NOT IN ('SUPER_ADMIN', 'FINANCE_ADMIN') THEN
        RAISE EXCEPTION 'Administrator cannot authorize financial actions';
    END IF;
    SELECT * INTO v_challenge FROM public.admin_sensitive_mfa_challenges
    WHERE admin_user_id = p_admin_user_id AND action = p_action FOR UPDATE;
    IF FOUND AND v_now < v_challenge.last_sent_at + INTERVAL '60 seconds' THEN
        RETURN JSONB_BUILD_OBJECT('allowed', FALSE, 'reason', 'cooldown',
            'waitSeconds', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_challenge.last_sent_at + INTERVAL '60 seconds' - v_now)))::INTEGER));
    END IF;
    INSERT INTO public.admin_sensitive_mfa_challenges(
        admin_user_id, action, otp_hash, expires_at, attempts, last_sent_at, status, updated_at
    ) VALUES (
        p_admin_user_id, p_action, p_otp_hash, v_now + INTERVAL '5 minutes', 0, v_now, 'PENDING', v_now
    )
    ON CONFLICT (admin_user_id, action) DO UPDATE SET
        otp_hash = EXCLUDED.otp_hash, expires_at = EXCLUDED.expires_at,
        attempts = 0, last_sent_at = v_now, status = 'PENDING', updated_at = v_now;
    RETURN JSONB_BUILD_OBJECT('allowed', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_admin_sensitive_mfa_delivery(
    p_admin_user_id UUID,
    p_action TEXT,
    p_sent BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.admin_sensitive_mfa_challenges
    SET status = CASE WHEN p_sent THEN 'SENT' ELSE 'FAILED' END, updated_at = NOW()
    WHERE admin_user_id = p_admin_user_id AND action = p_action AND status = 'PENDING';
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_sensitive_mfa(
    p_admin_user_id UUID,
    p_action TEXT,
    p_otp_hash TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_challenge public.admin_sensitive_mfa_challenges%ROWTYPE;
    v_admin public.admin_users%ROWTYPE;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    SELECT * INTO v_admin FROM public.admin_users
    WHERE id = p_admin_user_id AND is_active
      AND role IN ('SUPER_ADMIN', 'FINANCE_ADMIN') FOR SHARE;
    IF NOT FOUND THEN RETURN 'not_found'; END IF;
    SELECT * INTO v_challenge FROM public.admin_sensitive_mfa_challenges
    WHERE admin_user_id = p_admin_user_id AND action = p_action FOR UPDATE;
    IF NOT FOUND OR v_challenge.status <> 'SENT' THEN RETURN 'not_found'; END IF;
    IF v_challenge.expires_at <= v_now THEN
        UPDATE public.admin_sensitive_mfa_challenges SET status = 'EXPIRED', updated_at = v_now
        WHERE admin_user_id = p_admin_user_id AND action = p_action;
        RETURN 'expired';
    END IF;
    IF v_challenge.attempts >= 4 THEN RETURN 'locked'; END IF;
    IF v_challenge.otp_hash <> p_otp_hash THEN
        UPDATE public.admin_sensitive_mfa_challenges
        SET attempts = attempts + 1,
            status = CASE WHEN attempts + 1 >= 4 THEN 'LOCKED' ELSE status END,
            updated_at = v_now
        WHERE admin_user_id = p_admin_user_id AND action = p_action;
        RETURN CASE WHEN v_challenge.attempts + 1 >= 4 THEN 'locked' ELSE 'invalid' END;
    END IF;
    UPDATE public.admin_sensitive_mfa_challenges SET status = 'CONSUMED', updated_at = v_now
    WHERE admin_user_id = p_admin_user_id AND action = p_action;
    RETURN 'verified';
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_admin_sensitive_mfa(
    p_admin_user_id UUID,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_challenge public.admin_sensitive_mfa_challenges%ROWTYPE;
    v_admin public.admin_users%ROWTYPE;
BEGIN
    SELECT * INTO v_admin FROM public.admin_users
    WHERE id = p_admin_user_id AND is_active
      AND role IN ('SUPER_ADMIN', 'FINANCE_ADMIN') FOR SHARE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    SELECT * INTO v_challenge
    FROM public.admin_sensitive_mfa_challenges
    WHERE admin_user_id = p_admin_user_id AND action = p_action
    FOR UPDATE;
    IF NOT FOUND OR v_challenge.status <> 'CONSUMED'
       OR v_challenge.updated_at < NOW() - INTERVAL '5 minutes' THEN
        RETURN FALSE;
    END IF;
    UPDATE public.admin_sensitive_mfa_challenges
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE admin_user_id = p_admin_user_id AND action = p_action;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_scheduled_job_run(p_job_name TEXT, p_idempotency_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_run public.scheduled_job_runs%ROWTYPE;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF p_job_name IS NULL OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Invalid job idempotency key'; END IF;
    INSERT INTO public.scheduled_job_runs(job_name, idempotency_key)
    VALUES (p_job_name, p_idempotency_key)
    ON CONFLICT (job_name, idempotency_key) DO NOTHING;
    SELECT * INTO v_run FROM public.scheduled_job_runs
    WHERE job_name = p_job_name AND idempotency_key = p_idempotency_key FOR UPDATE;
    IF v_run.status = 'COMPLETED' THEN RETURN FALSE; END IF;
    IF v_run.status = 'RUNNING' AND v_run.locked_at > v_now - INTERVAL '10 minutes' THEN
        RETURN FALSE;
    END IF;
    UPDATE public.scheduled_job_runs
    SET status = 'RUNNING', attempts = attempts + 1, locked_at = v_now, last_error = NULL
    WHERE id = v_run.id;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_scheduled_job_run(
    p_job_name TEXT,
    p_idempotency_key TEXT,
    p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.scheduled_job_runs
    SET status = CASE WHEN p_error IS NULL THEN 'COMPLETED' ELSE 'FAILED' END,
        completed_at = CASE WHEN p_error IS NULL THEN NOW() ELSE NULL END,
        last_error = LEFT(p_error, 2000)
    WHERE job_name = p_job_name AND idempotency_key = p_idempotency_key;
    IF NOT FOUND THEN RAISE EXCEPTION 'Scheduled job claim was not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_scheduled_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_expired_memberships INTEGER;
    v_expired_bookings INTEGER;
    v_released_entries INTEGER;
    v_booking_reminders INTEGER;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    INSERT INTO public.notifications(user_id, type, title, body, data)
    SELECT participant.user_id,
        'BOOKING_REMINDER',
        'Upcoming Companion booking',
        'Your PairUpToday booking is scheduled to start in about 24 hours.',
        JSONB_BUILD_OBJECT(
            'bookingId', b.id,
            'sourceKey', 'booking_reminder_24h:' || b.id::TEXT || ':' || participant.user_id::TEXT
        )
    FROM public.bookings b
    CROSS JOIN LATERAL (VALUES (b.client_id), (b.companion_id)) AS participant(user_id)
    WHERE b.status = 'CONFIRMED' AND b.payment_status = 'PAID'
      AND ((b.booking_date + b.start_time) AT TIME ZONE 'Asia/Kolkata')
          BETWEEN v_now + INTERVAL '23 hours 55 minutes'
              AND v_now + INTERVAL '24 hours 5 minutes'
    ON CONFLICT ((data->>'sourceKey')) WHERE (data ? 'sourceKey') DO NOTHING;
    GET DIAGNOSTICS v_booking_reminders = ROW_COUNT;

    UPDATE public.companion_profiles cp SET is_live = FALSE, updated_at = NOW()
    WHERE cp.is_live = TRUE AND NOT EXISTS (
        SELECT 1 FROM public.companion_memberships m
        WHERE m.user_id = cp.user_id AND m.payment_status = 'PAID' AND m.expiry_date > NOW()
    );
    GET DIAGNOSTICS v_expired_memberships = ROW_COUNT;

    UPDATE public.bookings SET status = 'CANCELLED', payment_status = 'FAILED',
        payment_expires_at = NULL, updated_at = NOW()
    WHERE status = 'PENDING' AND payment_status = 'PENDING'
      AND payment_expires_at IS NOT NULL AND payment_expires_at <= NOW();
    GET DIAGNOSTICS v_expired_bookings = ROW_COUNT;
    DELETE FROM public.booking_slot_reservations WHERE expires_at <= NOW();

    UPDATE public.wallet_ledger wl SET balance_status = 'AVAILABLE'
    FROM public.bookings b
    WHERE wl.booking_id = b.id AND wl.balance_status = 'LOCKED'
      AND wl.balance_locked_until <= NOW() AND b.status = 'COMPLETED'
      AND b.payment_status = 'PAID' AND b.settlement_status = 'LOCKED';
    GET DIAGNOSTICS v_released_entries = ROW_COUNT;
    UPDATE public.bookings b SET settlement_status = 'AVAILABLE', updated_at = NOW()
    WHERE b.status = 'COMPLETED' AND b.payment_status = 'PAID'
      AND b.settlement_status = 'LOCKED' AND b.settlement_unlock_at <= NOW()
      AND EXISTS (
          SELECT 1 FROM public.wallet_ledger wl
          WHERE wl.booking_id = b.id AND wl.balance_status = 'AVAILABLE'
      );
    DELETE FROM public.api_rate_limit_buckets WHERE expires_at <= NOW();
    DELETE FROM public.session_revocations WHERE expires_at <= NOW();
    DELETE FROM public.payment_webhook_events
    WHERE processed = TRUE AND created_at < NOW() - INTERVAL '90 days';
    DELETE FROM public.scheduled_job_runs
    WHERE status <> 'RUNNING' AND created_at < NOW() - INTERVAL '180 days';

    RETURN JSONB_BUILD_OBJECT(
        'expiredMembershipProfiles', v_expired_memberships,
        'expiredBookings', v_expired_bookings,
        'releasedLedgerEntries', v_released_entries,
        'bookingReminders', v_booking_reminders
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_booking_payout(
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
    v_admin public.admin_users%ROWTYPE;
    v_payout public.payouts%ROWTYPE;
BEGIN
    SELECT * INTO v_admin FROM public.admin_users
    WHERE id = p_admin_user_id AND is_active FOR SHARE;
    IF NOT FOUND OR v_admin.role NOT IN ('SUPER_ADMIN', 'FINANCE_ADMIN') THEN
        RAISE EXCEPTION 'Administrator is not authorized to process payouts';
    END IF;
    RETURN public.reserve_booking_payout(p_booking_id, p_admin_user_id, p_utr_reference);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_notification_pushes(
    p_notification_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(notification JSONB, device_tokens TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_limit < 1 THEN RAISE EXCEPTION 'Invalid notification batch size'; END IF;
    UPDATE public.notifications
    SET push_delivery_status = 'FAILED',
        push_claimed_at = NULL,
        push_last_error = COALESCE(push_last_error, 'Push delivery claim expired after the final attempt.')
    WHERE push_delivery_status = 'PROCESSING'
      AND push_attempts >= 5
      AND push_claimed_at < NOW() - INTERVAL '10 minutes';
    RETURN QUERY
    WITH candidates AS (
        SELECT n.id
        FROM public.notifications n
        WHERE (p_notification_id IS NULL OR n.id = p_notification_id)
          AND n.push_attempts < 5
          AND (
              (n.push_delivery_status = 'PENDING' AND n.push_retry_at <= NOW())
              OR (n.push_delivery_status = 'PROCESSING' AND n.push_claimed_at < NOW() - INTERVAL '10 minutes')
          )
        ORDER BY n.created_at
        LIMIT LEAST(p_limit, 500)
        FOR UPDATE SKIP LOCKED
    ), claimed AS (
        UPDATE public.notifications n
        SET push_delivery_status = 'PROCESSING',
            push_attempts = n.push_attempts + 1,
            push_claimed_at = NOW()
        FROM candidates c
        WHERE n.id = c.id
        RETURNING n.*
    )
    SELECT to_jsonb(c),
           ARRAY(SELECT t.token FROM public.firebase_device_tokens t WHERE t.user_id = c.user_id)
    FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_notification_push(
    p_notification_id UUID,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.notifications
    SET push_delivery_status = CASE
            WHEN p_success THEN 'SENT'
            WHEN push_attempts >= 5 THEN 'FAILED'
            ELSE 'PENDING'
        END,
        push_claimed_at = NULL,
        push_retry_at = NOW() + make_interval(
            secs => LEAST(3600, (30 * power(2, GREATEST(push_attempts - 1, 0)))::INTEGER)
        ),
        push_last_error = CASE WHEN p_success THEN NULL ELSE LEFT(COALESCE(p_error, 'Push delivery failed.'), 1000) END,
        push_sent_at = CASE WHEN p_success THEN NOW() ELSE NULL END
    WHERE id = p_notification_id AND push_delivery_status = 'PROCESSING';
    IF NOT FOUND THEN RAISE EXCEPTION 'Notification push claim was not found'; END IF;
    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_session_revoked(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_session(TEXT, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_payment_webhook_event(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_payment_webhook_event(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_payment_refund(UUID, UUID, TEXT, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_payment_refund(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_razorpay_order_failed(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_admin_sensitive_mfa(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_admin_sensitive_mfa_delivery(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_admin_sensitive_mfa(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_admin_sensitive_mfa(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_scheduled_job_run(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_scheduled_job_run(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_scheduled_maintenance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_booking_payout(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_notification_pushes(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_notification_push(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_session_revoked(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_session(TEXT, UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_payment_webhook_event(TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_webhook_event(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_payment_refund(UUID, UUID, TEXT, INTEGER, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_payment_refund(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_razorpay_order_failed(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_admin_sensitive_mfa(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_admin_sensitive_mfa_delivery(UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_admin_sensitive_mfa(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_admin_sensitive_mfa(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_job_run(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_scheduled_job_run(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_scheduled_maintenance() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_booking_payout(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_notification_pushes(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_notification_push(UUID, BOOLEAN, TEXT) TO service_role;
