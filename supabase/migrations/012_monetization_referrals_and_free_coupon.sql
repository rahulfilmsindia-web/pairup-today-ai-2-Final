-- ==============================================================================
-- Migration 012: Monetization, Milestone-Based Referral, Anti-Fraud Free Coupon
-- PairUpToday Production Architecture (Capacitor 6 + Web Compliant)
-- ==============================================================================

-- 1. Extend `users` table with monetization, referral & membership columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS successful_referrals_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_10_percent_booking_discount BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_companion_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS membership_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'none' CHECK (membership_type IN ('none', 'free_trial', 'paid')),
  ADD COLUMN IF NOT EXISTS has_used_free_trial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_verified_referrer_badge BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);

-- 2. Strict Anti-Fraud Table for Free Trial Phones
-- Permanently blocks a phone number from redeeming 'FIRST3FREE' even after account deletion / re-registration
CREATE TABLE IF NOT EXISTS public.used_trial_phones (
    phone TEXT PRIMARY KEY,
    used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID,
    coupon_code TEXT NOT NULL DEFAULT 'FIRST3FREE'
);

ALTER TABLE public.used_trial_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to used_trial_phones"
  ON public.used_trial_phones
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Dedicated Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('client', 'companion')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified_active')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ,
    CONSTRAINT unique_referee UNIQUE (referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON public.referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view referrals where they are referrer or referee"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE POLICY "Service role can manage referrals"
  ON public.referrals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Helper Function: Auto-Generate Referral Code for New Users
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(p_name TEXT)
RETURNS TEXT AS $$
DECLARE
    v_clean_name TEXT;
    v_prefix TEXT;
    v_code TEXT;
    v_exists BOOLEAN;
    v_attempts INTEGER := 0;
BEGIN
    v_clean_name := UPPER(REGEXP_REPLACE(COALESCE(p_name, 'PAIR'), '[^a-zA-Z]', '', 'g'));
    IF LENGTH(v_clean_name) < 4 THEN
        v_clean_name := RPAD(v_clean_name, 4, 'P');
    END IF;
    v_prefix := SUBSTRING(v_clean_name, 1, 4);

    LOOP
        v_attempts := v_attempts + 1;
        v_code := v_prefix || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
        
        SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = v_code) INTO v_exists;
        IF NOT v_exists OR v_attempts > 20 THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically populate referral_code upon signup
CREATE OR REPLACE FUNCTION public.trig_fn_assign_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL OR TRIM(NEW.referral_code) = '' THEN
        NEW.referral_code := public.generate_unique_referral_code(COALESCE(NEW.legal_name, 'PAIR'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.users;
CREATE TRIGGER trg_assign_referral_code
    BEFORE INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trig_fn_assign_referral_code();

-- Retroactively generate referral codes for existing users who don't have one
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, legal_name FROM public.users WHERE referral_code IS NULL LOOP
        UPDATE public.users 
        SET referral_code = public.generate_unique_referral_code(r.legal_name)
        WHERE id = r.id;
    END LOOP;
END $$;

-- 5. RPC Function: First-User 3-Month Free Coupon (`FIRST3FREE`)
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
    -- Normalize code & phone
    IF UPPER(TRIM(p_code)) <> 'FIRST3FREE' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid coupon code. Use FIRST3FREE for the 3-month free trial.'
        );
    END IF;

    v_norm_phone := TRIM(p_phone);
    IF v_norm_phone = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Phone number is required.');
    END IF;

    -- Strict anti-fraud check 1: Permanent phone lockout table
    IF EXISTS (SELECT 1 FROM public.used_trial_phones WHERE phone = v_norm_phone) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This phone number has already redeemed the first-user 3-month free trial.'
        );
    END IF;

    -- Check user record
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User account not found.');
    END IF;

    -- Strict anti-fraud check 2: User record flag
    IF v_user.has_used_free_trial THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Your account has already used a free trial.'
        );
    END IF;

    v_expiry := now() + INTERVAL '90 days';

    -- 1. Lock phone in permanent anti-fraud table
    INSERT INTO public.used_trial_phones (phone, user_id, coupon_code, used_at)
    VALUES (v_norm_phone, p_user_id, 'FIRST3FREE', now())
    ON CONFLICT (phone) DO NOTHING;

    -- 2. Activate Companion Free Trial Membership
    UPDATE public.users
    SET has_used_free_trial = true,
        is_companion_active = true,
        membership_type = 'free_trial',
        membership_expiry = v_expiry
    WHERE id = p_user_id;

    -- Also sync companion_profiles table if it exists
    UPDATE public.companion_profiles
    SET is_live = true
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Congratulations! 3 Months Free Companion Membership activated successfully.',
        'membership_type', 'free_trial',
        'membership_expiry', v_expiry
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Milestone Referral System Rewards Procedure
CREATE OR REPLACE FUNCTION public.reward_referral_milestone(p_referrer_id UUID)
RETURNS VOID AS $$
DECLARE
    v_referrer RECORD;
    v_count INTEGER;
BEGIN
    SELECT * INTO v_referrer FROM public.users WHERE id = p_referrer_id;
    IF NOT FOUND THEN RETURN; END IF;

    v_count := v_referrer.successful_referrals_count + 1;

    -- Update count
    UPDATE public.users 
    SET successful_referrals_count = v_count
    WHERE id = p_referrer_id;

    -- Check if multiple of 5 (5, 10, 15, 20...)
    IF v_count > 0 AND (v_count % 5 = 0) THEN
        IF v_referrer.role = 'COMPANION' OR v_referrer.active_role = 'COMPANION' THEN
            -- Companion Milestone Rewards:
            -- 1. +30 Days Free Membership
            -- 2. 15 Days Profile Boost
            -- 3. Verified Referrer Badge
            UPDATE public.users
            SET membership_expiry = GREATEST(COALESCE(membership_expiry, now()), now()) + INTERVAL '30 days',
                is_companion_active = true,
                is_boosted = true,
                boost_expiry = GREATEST(COALESCE(boost_expiry, now()), now()) + INTERVAL '15 days',
                has_verified_referrer_badge = true
            WHERE id = p_referrer_id;
        ELSE
            -- Client Milestone Rewards:
            -- 10% OFF on next booking
            UPDATE public.users
            SET has_10_percent_booking_discount = true
            WHERE id = p_referrer_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger: Verify Companion Referral When KYC Approved + Membership Active + Online
CREATE OR REPLACE FUNCTION public.trig_fn_verify_companion_referral()
RETURNS TRIGGER AS $$
DECLARE
    v_ref RECORD;
BEGIN
    -- Condition for Companion: KYC Approved + Active Membership
    IF (NEW.kyc_status = 'APPROVED' AND NEW.is_companion_active = true) THEN
        SELECT * INTO v_ref 
        FROM public.referrals 
        WHERE referee_id = NEW.id AND status = 'pending' AND role = 'companion';

        IF FOUND THEN
            UPDATE public.referrals
            SET status = 'verified_active',
                verified_at = now()
            WHERE id = v_ref.id;

            PERFORM public.reward_referral_milestone(v_ref.referrer_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_companion_referral ON public.users;
CREATE TRIGGER trg_verify_companion_referral
    AFTER UPDATE OF kyc_status, is_companion_active ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trig_fn_verify_companion_referral();

-- 8. Trigger: Verify Client Referral When 1st Booking Completes
CREATE OR REPLACE FUNCTION public.trig_fn_verify_client_referral_on_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_ref RECORD;
BEGIN
    IF (NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status <> 'COMPLETED')) THEN
        SELECT * INTO v_ref 
        FROM public.referrals 
        WHERE referee_id = NEW.client_id AND status = 'pending' AND role = 'client';

        IF FOUND THEN
            UPDATE public.referrals
            SET status = 'verified_active',
                verified_at = now()
            WHERE id = v_ref.id;

            PERFORM public.reward_referral_milestone(v_ref.referrer_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_client_referral ON public.bookings;
CREATE TRIGGER trg_verify_client_referral
    AFTER UPDATE OF status ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trig_fn_verify_client_referral_on_booking();
