-- Persistent, backend-only OTP challenges for APITXT custom authentication.
-- Apply after 001_initial_schema.sql and 002_rls_policies.sql.

CREATE TABLE IF NOT EXISTS public.auth_otp_challenges (
    phone TEXT PRIMARY KEY CHECK (phone ~ '^\+91[6-9][0-9]{9}$'),
    otp_hash CHAR(64) NOT NULL CHECK (otp_hash ~ '^[0-9a-f]{64}$'),
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 4),
    last_sent_at TIMESTAMPTZ NOT NULL,
    window_start_at TIMESTAMPTZ NOT NULL,
    window_count INTEGER NOT NULL DEFAULT 1 CHECK (window_count BETWEEN 1 AND 3),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'EXPIRED', 'LOCKED', 'CONSUMED')),
    provider_request_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_challenges_expiry
    ON public.auth_otp_challenges (expires_at);

ALTER TABLE public.auth_otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_otp_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_otp_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_auth_otp(p_phone TEXT, p_otp_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_challenge public.auth_otp_challenges%ROWTYPE;
    v_wait INTEGER;
BEGIN
    IF p_phone !~ '^\+91[6-9][0-9]{9}$' OR p_otp_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid OTP challenge input';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_phone, 0));
    SELECT * INTO v_challenge
    FROM public.auth_otp_challenges
    WHERE phone = p_phone
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.auth_otp_challenges (
            phone, otp_hash, expires_at, attempts, last_sent_at,
            window_start_at, window_count, status
        ) VALUES (
            p_phone, p_otp_hash, v_now + INTERVAL '5 minutes', 0,
            v_now, v_now, 1, 'PENDING'
        );
        RETURN jsonb_build_object('allowed', TRUE);
    END IF;

    IF v_now < v_challenge.last_sent_at + INTERVAL '60 seconds' THEN
        v_wait := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_challenge.last_sent_at + INTERVAL '60 seconds' - v_now)))::INTEGER);
        RETURN jsonb_build_object('allowed', FALSE, 'reason', 'cooldown', 'waitSeconds', v_wait);
    END IF;

    IF v_now < v_challenge.window_start_at + INTERVAL '60 seconds'
       AND v_challenge.window_count >= 3 THEN
        v_wait := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_challenge.window_start_at + INTERVAL '60 seconds' - v_now)))::INTEGER);
        RETURN jsonb_build_object('allowed', FALSE, 'reason', 'rate_limit', 'waitSeconds', v_wait);
    END IF;

    UPDATE public.auth_otp_challenges
    SET otp_hash = p_otp_hash,
        expires_at = v_now + INTERVAL '5 minutes',
        attempts = 0,
        last_sent_at = v_now,
        window_start_at = CASE
            WHEN v_now < v_challenge.window_start_at + INTERVAL '60 seconds' THEN v_challenge.window_start_at
            ELSE v_now
        END,
        window_count = CASE
            WHEN v_now < v_challenge.window_start_at + INTERVAL '60 seconds' THEN v_challenge.window_count + 1
            ELSE 1
        END,
        status = 'PENDING',
        provider_request_id = NULL,
        updated_at = v_now
    WHERE phone = p_phone;

    RETURN jsonb_build_object('allowed', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_auth_otp_delivery(
    p_phone TEXT,
    p_sent BOOLEAN,
    p_request_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.auth_otp_challenges
    SET status = CASE WHEN p_sent THEN 'SENT' ELSE 'FAILED' END,
        provider_request_id = CASE WHEN p_sent THEN LEFT(p_request_id, 255) ELSE NULL END,
        updated_at = clock_timestamp()
    WHERE phone = p_phone AND status = 'PENDING';
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_auth_otp(p_phone TEXT, p_otp_hash TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_challenge public.auth_otp_challenges%ROWTYPE;
BEGIN
    IF p_phone IS NULL OR p_otp_hash IS NULL
       OR p_phone !~ '^\+91[6-9][0-9]{9}$'
       OR p_otp_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN 'not_found';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_phone, 0));
    SELECT * INTO v_challenge
    FROM public.auth_otp_challenges
    WHERE phone = p_phone
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'not_found';
    END IF;

    IF v_challenge.status = 'LOCKED' THEN
        RETURN 'locked';
    END IF;
    IF v_challenge.status <> 'SENT' THEN
        RETURN 'not_found';
    END IF;

    IF v_now >= v_challenge.expires_at THEN
        UPDATE public.auth_otp_challenges
        SET status = 'EXPIRED', updated_at = v_now
        WHERE phone = p_phone;
        RETURN 'expired';
    END IF;

    IF v_challenge.attempts >= 4 THEN
        UPDATE public.auth_otp_challenges
        SET status = 'LOCKED', updated_at = v_now
        WHERE phone = p_phone;
        RETURN 'locked';
    END IF;

    IF v_challenge.otp_hash <> p_otp_hash THEN
        UPDATE public.auth_otp_challenges
        SET attempts = attempts + 1,
            status = CASE WHEN attempts + 1 >= 4 THEN 'LOCKED' ELSE status END,
            updated_at = v_now
        WHERE phone = p_phone;
        RETURN CASE WHEN v_challenge.attempts + 1 >= 4 THEN 'locked' ELSE 'invalid' END;
    END IF;

    UPDATE public.auth_otp_challenges
    SET status = 'CONSUMED', updated_at = v_now
    WHERE phone = p_phone;
    RETURN 'verified';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_auth_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_auth_otp_delivery(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_auth_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_auth_otp(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_auth_otp_delivery(TEXT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_auth_otp(TEXT, TEXT) TO service_role;
