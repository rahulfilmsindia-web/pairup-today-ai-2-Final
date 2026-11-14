-- Durable APITXT administrator MFA challenges. Backend service-role only.

CREATE TABLE IF NOT EXISTS public.admin_mfa_challenges (
    email TEXT PRIMARY KEY CHECK (email = LOWER(email) AND email LIKE '%@%'),
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

CREATE INDEX IF NOT EXISTS idx_admin_mfa_challenges_expiry
    ON public.admin_mfa_challenges (expires_at);

ALTER TABLE public.admin_mfa_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_mfa_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_mfa_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_admin_mfa(p_email TEXT, p_otp_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_challenge public.admin_mfa_challenges%ROWTYPE;
    v_email TEXT := LOWER(TRIM(p_email));
    v_wait INTEGER;
BEGIN
    IF v_email IS NULL OR v_email NOT LIKE '%@%' OR p_otp_hash IS NULL OR p_otp_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid administrator MFA challenge input';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_email, 0));
    SELECT * INTO v_challenge
    FROM public.admin_mfa_challenges
    WHERE email = v_email
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.admin_mfa_challenges (
            email, otp_hash, expires_at, attempts, last_sent_at,
            window_start_at, window_count, status
        ) VALUES (
            v_email, p_otp_hash, v_now + INTERVAL '5 minutes', 0,
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

    UPDATE public.admin_mfa_challenges
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
    WHERE email = v_email;

    RETURN jsonb_build_object('allowed', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_admin_mfa_delivery(
    p_email TEXT,
    p_sent BOOLEAN,
    p_request_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.admin_mfa_challenges
    SET status = CASE WHEN p_sent THEN 'SENT' ELSE 'FAILED' END,
        provider_request_id = CASE WHEN p_sent THEN LEFT(p_request_id, 255) ELSE NULL END,
        updated_at = clock_timestamp()
    WHERE email = LOWER(TRIM(p_email)) AND status = 'PENDING';
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_mfa(p_email TEXT, p_otp_hash TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_challenge public.admin_mfa_challenges%ROWTYPE;
    v_email TEXT := LOWER(TRIM(p_email));
BEGIN
    IF v_email IS NULL OR p_otp_hash IS NULL OR p_otp_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN 'not_found';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_email, 0));
    SELECT * INTO v_challenge
    FROM public.admin_mfa_challenges
    WHERE email = v_email
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
        UPDATE public.admin_mfa_challenges
        SET status = 'EXPIRED', updated_at = v_now
        WHERE email = v_email;
        RETURN 'expired';
    END IF;
    IF v_challenge.attempts >= 4 THEN
        UPDATE public.admin_mfa_challenges
        SET status = 'LOCKED', updated_at = v_now
        WHERE email = v_email;
        RETURN 'locked';
    END IF;
    IF v_challenge.otp_hash <> p_otp_hash THEN
        UPDATE public.admin_mfa_challenges
        SET attempts = attempts + 1,
            status = CASE WHEN attempts + 1 >= 4 THEN 'LOCKED' ELSE status END,
            updated_at = v_now
        WHERE email = v_email;
        RETURN CASE WHEN v_challenge.attempts + 1 >= 4 THEN 'locked' ELSE 'invalid' END;
    END IF;

    UPDATE public.admin_mfa_challenges
    SET status = 'CONSUMED', updated_at = v_now
    WHERE email = v_email;
    RETURN 'verified';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_admin_mfa(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_admin_mfa_delivery(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_admin_mfa(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_admin_mfa(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_admin_mfa_delivery(TEXT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_admin_mfa(TEXT, TEXT) TO service_role;
