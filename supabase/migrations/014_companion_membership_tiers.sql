-- ==============================================================================
-- PAIRUPTODAY MIGRATION 014: COMPANION MEMBERSHIP PLAN TIERS & FIRST3FREE SYNC
-- Safe, Idempotent, and production-ready for Supabase SQL Editor
-- Tables: public.users, public.used_trial_phones, public.companion_memberships
-- RPC Functions: redeem_first_user_coupon, apply_companion_membership
-- ==============================================================================

-- 1. Ensure all tier columns exist on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'none';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_companion_active BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_expiry TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'none';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS boost_expiry TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_vip_badge BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_used_free_trial BOOLEAN DEFAULT false;

-- 2. Ensure anti-fraud table exists
CREATE TABLE IF NOT EXISTS public.used_trial_phones (
    phone TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    coupon_code TEXT NOT NULL DEFAULT 'FIRST3FREE',
    used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_used_trial_phones_lookup ON public.used_trial_phones(phone);

ALTER TABLE public.used_trial_phones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "used_trial_phones_read_all" ON public.used_trial_phones;
    CREATE POLICY "used_trial_phones_read_all" ON public.used_trial_phones
        FOR SELECT TO authenticated, anon USING (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Atomic RPC Function to Redeem FIRST3FREE (90-day Free Trial)
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
        plan_tier = 'free_trial',
        membership_expiry = v_expiry
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', '🎉 Congratulations! 3 Months (90 Days) Free Companion Membership activated successfully!',
        'membership_expiry', v_expiry,
        'plan_tier', 'free_trial'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atomic Function to Apply Paid Membership Tier
CREATE OR REPLACE FUNCTION public.apply_companion_membership(
    p_user_id UUID,
    p_plan TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_plan_clean TEXT;
    v_expiry TIMESTAMPTZ;
    v_tier TEXT;
    v_boosted BOOLEAN := false;
    v_vip BOOLEAN := false;
BEGIN
    v_plan_clean := UPPER(TRIM(COALESCE(p_plan, '')));

    IF v_plan_clean = 'STARTER' THEN
        v_tier := 'starter';
        v_expiry := now() + INTERVAL '30 days';
        v_boosted := false;
        v_vip := false;
    ELSIF v_plan_clean = 'PROFESSIONAL' THEN
        v_tier := 'professional';
        v_expiry := now() + INTERVAL '90 days';
        v_boosted := true;
        v_vip := false;
    ELSIF v_plan_clean = 'PREMIUM' THEN
        v_tier := 'premium';
        v_expiry := now() + INTERVAL '365 days';
        v_boosted := true;
        v_vip := true;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid membership plan. Must be STARTER, PROFESSIONAL, or PREMIUM.');
    END IF;

    UPDATE public.users
    SET is_companion_active = true,
        membership_type = 'paid',
        plan_tier = v_tier,
        membership_expiry = v_expiry,
        is_boosted = v_boosted,
        has_vip_badge = v_vip
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'plan_tier', v_tier,
        'membership_expiry', v_expiry,
        'is_boosted', v_boosted,
        'has_vip_badge', v_vip
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.redeem_first_user_coupon(UUID, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.apply_companion_membership(UUID, TEXT) TO authenticated, service_role;
