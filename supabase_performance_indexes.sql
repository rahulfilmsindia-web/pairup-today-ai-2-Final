-- ==============================================================================
-- PairUpToday Supabase PostgreSQL Performance & Disk IO Optimization Script
-- Eliminates Sequential Scans, Lowers Disk IOPS, and Shields Egress
-- Run this in Supabase Dashboard > SQL Editor
-- ==============================================================================

-- 1. BOOKINGS TABLE (Primary operational table)
CREATE INDEX IF NOT EXISTS idx_bookings_client_id 
  ON bookings (client_id);

CREATE INDEX IF NOT EXISTS idx_bookings_companion_id 
  ON bookings (companion_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status 
  ON bookings (status);

CREATE INDEX IF NOT EXISTS idx_bookings_created_at_desc 
  ON bookings (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_order_id 
  ON bookings (payment_order_id) 
  WHERE payment_order_id IS NOT NULL;

-- High-speed compound index for participant lookups
CREATE INDEX IF NOT EXISTS idx_bookings_client_status 
  ON bookings (client_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_companion_status 
  ON bookings (companion_id, status);

-- Partial index for active and pending bookings (keeps working set in RAM)
CREATE INDEX IF NOT EXISTS idx_bookings_active_incoming 
  ON bookings (companion_id, status, created_at DESC)
  WHERE status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'STARTED');

-- 2. USERS TABLE
CREATE INDEX IF NOT EXISTS idx_users_phone 
  ON users (phone);

CREATE INDEX IF NOT EXISTS idx_users_role 
  ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_kyc_status 
  ON users (kyc_status);

CREATE INDEX IF NOT EXISTS idx_users_city 
  ON users (city) 
  WHERE city IS NOT NULL;

-- 3. COMPANION PROFILES
CREATE INDEX IF NOT EXISTS idx_companion_profiles_user_id 
  ON companion_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_companion_profiles_discovery 
  ON companion_profiles (is_live, is_paused) 
  WHERE is_live = true AND is_paused = false;

-- 4. KYC SUBMISSIONS
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user_role 
  ON kyc_submissions (user_id, submission_role);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status_submitted 
  ON kyc_submissions (status, submitted_at DESC);

-- 5. COMPANION MEMBERSHIPS
CREATE INDEX IF NOT EXISTS idx_companion_memberships_user_active 
  ON companion_memberships (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_companion_memberships_payment_order 
  ON companion_memberships (payment_order_id) 
  WHERE payment_order_id IS NOT NULL;

-- 6. BANK VERIFICATIONS
CREATE INDEX IF NOT EXISTS idx_bank_verifications_user 
  ON bank_verifications (user_id);

CREATE INDEX IF NOT EXISTS idx_bank_verifications_verified 
  ON bank_verifications (user_id, verification_status);

-- 7. NOTIFICATIONS TABLE
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON notifications (user_id, created_at DESC);

-- 8. AUDIT LOGS TABLE
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created 
  ON audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created 
  ON audit_logs (admin_user_id, created_at DESC);

-- 9. VACUUM & ANALYZE TO PRIME POSTGRES QUERY PLANNER
ANALYZE users;
ANALYZE bookings;
ANALYZE companion_profiles;
ANALYZE kyc_submissions;
ANALYZE companion_memberships;
ANALYZE bank_verifications;
ANALYZE notifications;
ANALYZE audit_logs;
