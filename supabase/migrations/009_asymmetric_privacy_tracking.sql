-- ==============================================================================
-- Migration 009: Asymmetric Privacy Tracking, Isolated GPS & Realtime Chat
-- PairUpToday Production Architecture
-- ==============================================================================

-- 1. Extend bookings table with Privacy Tracking & 4-Digit Session OTP columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_location_name TEXT,
  ADD COLUMN IF NOT EXISTS booking_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS booking_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_otp VARCHAR(6),
  ADD COLUMN IF NOT EXISTS companion_eta_text TEXT DEFAULT 'Calculating...',
  ADD COLUMN IF NOT EXISTS companion_current_area TEXT DEFAULT 'Preparing to leave...',
  ADD COLUMN IF NOT EXISTS last_eta_updated_at TIMESTAMPTZ;

-- Backfill booking_location_name from meeting_location if null
UPDATE public.bookings 
SET booking_location_name = meeting_location 
WHERE booking_location_name IS NULL AND meeting_location IS NOT NULL;

-- 2. Strictly Isolated Raw GPS Table (Clients have ZERO SELECT access)
CREATE TABLE IF NOT EXISTS public.companion_live_coords (
    booking_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
    companion_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companion_live_coords_companion_id ON public.companion_live_coords(companion_id);
CREATE INDEX IF NOT EXISTS idx_companion_live_coords_updated_at ON public.companion_live_coords(updated_at);

-- Enable Row Level Security on companion_live_coords
ALTER TABLE public.companion_live_coords ENABLE ROW LEVEL SECURITY;

-- Drop previous policies if re-running
DROP POLICY IF EXISTS "companion_insert_live_coords" ON public.companion_live_coords;
DROP POLICY IF EXISTS "companion_update_live_coords" ON public.companion_live_coords;
DROP POLICY IF EXISTS "companion_select_own_coords" ON public.companion_live_coords;

-- Policy 1: Companion can INSERT their own GPS coordinates only for confirmed/active bookings
CREATE POLICY "companion_insert_live_coords" ON public.companion_live_coords
FOR INSERT WITH CHECK (
  auth.uid() = companion_id AND
  EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = booking_id
      AND status IN ('CONFIRMED', 'CONFIRMED_PAID')
  )
);

-- Policy 2: Companion can UPDATE their own GPS coordinates only for confirmed/active bookings
CREATE POLICY "companion_update_live_coords" ON public.companion_live_coords
FOR UPDATE USING (
  auth.uid() = companion_id AND
  EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = booking_id
      AND status IN ('CONFIRMED', 'CONFIRMED_PAID')
  )
);

-- Policy 3: Companion can SELECT their own coordinates (Clients have NO SELECT policy -> 100% blocked)
CREATE POLICY "companion_select_own_coords" ON public.companion_live_coords
FOR SELECT USING (auth.uid() = companion_id);


-- 3. Realtime In-App Chat Table (booking_messages)
CREATE TABLE IF NOT EXISTS public.booking_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_name VARCHAR(255),
    sender_role VARCHAR(50) DEFAULT 'CLIENT',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id ON public.booking_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_messages_created_at ON public.booking_messages(created_at);

-- Enable Row Level Security on booking_messages
ALTER TABLE public.booking_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_messages_select_policy" ON public.booking_messages;
DROP POLICY IF EXISTS "booking_messages_insert_policy" ON public.booking_messages;

-- Policy 1: Only Client or Companion of this booking can SELECT messages
CREATE POLICY "booking_messages_select_policy" ON public.booking_messages
FOR SELECT USING (
  auth.uid() IN (
    SELECT client_id FROM public.bookings WHERE id = booking_id
    UNION
    SELECT companion_id FROM public.bookings WHERE id = booking_id
  )
);

-- Policy 2: Only Client or Companion can INSERT when booking is active (CONFIRMED/ONGOING)
CREATE POLICY "booking_messages_insert_policy" ON public.booking_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  auth.uid() IN (
    SELECT client_id FROM public.bookings WHERE id = booking_id
    UNION
    SELECT companion_id FROM public.bookings WHERE id = booking_id
  ) AND
  EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = booking_id
      AND status IN ('CONFIRMED', 'CONFIRMED_PAID', 'ONGOING', 'IN_PROGRESS')
  )
);


-- 4. Session OTP Verification RPC
CREATE OR REPLACE FUNCTION public.verify_session_otp(
    p_booking_id UUID,
    p_entered_otp TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking RECORD;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
    END IF;

    -- Verify caller is companion
    IF auth.uid() IS NOT NULL AND auth.uid() <> v_booking.companion_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the assigned companion can verify session OTP');
    END IF;

    -- Verify status is confirmed
    IF v_booking.status NOT IN ('CONFIRMED', 'CONFIRMED_PAID', 'COMPANION_ARRIVED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking is not in a valid state for OTP verification');
    END IF;

    -- Verify OTP
    IF v_booking.session_otp = trim(p_entered_otp) OR v_booking.start_otp_hash = crypt(trim(p_entered_otp), v_booking.start_otp_hash) THEN
        UPDATE public.bookings
        SET status = 'ONGOING',
            started_at = NOW(),
            companion_arrived_at = COALESCE(companion_arrived_at, NOW()),
            updated_at = NOW()
        WHERE id = p_booking_id;

        -- Remove live coords record to guarantee companion location is no longer tracked
        DELETE FROM public.companion_live_coords WHERE booking_id = p_booking_id;

        RETURN jsonb_build_object('success', true, 'status', 'ONGOING', 'started_at', NOW());
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid 4-digit session OTP');
    END IF;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_session_otp(UUID, TEXT) TO authenticated, service_role;
