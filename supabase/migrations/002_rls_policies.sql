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