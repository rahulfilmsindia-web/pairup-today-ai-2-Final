-- Row Level Security Policies for PairUpToday
-- Migration: 002_rls_policies
-- Created: 2026-11-11

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_mfa_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- USERS TABLE POLICIES

-- Users can read their own record
CREATE POLICY "Users can read own data"
    ON users FOR SELECT
    USING (auth.uid()::text = id::text);

-- Users can update their own record (restricted fields)
CREATE POLICY "Users can update own data"
    ON users FOR UPDATE
    USING (auth.uid()::text = id::text)
    WITH CHECK (
        auth.uid()::text = id::text AND
        -- Prevent changing critical fields
        role = (SELECT role FROM users WHERE id = auth.uid()::text) AND
        kyc_status = (SELECT kyc_status FROM users WHERE id = auth.uid()::text) AND
        phone = (SELECT phone FROM users WHERE id = auth.uid()::text)
    );

-- Service role (backend) can do everything
CREATE POLICY "Service role full access on users"
    ON users FOR ALL
    USING (auth.role() = 'service_role');

-- KYC SUBMISSIONS POLICIES

-- Users can read their own KYC submissions
CREATE POLICY "Users can read own KYC"
    ON kyc_submissions FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Users can insert their own KYC
CREATE POLICY "Users can insert own KYC"
    ON kyc_submissions FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Service role full access
CREATE POLICY "Service role full access on kyc_submissions"
    ON kyc_submissions FOR ALL
    USING (auth.role() = 'service_role');

-- COMPANION PROFILES POLICIES

-- Public can read live companion profiles (for discovery)
CREATE POLICY "Public can read live companion profiles"
    ON companion_profiles FOR SELECT
    USING (is_live = true);

-- Companions can read their own profile
CREATE POLICY "Companions can read own profile"
    ON companion_profiles FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Companions can update their own profile
CREATE POLICY "Companions can update own profile"
    ON companion_profiles FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Service role full access
CREATE POLICY "Service role full access on companion_profiles"
    ON companion_profiles FOR ALL
    USING (auth.role() = 'service_role');

-- COMPANION MEMBERSHIPS POLICIES

-- Companions can read their own memberships
CREATE POLICY "Companions can read own memberships"
    ON companion_memberships FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Service role full access
CREATE POLICY "Service role full access on companion_memberships"
    ON companion_memberships FOR ALL
    USING (auth.role() = 'service_role');

-- BANK VERIFICATIONS POLICIES

-- Users can read their own bank verification status (no sensitive data)
CREATE POLICY "Users can read own bank verification status"
    ON bank_verifications FOR SELECT
    USING (
        auth.uid()::text = user_id::text AND
        -- Exclude sensitive fields
        account_number_encrypted IS NULL
    );

-- Service role full access
CREATE POLICY "Service role full access on bank_verifications"
    ON bank_verifications FOR ALL
    USING (auth.role() = 'service_role');

-- BOOKINGS POLICIES

-- Clients can read their own bookings
CREATE POLICY "Clients can read own bookings"
    ON bookings FOR SELECT
    USING (auth.uid()::text = client_id::text);

-- Companions can read bookings assigned to them
CREATE POLICY "Companions can read assigned bookings"
    ON bookings FOR SELECT
    USING (auth.uid()::text = companion_id::text);

-- Service role full access
CREATE POLICY "Service role full access on bookings"
    ON bookings FOR ALL
    USING (auth.role() = 'service_role');

-- WALLET LEDGER POLICIES

-- Users can read their own wallet ledger
CREATE POLICY "Users can read own wallet ledger"
    ON wallet_ledger FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Service role full access
CREATE POLICY "Service role full access on wallet_ledger"
    ON wallet_ledger FOR ALL
    USING (auth.role() = 'service_role');

-- PAYOUTS POLICIES

-- Users can read their own payouts
CREATE POLICY "Users can read own payouts"
    ON payouts FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Service role full access
CREATE POLICY "Service role full access on payouts"
    ON payouts FOR ALL
    USING (auth.role() = 'service_role');

-- CHAT CONVERSATIONS POLICIES

-- Users can read conversations they participate in
CREATE POLICY "Users can read own chat conversations"
    ON chat_conversations FOR SELECT
    USING (auth.uid()::text = participant_a::text OR auth.uid()::text = participant_b::text);

-- Users can insert conversations they participate in
CREATE POLICY "Users can insert own chat conversations"
    ON chat_conversations FOR INSERT
    WITH CHECK (auth.uid()::text = participant_a::text OR auth.uid()::text = participant_b::text);

-- Service role full access
CREATE POLICY "Service role full access on chat_conversations"
    ON chat_conversations FOR ALL
    USING (auth.role() = 'service_role');

-- CHAT MESSAGES POLICIES

-- Users can read messages in conversations they participate in
CREATE POLICY "Users can read own chat messages"
    ON chat_messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM chat_conversations
            WHERE participant_a::text = auth.uid()::text OR participant_b::text = auth.uid()::text
        )
    );

-- Users can insert messages in conversations they participate in
CREATE POLICY "Users can insert own chat messages"
    ON chat_messages FOR INSERT
    WITH CHECK (
        sender_id::text = auth.uid()::text AND
        conversation_id IN (
            SELECT id FROM chat_conversations
            WHERE participant_a::text = auth.uid()::text OR participant_b::text = auth.uid()::text
        )
    );

-- Users can update read status of messages sent to them
CREATE POLICY "Users can update read status of messages"
    ON chat_messages FOR UPDATE
    USING (
        sender_id::text != auth.uid()::text AND
        conversation_id IN (
            SELECT id FROM chat_conversations
            WHERE participant_a::text = auth.uid()::text OR participant_b::text = auth.uid()::text
        )
    );

-- Service role full access
CREATE POLICY "Service role full access on chat_messages"
    ON chat_messages FOR ALL
    USING (auth.role() = 'service_role');

-- SUPPORT CONVERSATIONS POLICIES

-- Users can read their own support conversations
CREATE POLICY "Users can read own support conversations"
    ON support_conversations FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Users can insert their own support conversations
CREATE POLICY "Users can insert own support conversations"
    ON support_conversations FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Service role full access
CREATE POLICY "Service role full access on support_conversations"
    ON support_conversations FOR ALL
    USING (auth.role() = 'service_role');

-- SUPPORT MESSAGES POLICIES

-- Users can read messages in their own support conversations
CREATE POLICY "Users can read own support messages"
    ON support_messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM support_conversations WHERE user_id::text = auth.uid()::text
        )
    );

-- Users can insert messages in their own support conversations
CREATE POLICY "Users can insert own support messages"
    ON support_messages FOR INSERT
    WITH CHECK (
        sender_id::text = auth.uid()::text AND
        is_admin = false AND
        conversation_id IN (
            SELECT id FROM support_conversations WHERE user_id::text = auth.uid()::text
        )
    );

-- Service role full access
CREATE POLICY "Service role full access on support_messages"
    ON support_messages FOR ALL
    USING (auth.role() = 'service_role');

-- ADMIN USERS POLICIES

-- Service role full access (admin authentication handled at application level)
CREATE POLICY "Service role full access on admin_users"
    ON admin_users FOR ALL
    USING (auth.role() = 'service_role');

-- ADMIN MFA STORE POLICIES

-- Service role full access
CREATE POLICY "Service role full access on admin_mfa_store"
    ON admin_mfa_store FOR ALL
    USING (auth.role() = 'service_role');

-- AUDIT LOGS POLICIES

-- Service role full access
CREATE POLICY "Service role full access on audit_logs"
    ON audit_logs FOR ALL
    USING (auth.role() = 'service_role');

-- NOTIFICATIONS POLICIES

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
    ON notifications FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Users can update read status of their notifications
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Service role full access
CREATE POLICY "Service role full access on notifications"
    ON notifications FOR ALL
    USING (auth.role() = 'service_role');

-- PAYMENT WEBHOOK EVENTS POLICIES

-- Service role full access
CREATE POLICY "Service role full access on payment_webhook_events"
    ON payment_webhook_events FOR ALL
    USING (auth.role() = 'service_role');
