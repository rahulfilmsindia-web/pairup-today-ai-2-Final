-- ==============================================================================
-- PAIRUPTODAY DEDICATED MIGRATION: FIRST-USER 3-MONTH FREE COUPON (FIRST3FREE)
-- Idempotent & Safe to execute directly in Supabase SQL Editor
-- Target Tables: users, used_trial_phones
-- Function: redeem_first_user_coupon(p_user_id, p_phone, p_code)
-- ==============================================================================

-- 1. Ensure required columns exist on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_used_free_trial BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_companion_active BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_expiry TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'none';

-- 2. Permanent anti-fraud table to lock used phone numbers forever
CREATE TABLE IF NOT EXISTS public.used_trial_phones (
    phone TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    coupon_code TEXT NOT NULL DEFAULT 'FIRST3FREE',
    used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for instant lookups
CREATE INDEX IF NOT EXISTS idx_used_trial_phones_lookup ON public.used_trial_phones(phone);

-- Enable RLS on used_trial_phones
ALTER TABLE public.used_trial_phones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "used_trial_phones_read_all" ON public.used_trial_phones;
    CREATE POLICY "used_trial_phones_read_all" ON public.used_trial_phones
        FOR SELECT TO authenticated, anon USING (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Atomic RPC Function to Redeem FIRST3FREE
CREATE OR REPLACE FUNCTION public.redeem_first_user_coupon(
    p_user_id UUID,
    p_phone TEXT,
    p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_norm_phone TEXT;
    v_user RECORD;
    v_expiry TIMESTAMPTZ;
BEGIN
    -- Validate coupon code (Strictly FIRST3FREE)
    IF UPPER(TRIM(COALESCE(p_code, ''))) <> 'FIRST3FREE' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid coupon code. Apply code FIRST3FREE for 3 Months Free Membership.'
        );
    END IF;

    -- Normalize phone string
    v_norm_phone := TRIM(COALESCE(p_phone, ''));
    IF v_norm_phone = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Phone number is required.');
    END IF;

    -- Anti-Fraud Check 1: Has this phone number ever redeemed a free trial?
    IF EXISTS (
        SELECT 1 FROM public.used_trial_phones 
        WHERE phone = v_norm_phone 
           OR phone = REPLACE(v_norm_phone, '+91', '') 
           OR phone = '+91' || REPLACE(v_norm_phone, '+91', '')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This phone number has already redeemed the first-user 3-month free trial.'
        );
    END IF;

    -- Anti-Fraud Check 2: Check current user account
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User account not found.');
    END IF;

    IF COALESCE(v_user.has_used_free_trial, false) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Your account has already redeemed a free trial offer.'
        );
    END IF;

    -- Calculate 90 days (3 months) expiry
    v_expiry := now() + INTERVAL '90 days';

    -- 1. Permanently record phone in used_trial_phones anti-fraud table
    INSERT INTO public.used_trial_phones (phone, user_id, coupon_code, used_at)
    VALUES (v_norm_phone, p_user_id, 'FIRST3FREE', now())
    ON CONFLICT (phone) DO NOTHING;

    -- 2. Activate Companion Free Trial in users table
    UPDATE public.users
    SET has_used_free_trial = true,
        is_companion_active = true,
        membership_type = 'free_trial',
        membership_expiry = v_expiry
    WHERE id = p_user_id;

    -- 3. Sync companion_profiles if exists
    UPDATE public.companion_profiles
    SET is_live = true
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Congratulations! 3 Months Free Companion Membership activated successfully!',
        'membership_type', 'free_trial',
        'membership_expiry', v_expiry
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated & anon roles
GRANT EXECUTE ON FUNCTION public.redeem_first_user_coupon(UUID, TEXT, TEXT) TO authenticated, anon, service_role;
