-- Master Clean Migration File for PairUpToday

-- ==========================================
-- FILE: 001_initial_schema.sql
-- ==========================================

-- PairUpToday Initial Database Schema
-- Migration: 001_initial_schema
-- Created: 2026-11-11

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('CLIENT', 'COMPANION', 'DUAL')),
    active_role VARCHAR(20) CHECK (active_role IN ('CLIENT', 'COMPANION')),
    dob DATE,
    age INTEGER,
    kyc_status VARCHAR(50) DEFAULT 'NOT_SUBMITTED' CHECK (kyc_status IN ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED')),
    kyc_submitted_at TIMESTAMP WITH TIME ZONE,
    kyc_decided_at TIMESTAMP WITH TIME ZONE,
    kyc_decided_by UUID REFERENCES users(id),
    kyc_rejection_reason TEXT,
    profile_photo TEXT,
    bio TEXT,
    photos JSONB,
    city VARCHAR(100),
    state VARCHAR(100),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_city ON users(city);

-- KYC Submissions table
CREATE TABLE kyc_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_role VARCHAR(20) NOT NULL CHECK (submission_role IN ('CLIENT', 'COMPANION')),
    legal_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    id_type VARCHAR(50) NOT NULL,
    id_reference VARCHAR(100),
    id_front_document_path TEXT NOT NULL,
    id_back_document_path TEXT,
    selfie_document_path TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    UNIQUE(user_id, submission_role)
);

CREATE INDEX idx_kyc_submissions_user_id ON kyc_submissions(user_id);
CREATE INDEX idx_kyc_submissions_status ON kyc_submissions(status);

-- Companion Profiles table
CREATE TABLE companion_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    services INTEGER[] NOT NULL,
    rates JSONB NOT NULL,
    availability JSONB,
    is_live BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_bookings INTEGER DEFAULT 0,
    address TEXT,
    state VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_initial_listing BOOLEAN DEFAULT FALSE,
    is_paused BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_companion_profiles_user_id ON companion_profiles(user_id);
CREATE INDEX idx_companion_profiles_is_live ON companion_profiles(is_live);
CREATE INDEX idx_companion_profiles_state ON companion_profiles(state);

-- Companion Memberships table
CREATE TABLE companion_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL CHECK (plan IN ('STARTER', 'PROFESSIONAL', 'PREMIUM')),
    amount_paise INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    payment_order_id VARCHAR(255),
    payment_id VARCHAR(255),
    payment_status VARCHAR(50) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_companion_memberships_user_id ON companion_memberships(user_id);
CREATE INDEX idx_companion_memberships_expiry_date ON companion_memberships(expiry_date);

-- Bank Verification table
CREATE TABLE bank_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number_encrypted TEXT NOT NULL,
    ifsc VARCHAR(20) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED')),
    name_at_bank VARCHAR(255),
    name_matched BOOLEAN,
    provider_request_id VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_bank_verifications_user_id ON bank_verifications(user_id);
CREATE INDEX idx_bank_verifications_status ON bank_verifications(verification_status);

-- Bookings table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_code VARCHAR(20) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES users(id),
    companion_id UUID NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours INTEGER NOT NULL,
    meeting_location TEXT NOT NULL,
    meeting_address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    notes TEXT,
    amount_paise INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    payment_order_id VARCHAR(255),
    payment_id VARCHAR(255),
    payment_status VARCHAR(50) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    start_otp_hash VARCHAR(255),
    completion_otp_hash VARCHAR(255),
    companion_arrived_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    delay_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_companion_id ON bookings(companion_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_booking_code ON bookings(booking_code);

-- Wallet Ledger table
CREATE TABLE wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('EARNING', 'COMMISSION', 'PENALTY', 'PAYOUT', 'REFUND')),
    gross_amount_paise INTEGER,
    commission_paise INTEGER,
    penalty_paise INTEGER,
    net_amount_paise INTEGER,
    balance_locked_until TIMESTAMP WITH TIME ZONE,
    balance_status VARCHAR(50) DEFAULT 'AVAILABLE' CHECK (balance_status IN ('AVAILABLE', 'LOCKED', 'PAID_OUT')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wallet_ledger_user_id ON wallet_ledger(user_id);
CREATE INDEX idx_wallet_ledger_booking_id ON wallet_ledger(booking_id);
CREATE INDEX idx_wallet_ledger_balance_status ON wallet_ledger(balance_status);

-- Payouts table
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    total_amount_paise INTEGER NOT NULL,
    commission_paise INTEGER NOT NULL,
    penalty_paise INTEGER DEFAULT 0,
    net_amount_paise INTEGER NOT NULL,
    payout_status VARCHAR(50) DEFAULT 'PENDING' CHECK (payout_status IN ('PENDING', 'PROCESSING', 'PAID_OUT', 'FAILED')),
    utr_reference VARCHAR(255),
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payouts_user_id ON payouts(user_id);
CREATE INDEX idx_payouts_status ON payouts(payout_status);

-- Chat Conversations table
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    participant_a UUID NOT NULL REFERENCES users(id),
    participant_b UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant_a, participant_b, booking_id)
);

CREATE INDEX idx_chat_conversations_booking_id ON chat_conversations(booking_id);
CREATE INDEX idx_chat_conversations_participants ON chat_conversations(participant_a, participant_b);

-- Chat Messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);

-- Support Conversations table
CREATE TABLE support_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    assigned_admin_id UUID REFERENCES users(id),
    subject TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_support_conversations_user_id ON support_conversations(user_id);
CREATE INDEX idx_support_conversations_status ON support_conversations(status);
CREATE INDEX idx_support_conversations_assigned_admin ON support_conversations(assigned_admin_id);

-- Support Messages table
CREATE TABLE support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    is_admin BOOLEAN DEFAULT FALSE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_support_messages_conversation_id ON support_messages(conversation_id);

-- Admin Users table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'KYC_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR')),
    legal_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);

-- Admin MFA Store table
CREATE TABLE admin_mfa_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_mfa_store_admin_id ON admin_mfa_store(admin_id);

-- Audit Logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);

-- Payment Webhook Events table (for idempotency)
CREATE TABLE payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_webhook_events_event_id ON payment_webhook_events(event_id);
CREATE INDEX idx_payment_webhook_events_processed ON payment_webhook_events(processed);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companion_profiles_updated_at BEFORE UPDATE ON companion_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_verifications_updated_at BEFORE UPDATE ON bank_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_conversations_updated_at BEFORE UPDATE ON support_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- FILE: 002_rls_policies.sql
-- ==========================================

-- PairUpToday
-- Migration: 002_rls_policies
-- Architecture: Custom Backend Authentication
-- Supabase Auth is NOT used.

BEGIN;

-- 1. Enable RLS on all application tables

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- 2. Remove existing policies from these application tables

DO $$
DECLARE
    t TEXT;
    p RECORD;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users',
        'kyc_submissions',
        'companion_profiles',
        'companion_memberships',
        'bank_verifications',
        'bookings',
        'wallet_ledger',
        'payouts',
        'chat_conversations',
        'chat_messages',
        'support_conversations',
        'support_messages',
        'admin_users',
        'admin_mfa_store',
        'audit_logs',
        'notifications',
        'payment_webhook_events'
    ]
    LOOP
        FOR p IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = t
        LOOP
            EXECUTE format(
                'DROP POLICY %I ON public.%I',
                p.policyname,
                t
            );
        END LOOP;
    END LOOP;
END $$;

-- 3. Remove direct access from public-facing roles

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
FROM anon, authenticated;

-- 4. Grant backend database access

GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
TO service_role;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
TO service_role;

-- 5. Set default privileges for future application tables

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

COMMIT;

-- ==========================================
-- FILE: 003_auth_otp_challenges.sql
-- ==========================================

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


-- ==========================================
-- FILE: 004_admin_mfa_challenges.sql
-- ==========================================

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


-- ==========================================
-- FILE: 005_canonical_business_data.sql
-- ==========================================

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


-- ==========================================
-- FILE: 006_profile_kyc_storage.sql
-- ==========================================

-- Private KYC document storage and transactional profile/KYC operations.
-- Apply after migrations 001-005.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('client-kyc-documents', 'client-kyc-documents', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('companion-kyc-documents', 'companion-kyc-documents', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Backend service role manages private KYC documents" ON storage.objects;
CREATE POLICY "Backend service role manages private KYC documents"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id IN ('client-kyc-documents', 'companion-kyc-documents'))
    WITH CHECK (bucket_id IN ('client-kyc-documents', 'companion-kyc-documents'));

CREATE OR REPLACE FUNCTION public.submit_profile_kyc(
    p_user_id UUID,
    p_submission_id UUID,
    p_role VARCHAR,
    p_legal_name VARCHAR,
    p_dob DATE,
    p_id_type VARCHAR,
    p_id_front_path TEXT,
    p_id_back_path TEXT,
    p_selfie_path TEXT,
    p_bio TEXT,
    p_photos JSONB,
    p_city VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
    v_submission public.kyc_submissions%ROWTYPE;
BEGIN
    IF p_role NOT IN ('CLIENT', 'COMPANION') THEN
        RAISE EXCEPTION 'Invalid KYC submission role';
    END IF;
    IF p_dob > CURRENT_DATE - INTERVAL '18 years' THEN
        RAISE EXCEPTION 'KYC applicant must be at least 18 years old';
    END IF;
    IF p_id_front_path IS NULL OR p_selfie_path IS NULL THEN
        RAISE EXCEPTION 'Required private KYC document paths are missing';
    END IF;

    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'KYC user does not exist';
    END IF;
    IF v_user.role NOT IN (p_role, 'DUAL') THEN
        RAISE EXCEPTION 'User is not permitted to submit KYC for this role';
    END IF;

    INSERT INTO public.kyc_submissions (
        id, user_id, submission_role, legal_name, dob, id_type,
        id_front_document_path, id_back_document_path, selfie_document_path,
        status, submitted_at, profile_bio, profile_photos, city
    ) VALUES (
        p_submission_id, p_user_id, p_role, p_legal_name, p_dob, p_id_type,
        p_id_front_path, p_id_back_path, p_selfie_path,
        'PENDING', NOW(), p_bio, p_photos, p_city
    )
    ON CONFLICT (user_id, submission_role) DO UPDATE
    SET legal_name = EXCLUDED.legal_name,
        dob = EXCLUDED.dob,
        id_type = EXCLUDED.id_type,
        id_front_document_path = EXCLUDED.id_front_document_path,
        id_back_document_path = EXCLUDED.id_back_document_path,
        selfie_document_path = EXCLUDED.selfie_document_path,
        status = 'PENDING',
        submitted_at = NOW(),
        reviewed_at = NULL,
        reviewed_by = NULL,
        reviewed_by_admin_id = NULL,
        rejection_reason = NULL,
        profile_bio = EXCLUDED.profile_bio,
        profile_photos = EXCLUDED.profile_photos,
        city = EXCLUDED.city
    WHERE public.kyc_submissions.status <> 'APPROVED'
    RETURNING * INTO v_submission;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Approved KYC records cannot be replaced';
    END IF;

    UPDATE public.users
    SET legal_name = p_legal_name,
        dob = p_dob,
        age = DATE_PART('year', AGE(CURRENT_DATE, p_dob))::INTEGER,
        kyc_status = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN 'PENDING'
            ELSE kyc_status
        END,
        kyc_submitted_at = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NOW()
            ELSE kyc_submitted_at
        END,
        kyc_decided_at = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NULL
            ELSE kyc_decided_at
        END,
        kyc_decided_by = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NULL
            ELSE kyc_decided_by
        END,
        kyc_decided_by_admin_id = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NULL
            ELSE kyc_decided_by_admin_id
        END,
        kyc_rejection_reason = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NULL
            ELSE kyc_rejection_reason
        END,
        bio = p_bio,
        photos = p_photos,
        city = p_city,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TO_JSONB(v_submission);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_profile_kyc(UUID, UUID, VARCHAR, VARCHAR, DATE, VARCHAR, TEXT, TEXT, TEXT, TEXT, JSONB, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_profile_kyc(UUID, UUID, VARCHAR, VARCHAR, DATE, VARCHAR, TEXT, TEXT, TEXT, TEXT, JSONB, VARCHAR)
    TO service_role;

CREATE OR REPLACE FUNCTION public.review_profile_kyc(
    p_submission_id UUID,
    p_decision VARCHAR,
    p_rejection_reason TEXT,
    p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_submission public.kyc_submissions%ROWTYPE;
    v_user public.users%ROWTYPE;
    v_admin public.admin_users%ROWTYPE;
BEGIN
    IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'Invalid KYC decision';
    END IF;
    IF p_decision = 'REJECTED' AND NULLIF(BTRIM(p_rejection_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A rejection reason is required';
    END IF;

    SELECT * INTO v_admin
    FROM public.admin_users
    WHERE id = p_admin_user_id AND is_active = TRUE
    FOR SHARE;
    IF NOT FOUND OR v_admin.role NOT IN ('SUPER_ADMIN', 'KYC_ADMIN') THEN
        RAISE EXCEPTION 'Administrator is not authorized to review KYC';
    END IF;

    SELECT * INTO v_submission
    FROM public.kyc_submissions
    WHERE id = p_submission_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'KYC submission not found';
    END IF;

    UPDATE public.kyc_submissions
    SET status = p_decision,
        reviewed_at = NOW(),
        reviewed_by_admin_id = p_admin_user_id,
        rejection_reason = CASE WHEN p_decision = 'REJECTED' THEN BTRIM(p_rejection_reason) ELSE NULL END
    WHERE id = p_submission_id
    RETURNING * INTO v_submission;

    UPDATE public.users
    SET kyc_status = CASE
            WHEN role <> 'DUAL' OR v_submission.submission_role = 'CLIENT' THEN p_decision
            ELSE kyc_status
        END,
        kyc_decided_at = CASE
            WHEN role <> 'DUAL' OR v_submission.submission_role = 'CLIENT' THEN v_submission.reviewed_at
            ELSE kyc_decided_at
        END,
        kyc_decided_by_admin_id = CASE
            WHEN role <> 'DUAL' OR v_submission.submission_role = 'CLIENT' THEN p_admin_user_id
            ELSE kyc_decided_by_admin_id
        END,
        kyc_rejection_reason = CASE
            WHEN role <> 'DUAL' OR v_submission.submission_role = 'CLIENT' THEN v_submission.rejection_reason
            ELSE kyc_rejection_reason
        END,
        updated_at = NOW()
    WHERE id = v_submission.user_id
    RETURNING * INTO v_user;

    IF v_submission.submission_role = 'COMPANION' THEN
        UPDATE public.companion_profiles cp
        SET is_live = (
            p_decision = 'APPROVED'
            AND NOT COALESCE(cp.is_paused, FALSE)
            AND EXISTS (
                SELECT 1 FROM public.kyc_submissions k
                WHERE k.user_id = cp.user_id
                  AND k.submission_role = 'COMPANION'
                  AND k.status = 'APPROVED'
            )
            AND EXISTS (
                SELECT 1 FROM public.companion_memberships m
                WHERE m.user_id = cp.user_id
                  AND m.payment_status = 'PAID'
                  AND m.expiry_date > NOW()
            )
            AND EXISTS (
                SELECT 1 FROM public.bank_verifications b
                WHERE b.user_id = cp.user_id
                  AND b.verification_status = 'VERIFIED'
            )
        )
        WHERE cp.user_id = v_submission.user_id;
    END IF;

    INSERT INTO public.audit_logs (
        admin_user_id, user_id, action, entity_type, entity_id, details
    ) VALUES (
        p_admin_user_id, v_submission.user_id, 'KYC_' || p_decision,
        'kyc_submission', v_submission.id,
        jsonb_build_object(
            'submission_role', v_submission.submission_role,
            'rejection_reason', v_submission.rejection_reason
        )
    );

    RETURN JSONB_BUILD_OBJECT('submission', TO_JSONB(v_submission), 'user', TO_JSONB(v_user));
END;
$$;

REVOKE ALL ON FUNCTION public.review_profile_kyc(UUID, VARCHAR, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_profile_kyc(UUID, VARCHAR, TEXT, UUID)
    TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_companion_activation_gates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.is_live THEN
        NEW.is_live := NOT COALESCE(NEW.is_paused, FALSE) AND EXISTS (
            SELECT 1
            FROM public.kyc_submissions k
            WHERE k.user_id = NEW.user_id
              AND k.submission_role = 'COMPANION'
              AND k.status = 'APPROVED'
        ) AND EXISTS (
            SELECT 1
            FROM public.companion_memberships m
            WHERE m.user_id = NEW.user_id
              AND m.payment_status = 'PAID'
              AND m.expiry_date > NOW()
        ) AND EXISTS (
            SELECT 1
            FROM public.bank_verifications b
            WHERE b.user_id = NEW.user_id
              AND b.verification_status = 'VERIFIED'
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_companion_activation_gates
    BEFORE INSERT OR UPDATE OF is_live ON public.companion_profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_companion_activation_gates();


-- ==========================================
-- FILE: 007_booking_payment_transactions.sql
-- ==========================================

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


-- ==========================================
-- FILE: 008_runtime_finance_and_delivery.sql
-- ==========================================

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

