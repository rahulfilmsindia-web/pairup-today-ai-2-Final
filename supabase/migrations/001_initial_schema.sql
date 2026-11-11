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
